import React from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Alert, CircularProgress, Box, Stack, Divider, ToggleButton, ToggleButtonGroup } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import ScheduleIcon from "@mui/icons-material/Schedule";
import { LocalizationProvider, DateTimePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { ApiHelper } from "@churchapps/apphelper";
import { parseApiError } from "./apiError";
import { getSchedulingTimezone } from "./campaignApi";

dayjs.extend(utc);
dayjs.extend(timezone);

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
  // SND-04 schedule-for-later: called with a UTC ISO instant when the user
  // confirms a scheduled send. Absent → the dialog offers only "Send now".
  onSchedule?: (scheduledAtIso: string) => Promise<void> | void;
  // Which mode the dialog opens in. The caller's two distinct header buttons
  // ("Send now" / "Schedule for later") drive this so the user lands directly on
  // the action they picked — no ambiguity about whether "Send" fires immediately.
  initialMode?: "now" | "later";
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

// The church tz the picker falls back to while /timezone loads or on error, so
// the picker always renders (server re-validates the 5-min lead regardless).
const DEFAULT_TZ = "America/New_York";

export function SendConfirmDialog(props: Props) {
  const { campaignId, subject, open = true, onSent, onClose, onSchedule, initialMode = "now" } = props;
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState<StatusData | null>(null);
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [sendable, setSendable] = React.useState<boolean | null>(null);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState("");
  const [blockReason, setBlockReason] = React.useState("");

  // SND-04 scheduling: "now" vs "later"; the church tz driving the picker label +
  // church-local→UTC conversion; and the picked wall-clock value (interpreted AS
  // the church tz). scheduling guards the schedule round-trip against double-clicks.
  const [mode, setMode] = React.useState<"now" | "later">("now");
  const [churchTz, setChurchTz] = React.useState(DEFAULT_TZ);
  const [value, setValue] = React.useState<Dayjs | null>(null);
  const [scheduling, setScheduling] = React.useState(false);

  // Fetch the church scheduling tz once when the dialog opens (default while
  // loading / on error so the picker is always usable).
  React.useEffect(() => {
    if (!open) return;
    let active = true;
    getSchedulingTimezone()
      .then((r) => {
        if (active && r?.timezone) setChurchTz(r.timezone);
      })
      .catch(() => {
        /* keep DEFAULT_TZ — the server re-validates the lead anyway */
      });
    return () => {
      active = false;
    };
  }, [open]);

  // Reset the mode/value each time the dialog opens so a prior schedule attempt
  // doesn't leak into the next open. Open in the mode the caller's header button
  // chose ("Send now" vs "Schedule for later").
  React.useEffect(() => {
    if (open) {
      setMode(onSchedule ? initialMode : "now");
      setValue(null);
    }
  }, [open, initialMode, onSchedule]);

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

  // The earliest selectable instant: 5 minutes out in the church tz (the locked
  // 5-min lead). The picker enforces this client-side; the server re-validates.
  const minDateTime = React.useMemo(() => dayjs().tz(churchTz).add(5, "minute"), [churchTz]);

  // Confirm a scheduled send: reinterpret the picked wall-clock AS the church tz
  // (keepLocalTime), convert to the absolute UTC instant the server + poller
  // compare against, and hand it to the parent's schedule handler.
  const handleSchedule = async () => {
    if (!value || !onSchedule) return;
    setScheduling(true);
    setError("");
    try {
      const scheduledAtIso = value.tz(churchTz, true).utc().toISOString();
      await onSchedule(scheduledAtIso);
      // The parent reloads the draft (status stays "scheduled", now with
      // scheduledAt) and closes the dialog on success.
    } catch (err: unknown) {
      const body = parseApiError(err);
      if (body.code === "LEAD_TIME") {
        setError("Please pick a time at least 5 minutes from now.");
      } else if (body.code === "DOMAIN_UNVERIFIED") {
        setSendable(false);
        setBlockReason("Your huro.church sending domain isn’t verified in Amazon SES yet. Scheduling is blocked until it’s verified.");
        setError("Schedule blocked: the sending domain isn’t verified.");
      } else if (body.code === "NO_EMAIL_SETTINGS") {
        setSendable(false);
        setBlockReason("No sender identity is configured. Set your from-address in Email settings before scheduling.");
        setError("Schedule blocked: no sender identity configured.");
      } else if (body.error === "conflict" || body.error === "not_schedulable") {
        setError("This campaign can no longer be scheduled (it may already be sending or sent).");
      } else {
        setError(body.error || "Couldn't schedule the campaign.");
      }
    } finally {
      setScheduling(false);
    }
  };

  const hardBlocked = sendable === false;
  const busy = sending || scheduling;
  const canSend = !loading && !busy && sendable === true && !!status;
  // Schedule confirm requires a picked time at/after the 5-min minimum.
  const scheduleReady =
    !!value && value.isValid() && !value.isBefore(minDateTime);
  const canSchedule = !loading && !busy && sendable === true && !!status && scheduleReady;

  return (
    <Dialog open={open} onClose={sending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{onSchedule && mode === "later" ? "Schedule for later" : "Review & send now"}</DialogTitle>
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

            {/* SND-04 — Send now vs Schedule for later. The schedule branch only
                appears when the caller supplies an onSchedule handler. */}
            {onSchedule && (
              <>
                <Divider sx={{ my: 2 }} />
                <ToggleButtonGroup
                  value={mode}
                  exclusive
                  size="small"
                  onChange={(_e, v) => {
                    if (v) setMode(v);
                  }}
                  sx={{ mb: 2 }}
                  data-testid="send-mode-toggle"
                >
                  <ToggleButton value="now" data-testid="mode-send-now">
                    <SendIcon fontSize="small" sx={{ mr: 0.75 }} /> Send now
                  </ToggleButton>
                  <ToggleButton value="later" data-testid="mode-schedule">
                    <ScheduleIcon fontSize="small" sx={{ mr: 0.75 }} /> Schedule for later
                  </ToggleButton>
                </ToggleButtonGroup>

                {mode === "later" && (
                  <Box>
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                      <DateTimePicker
                        label={`Send time (${churchTz})`}
                        value={value}
                        onChange={setValue}
                        minutesStep={5}
                        minDateTime={minDateTime}
                        slotProps={{ textField: { fullWidth: true, size: "small", "data-testid": "schedule-datetime" } as any }}
                      />
                    </LocalizationProvider>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                      Times are in the church timezone ({churchTz}). Must be at least 5 minutes from now.
                    </Typography>
                  </Box>
                )}
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        {onSchedule && mode === "later" ? (
          <Button
            variant="contained"
            color="info"
            onClick={handleSchedule}
            disabled={!canSchedule}
            startIcon={scheduling ? <CircularProgress size={16} color="inherit" /> : <ScheduleIcon />}
            data-testid="confirm-schedule"
          >
            {scheduling ? "Scheduling…" : "Schedule send"}
          </Button>
        ) : (
          <Button
            variant="contained"
            color="primary"
            onClick={handleSend}
            disabled={!canSend}
            startIcon={sending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
            data-testid="confirm-send-now"
          >
            {sending ? "Sending…" : "Send now"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
