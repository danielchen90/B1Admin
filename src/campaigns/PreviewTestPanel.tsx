// The Preview & Test surface (Plan 12-07, BLD-06 + BLD-07).
//
// EVERYTHING rendered here is SERVER-side via the ONE shared CampaignRenderHelper
// (12-01) — never a browser-authoritative render of the real bytes. The panel:
//
//   PREVIEW (BLD-06): campaignApi.previewCampaign(id, recipientIndex) returns the
//   merged { html, subject, recipientEmail, recipientIndex, totalRecipients } for
//   a REAL recipient resolved live pre-freeze. We render `html` in an isolated
//   <iframe srcDoc> so the email HTML doesn't inherit the app's CSS, and offer a
//   Next / Previous control to cycle real recipients (12-CONTEXT: cycle through
//   real recipients to catch missing-data cases). Before the first preview we
//   flush the builder's latest export+save (onEnsureSaved) so the server renders
//   the CURRENT design, not a stale one.
//
//   WIDTH TOGGLE (BLD-06): a desktop / mobile toggle. Because the real-merge story
//   requires the server-rendered HTML in an iframe (Unlayer's built-in preview
//   only shows the in-editor design, not the merged bytes), we drive the width via
//   the iframe: 100% desktop / 375px mobile — the honest device-width story over
//   the SAME server HTML the recipient will receive.
//
//   TEST-SEND (BLD-07): a "to" field PREFILLED with the logged-in staff email
//   (UserHelper.user.email), editable, plus the current recipientIndex for merge
//   data. campaignApi.testSendCampaign gates on VerifiedDomainGate server-side; an
//   unverified domain / missing settings throws a 422 we parse into a clear
//   "verify your sending domain" message (reusing the P11 apiError + banner
//   convention). Test-send writes ZERO recipient rows / counters (12-03), so it
//   never pollutes campaign stats — stated in helper text.

import React from "react";
import {
  Box, Stack, Button, TextField, Typography, Alert, ToggleButton, ToggleButtonGroup,
  CircularProgress, Divider, Chip,
} from "@mui/material";
import DesktopWindowsIcon from "@mui/icons-material/DesktopWindows";
import PhoneIphoneIcon from "@mui/icons-material/PhoneIphone";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import SendIcon from "@mui/icons-material/Send";
import { UserHelper } from "@churchapps/apphelper";
import { previewCampaign, testSendCampaign } from "./campaignApi";
import { type PreviewResult } from "./emailTypes";
import { parseApiError } from "./apiError";

export interface PreviewTestPanelProps {
  // The persisted campaign id. Preview/test-send are scoped by it; a brand-new
  // unsaved draft (no id) shows a "save first" hint.
  campaignId?: string;
  // Whether the builder has unsaved edits — drives the save-before-preview flush.
  dirty?: boolean;
  // Flush the builder's latest export + save so the server renders the CURRENT
  // design. Resolves once the save round-trip is done. The page passes its
  // export+save routine here.
  onEnsureSaved?: () => Promise<void>;
}

type DeviceWidth = "desktop" | "mobile";
const MOBILE_WIDTH = 375;

