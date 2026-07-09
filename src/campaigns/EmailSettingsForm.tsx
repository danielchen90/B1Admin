import React from "react";
import { Box, Button, TextField, Alert, CircularProgress, Stack, Typography } from "@mui/material";
import { ApiHelper } from "@churchapps/apphelper";
import { apiErrorMessage } from "./apiError";

// DLV-02 — the church-wide from-identity editor. An admin sets from-name /
// from-email / reply-to ONCE here and every campaign inherits it (there is no
// per-campaign sender override in this milestone).
//
// Data source: the Plan-02 EmailCampaignController.
//   GET  /campaigns/settings   -> { fromName?, fromEmail?, replyTo? } | {}
//   POST /campaigns/settings   -> saved settings (422 { error, code } on invalid)
//
// NOTE on the API path: MessagingApi's base URL already ends in "/messaging"
// (CommonEnvironmentHelper.MessagingApi = base + "/messaging"), so the bare
// "/campaigns/settings" resolves to the server's /messaging/campaigns/settings
// route — a "/messaging" prefix here would double to a 404 (project memory
// "b1admin" doubled-prefix lesson). App name is "MessagingApi" (the ApiHelper
// config key), not "messaging".
//
// The server enforces the huro.church sending domain (422 WRONG_DOMAIN /
// INVALID_FROM_EMAIL); we surface those inline rather than pre-validate, so the
// UI and API agree by construction.

// The single SES sending domain (mirrors the server SENDING_DOMAIN constant).
const SENDING_DOMAIN = "huro.church";

interface Settings {
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
}

export function EmailSettingsForm() {
  const [fromName, setFromName] = React.useState("");
  const [fromEmail, setFromEmail] = React.useState("");
  const [replyTo, setReplyTo] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    ApiHelper.get("/campaigns/settings", "MessagingApi")
      .then((data: Settings) => {
        if (!active) return;
        setFromName(data?.fromName ?? "");
        setFromEmail(data?.fromEmail ?? "");
        setReplyTo(data?.replyTo ?? "");
      })
      .catch((err: unknown) => {
        if (active) setError(apiErrorMessage(err, "Couldn't load email settings."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const body = { fromName, fromEmail: fromEmail.trim(), replyTo: replyTo.trim() };
      await ApiHelper.post("/campaigns/settings", body, "MessagingApi");
      setSaved(true);
    } catch (err: unknown) {
      // Surface the server 422 validation inline (e.g. from-email not on
      // huro.church → WRONG_DOMAIN, or a malformed address).
      setError(apiErrorMessage(err, "Couldn't save email settings."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box component="form" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
      <Typography variant="h6" sx={{ mb: 1 }}>Sender identity</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Every campaign is sent from this identity. The from address must be on the{" "}
        <strong>{SENDING_DOMAIN}</strong> sending domain.
      </Typography>

      {saved && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaved(false)}>Email settings saved.</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

      <Stack spacing={2}>
        <TextField
          label="From name"
          value={fromName}
          onChange={(e) => setFromName(e.target.value)}
          disabled={saving}
          fullWidth
          placeholder="Grace Community Church"
          helperText="The display name recipients see in their inbox."
        />
        <TextField
          label="From email"
          value={fromEmail}
          onChange={(e) => setFromEmail(e.target.value)}
          disabled={saving}
          fullWidth
          placeholder={`office@${SENDING_DOMAIN}`}
          helperText={`Must be an address on ${SENDING_DOMAIN}.`}
        />
        <TextField
          label="Reply-to"
          value={replyTo}
          onChange={(e) => setReplyTo(e.target.value)}
          disabled={saving}
          fullWidth
          placeholder="pastor@yourchurch.org (optional)"
          helperText="Where replies go — can be any address. Leave blank to reply to the from address."
        />
      </Stack>

      <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}>
        <Button
          type="submit"
          variant="contained"
          disabled={saving || fromEmail.trim().length === 0}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </Box>
    </Box>
  );
}
