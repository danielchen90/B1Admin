import React from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Alert, CircularProgress, Box, Stack, Divider } from "@mui/material";
import { ApiHelper } from "@churchapps/apphelper";
import { parseApiError } from "./apiError";

// SND-02 — the review / confirmation step: the LAST screen before the irreversible
// send. It shows the final recipient count, the resolved From identity, and the
// subject, then POSTs /campaigns/:id/send on confirm.
//
// Data sources (Plan-02 EmailCampaignController):
//   GET  /campaigns/:id/status  -> { status, recipientCount, sentCount, failedCount, counts }
//   GET  /campaigns/settings    -> { fromName?, fromEmail?, replyTo? }   (resolved From)
//   GET  /campaigns/domain-status -> { sendable, ... }                   (hard-block)
//   POST /campaigns/:id/send    -> 202 { status, recipientCount }
//        errors (ApiHelper THROWS): 422 DOMAIN_UNVERIFIED / NO_EMAIL_SETTINGS,
//                                   409 conflict / BAD_STATUS (already sending)
//
// The /status endpoint does NOT return subject/from, so the caller passes the
// campaign subject via props; the resolved From comes from /campaigns/settings.
// Path/app note: MessagingApi base ends in "/messaging"; app key "MessagingApi".

interface Props {
  campaignId: string;
  // Subject is not on /status — the caller (the builder/list) passes it in.
  subject?: string;
  open?: boolean;
  onSent: () => void;
  onClose: () => void;
}

interface StatusData {
  status: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
}

interface Settings {
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
}

export function SendConfirmDialog(props: Props) {
  const { campaignId, subject, open = true, onSent, onClose } = props;
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState<StatusData | null>(null);
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [sendable, setSendable] = React.useState<boolean | null>(null);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState("");
  const [blockReason, setBlockReason] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError("");
    setBlockReason("");
    Promise.all([
      ApiHelper.get("/campaigns/" + campaignId + "/status", "MessagingApi"),
      ApiHelper.get("/campaigns/settings", "MessagingApi"),
      ApiHelper.get("/campaigns/domain-status", "MessagingApi")
    ])
      .then(([st, cfg, dom]: [StatusData, Settings, { sendable: boolean; reason?: string }]) => {
        if (!active) return;
        setStatus(st);
        setSettings(cfg);
        setSendable(dom?.sendable === true);
        if (dom?.sendable !== true) {
          setBlockReason(
            dom?.reason === "no-email-settings"
              ? "No sender identity is configured yet. Set your from-address in Email settings before sending."
              : "Your huro.church sending domain isn’t verified in Amazon SES yet. Verify it (or ask your administrator) before sending."
          );
        }
      })
      .catch((err: unknown) => {
        if (active) setError(parseApiError(err).error || "Couldn't load the send review.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [campaignId, open]);

  const resolvedFrom = React.useMemo(() => {
    if (!settings?.fromEmail) return "";
    return settings.fromName ? `${settings.fromName} <${settings.fromEmail}>` : settings.fromEmail;
  }, [settings]);

  const handleSend = async () => {
    setSending(true);
    setError("");
    try {
      await ApiHelper.post("/campaigns/" + campaignId + "/send", {}, "MessagingApi");
      // 202 accepted — the worker sends off-thread. Hand off to the caller, which
      // swaps in SendProgress.
      onSent();
    } catch (err: unknown) {
      const body = parseApiError(err);
      // Map the machine codes to clear, actionable messages (DLV-02 hard block +
      // DLV-04 double-click 409).
      if (body.code === "DOMAIN_UNVERIFIED") {
        setSendable(false);
        setBlockReason("Your huro.church sending domain isn’t verified in Amazon SES yet. Sending is blocked until it’s verified.");
        setError("Send blocked: the sending domain isn’t verified.");
      } else if (body.code === "NO_EMAIL_SETTINGS") {
        setSendable(false);
        setBlockReason("No sender identity is configured. Set your from-address in Email settings before sending.");
        setError("Send blocked: no sender identity configured.");
      } else if (body.error === "conflict" || body.code === "BAD_STATUS" || body.error === "not_sendable") {
        // Double-click / concurrent scheduler / already-sent — NOT a second batch.
        setError("This campaign is already sending (or has already been sent). It was not sent again.");
      } else {
        setError(body.error || "Couldn't send the campaign.");
      }
    } finally {
      setSending(false);
    }
  };

  const hardBlocked = sendable === false;
  const canSend = !loading && !sending && sendable === true && !!status;

  return (
    <Dialog open={open} onClose={sending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Review &amp; send</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Typography variant="body1" sx={{ mb: 2 }}>
              This will email{" "}
              <strong>{(status?.recipientCount ?? 0).toLocaleString()}</strong>{" "}
              {status?.recipientCount === 1 ? "person" : "people"}. This can&rsquo;t be undone.
            </Typography>

            <Divider sx={{ mb: 2 }} />

            <Stack spacing={1.5} sx={{ mb: 1 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">From</Typography>
                <Typography variant="body2">{resolvedFrom || "— not configured —"}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Subject</Typography>
                <Typography variant="body2">{subject || "— (subject shown from the campaign) —"}</Typography>
              </Box>
              {settings?.replyTo && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Reply-to</Typography>
                  <Typography variant="body2">{settings.replyTo}</Typography>
                </Box>
              )}
            </Stack>

            {hardBlocked && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                {blockReason}
              </Alert>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={sending}>Cancel</Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSend}
          disabled={!canSend}
          startIcon={sending ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {sending ? "Sending…" : "Send now"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