export const PreviewTestPanel: React.FC<PreviewTestPanelProps> = ({ campaignId, dirty, onEnsureSaved }) => {
  const [device, setDevice] = React.useState<DeviceWidth>("desktop");
  const [index, setIndex] = React.useState(0);
  const [preview, setPreview] = React.useState<PreviewResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [domainBlocked, setDomainBlocked] = React.useState("");

  // Test-send form: the "to" address is PREFILLED with the staff email, editable.
  const [testTo, setTestTo] = React.useState<string>(UserHelper.user?.email ?? "");
  const [sending, setSending] = React.useState(false);
  const [sendResult, setSendResult] = React.useState("");
  const [sendError, setSendError] = React.useState("");

  // Keep the "to" prefill in sync if the user identity loads after mount.
  React.useEffect(() => {
    if (!testTo && UserHelper.user?.email) setTestTo(UserHelper.user.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [UserHelper.user?.email]);

  // Fetch (or re-fetch) the server-rendered preview for `recipientIndex`. Flushes
  // the builder's latest export+save first when dirty so the server renders the
  // CURRENT design.
  const loadPreview = React.useCallback(
    async (recipientIndex: number) => {
      if (!campaignId) return;
      setLoading(true);
      setError("");
      try {
        if (dirty && onEnsureSaved) await onEnsureSaved();
        const res = await previewCampaign(campaignId, recipientIndex);
        setPreview(res);
        setIndex(res.recipientIndex);
      } catch (err: unknown) {
        setPreview(null);
        const body = parseApiError(err);
        setError(body.error || "Couldn't render the preview.");
      } finally {
        setLoading(false);
      }
    },
    [campaignId, dirty, onEnsureSaved]
  );

  // Cycle helpers — wrap around the resolved audience (server also wraps, but we
  // wrap client-side too so the buttons stay responsive).
  const total = preview?.totalRecipients ?? 0;
  const goNext = () => {
    if (total <= 0) return loadPreview(0);
    loadPreview((index + 1) % total);
  };
  const goPrev = () => {
    if (total <= 0) return loadPreview(0);
    loadPreview((index - 1 + total) % total);
  };

  // Test-send: gate the domain server-side; parse the 422 into a clear message.
  const handleTestSend = async () => {
    if (!campaignId) return;
    setSending(true);
    setSendResult("");
    setSendError("");
    setDomainBlocked("");
    try {
      if (dirty && onEnsureSaved) await onEnsureSaved();
      await testSendCampaign(campaignId, { to: testTo, recipientIndex: index });
      setSendResult(`Test sent to ${testTo}. Campaign stats are unaffected.`);
    } catch (err: unknown) {
      const body = parseApiError(err);
      if (body.code === "DOMAIN_UNVERIFIED") {
        setDomainBlocked(
          "Your huro.church sending domain isn’t verified in Amazon SES yet, so even test sends are blocked. Verify the domain (or ask your administrator) in Email settings."
        );
      } else if (body.code === "NO_EMAIL_SETTINGS") {
        setDomainBlocked(
          "No sender identity is configured yet. Set your from-name and from-email in Email settings before sending a test."
        );
      } else {
        setSendError(body.error || "Couldn't send the test email.");
      }
    } finally {
      setSending(false);
    }
  };

  if (!campaignId) {
    return (
      <Typography variant="body2" color="text.secondary" data-testid="preview-needs-save">
        Save the campaign to preview it and send yourself a test.
      </Typography>
    );
  }

  return (
    <Box data-testid="preview-test-panel">
      {/* Controls: render/refresh + recipient cycling + device width toggle. */}
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }} sx={{ mb: 2 }}>
        <Button
          variant="outlined"
          size="small"
          onClick={() => loadPreview(index)}
          disabled={loading}
          data-testid="preview-render"
        >
          {preview ? "Refresh preview" : "Render preview"}
        </Button>

        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            size="small"
            startIcon={<NavigateBeforeIcon />}
            onClick={goPrev}
            disabled={loading || !preview}
            data-testid="preview-prev"
          >
            Prev
          </Button>
          <Button
            size="small"
            endIcon={<NavigateNextIcon />}
            onClick={goNext}
            disabled={loading || !preview}
            data-testid="preview-next"
          >
            Next recipient
          </Button>
        </Stack>

        <ToggleButtonGroup
          size="small"
          exclusive
          value={device}
          onChange={(_e, v: DeviceWidth | null) => v && setDevice(v)}
          data-testid="preview-device-toggle"
        >
          <ToggleButton value="desktop" data-testid="preview-desktop">
            <DesktopWindowsIcon fontSize="small" sx={{ mr: 0.5 }} /> Desktop
          </ToggleButton>
          <ToggleButton value="mobile" data-testid="preview-mobile">
            <PhoneIphoneIcon fontSize="small" sx={{ mr: 0.5 }} /> Mobile
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {preview && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }} flexWrap="wrap">
          <Chip
            size="small"
            variant="outlined"
            label={`Previewing as: ${preview.recipientEmail} (${preview.recipientIndex + 1} of ${preview.totalRecipients})`}
            data-testid="preview-recipient"
          />
          <Typography variant="body2" color="text.secondary">
            Subject: <strong>{preview.subject}</strong>
          </Typography>
        </Stack>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }} data-testid="preview-error">{error}</Alert>}

      {/* The isolated server-render iframe — email HTML in isolation, width-toggled. */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          bgcolor: "grey.100",
          borderRadius: 1,
          p: 2,
          minHeight: 320,
          position: "relative",
        }}
      >
        {loading && (
          <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CircularProgress size={28} />
          </Box>
        )}
        {preview ? (
          <iframe
            title="Email preview"
            srcDoc={preview.html}
            data-testid="preview-iframe"
            style={{
              width: device === "mobile" ? MOBILE_WIDTH : "100%",
              maxWidth: "100%",
              height: 640,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "#fff",
            }}
          />
        ) : (
          !loading && (
            <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
              Render the preview to see the merged email for a real recipient.
            </Typography>
          )
        )}
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* TEST-SEND (BLD-07): prefilled staff email, domain-gated, stats-safe. */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Send a test</Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "flex-start" }}>
        <TextField
          label="Send test to"
          size="small"
          type="email"
          value={testTo}
          onChange={(e) => setTestTo(e.target.value)}
          sx={{ minWidth: 280 }}
          helperText="Prefilled with your email. Test sends never affect campaign stats."
          data-testid="test-send-to"
        />
        <Button
          variant="contained"
          size="small"
          startIcon={sending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
          onClick={handleTestSend}
          disabled={sending || !testTo}
          data-testid="test-send-submit"
          sx={{ mt: { xs: 0, sm: 0.25 } }}
        >
          {sending ? "Sending…" : "Send test"}
        </Button>
      </Stack>

      {domainBlocked && <Alert severity="warning" sx={{ mt: 2 }} data-testid="test-send-domain-blocked">{domainBlocked}</Alert>}
      {sendError && <Alert severity="error" sx={{ mt: 2 }} data-testid="test-send-error">{sendError}</Alert>}
      {sendResult && <Alert severity="success" sx={{ mt: 2 }} data-testid="test-send-success">{sendResult}</Alert>}
    </Box>
  );
};

export default PreviewTestPanel;
