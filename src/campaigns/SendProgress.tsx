import React from "react";
import { Box, LinearProgress, Typography, Alert, Stack } from "@mui/material";
import { ApiHelper } from "@churchapps/apphelper";

// SND-06 — live X-of-N delivery progress. While the campaign is sending, poll
// /campaigns/:id/status every ~3s and render "X of N delivered" from the
// DB-backed counters (NO client-side estimation — the numbers come straight from
// the recipient rows the worker marks).
//
// Data source (Plan-02 EmailCampaignController):
//   GET /campaigns/:id/status
//     -> { status, recipientCount, sentCount, failedCount,
//          counts: { sent, failed, pending, sending, total } }
//
// Terminal states: the worker flips status to "sent" only when no pending/sending
// rows remain; a partial failure stays reflected as failedCount (there is no
// "partially_sent" status). "failed" is also terminal. We stop polling on either.
//
// Path/app note: MessagingApi base ends in "/messaging"; app key "MessagingApi".

interface StatusData {
  status: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
}

interface Props {
  campaignId: string;
  pollMs?: number;
  // Optional notification when the send reaches a terminal state.
  onComplete?: (status: StatusData) => void;
}

const TERMINAL = new Set(["sent", "failed", "canceled"]);

export function SendProgress(props: Props) {
  const { campaignId, pollMs = 3000, onComplete } = props;
  const [data, setData] = React.useState<StatusData | null>(null);
  const [error, setError] = React.useState("");

  const onCompleteRef = React.useRef(onComplete);
  React.useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  React.useEffect(() => {
    let active = true;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const st: StatusData = await ApiHelper.get("/campaigns/" + campaignId + "/status", "MessagingApi");
        if (!active) return;
        setData(st);
        setError("");
        if (TERMINAL.has(st.status)) {
          // Stop polling on completion — clear any pending interval.
          if (timer) window.clearInterval(timer);
          onCompleteRef.current?.(st);
        }
      } catch {
        // Transient failure — keep the last known numbers and keep polling.
        if (active) setError("Couldn’t refresh progress; retrying…");
      }
    };

    poll();
    timer = window.setInterval(poll, pollMs);
    return () => {
      active = false;
      if (timer) window.clearInterval(timer);
    };
  }, [campaignId, pollMs]);

  if (!data) {
    return (
      <Box sx={{ py: 2 }}>
        <LinearProgress />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Starting send…</Typography>
      </Box>
    );
  }

  const total = data.recipientCount || 0;
  const sent = data.sentCount || 0;
  const failed = data.failedCount || 0;
  const done = sent + failed;
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const terminal = TERMINAL.has(data.status);

  return (
    <Box sx={{ py: 2 }}>
      <LinearProgress
        variant={total > 0 ? "determinate" : "indeterminate"}
        value={pct}
        color={terminal && failed === 0 ? "success" : failed > 0 ? "warning" : "primary"}
      />
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mt: 1 }}>
        <Typography variant="body2">
          {terminal ? (
            <>Sent to <strong>{sent.toLocaleString()}</strong> of {total.toLocaleString()}</>
          ) : (
            <><strong>{sent.toLocaleString()}</strong> of {total.toLocaleString()} delivered</>
          )}
          {failed > 0 && (
            <Typography component="span" variant="body2" color="warning.main">
              {" "}({failed.toLocaleString()} failed)
            </Typography>
          )}
        </Typography>
        <Typography variant="body2" color="text.secondary">{pct}%</Typography>
      </Stack>

      {error && !terminal && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>{error}</Typography>
      )}

      {terminal && (
        <Alert severity={failed === 0 ? "success" : "warning"} sx={{ mt: 2 }}>
          {failed === 0
            ? `Done — sent to all ${sent.toLocaleString()} recipients.`
            : `Done — sent to ${sent.toLocaleString()} of ${total.toLocaleString()} (${failed.toLocaleString()} failed).`}
        </Alert>
      )}
    </Box>
  );
}
