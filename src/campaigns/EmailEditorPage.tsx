// The campaign composition surface (Plan 12-05 — replaces the 12-04 stub).
//
// Assembles the whole editor: subject + preheader (BLD-04) + name + a
// "Sending as [Campus]" indicator, the Unlayer builder (BLD-01/03/05) inside a
// Design/Audience/Preview tab host (Audience + Preview are 12-07 mount points),
// the template picker (four Huro starters + saved reusable templates — BLD-02),
// a "Save as template" control (BLD-02 save side), and draft persistence via
// useCampaignDraft (autosave + manual Save Draft under OCC — SND-03).
//
// Flow: on /email/new we open the template picker first; picking a starter OR a
// saved template loads it into the builder and the FIRST save creates the draft
// (transitioning the route /new → /:id). Image upload needs a campaign id, so we
// create the draft on the first template pick. Save-as-template captures the
// design straight from the builder and needs NO campaign id.

import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {
  Box, Grid, Stack, Button, TextField, Typography, Chip, Tabs, Tab, Alert, Snackbar, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from "@mui/material";
import DashboardCustomizeIcon from "@mui/icons-material/DashboardCustomize";
import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import SaveIcon from "@mui/icons-material/Save";
import SendIcon from "@mui/icons-material/Send";
import ScheduleIcon from "@mui/icons-material/Schedule";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { PageHeader } from "@churchapps/apphelper";
import { PageBreadcrumbs } from "../components/ui";
import { useCampuses } from "../hooks/useCampuses";
import { useCampaignDraft } from "./useCampaignDraft";
import { freezeAudience, scheduleCampaign, cancelCampaign } from "./campaignApi";
import { parseApiError } from "./apiError";
import { type AudienceDescriptor, type CampaignInterface } from "./emailTypes";
import { SendConfirmDialog } from "./SendConfirmDialog";
import { SendProgress } from "./SendProgress";
import { UnlayerBuilder, type UnlayerBuilderHandle, type UnlayerDesignJson } from "./UnlayerBuilder";
import { TemplatePickerDialog } from "./TemplatePickerDialog";
import { SaveAsTemplateDialog } from "./SaveAsTemplateDialog";
import { AudienceTab } from "./AudienceTab";
import { PreviewTestPanel } from "./PreviewTestPanel";
import { StatsTab } from "./StatsTab";
import { RecipientDrilldown } from "./RecipientDrilldown";

dayjs.extend(utc);
dayjs.extend(timezone);

type EditorTab = "design" | "audience" | "preview" | "stats";

const formatTime = (d: Date) =>
  d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export const EmailEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const campuses = useCampuses();
  const draftApi = useCampaignDraft(id);
  const { draft, loading, saving, lastSavedAt, error, notice, clearNotice, scheduleAutosave, save, reload } = draftApi;

  const builderRef = React.useRef<UnlayerBuilderHandle>(null);
  const [tab, setTab] = React.useState<EditorTab>("design");
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [saveTplOpen, setSaveTplOpen] = React.useState(false);
  // Bumped after a save-as-template so the picker refreshes its list.
  const [pickerRefresh, setPickerRefresh] = React.useState(0);
  // A design captured before the draft exists (queued to load once the builder is ready).
  const pendingDesignRef = React.useRef<UnlayerDesignJson | null>(null);

  // Stats tab drill-down state: a stat card click opens the recipient list
  // pre-filtered to the clicked status.
  const [drillOpen, setDrillOpen] = React.useState(false);
  const [drillStatus, setDrillStatus] = React.useState<string | undefined>(undefined);

  // Send flow (SND-02/06): freeze → confirm → send → live progress. `sendOpen`
  // drives the review dialog; `freezing` guards the freeze round-trip against
  // double-clicks; `sentInitiated` keeps the progress bar visible immediately
  // after send (before the reload flips status to "sending").
  const [sendOpen, setSendOpen] = React.useState(false);
  const [freezing, setFreezing] = React.useState(false);
  const [sentInitiated, setSentInitiated] = React.useState(false);
  // Which mode the review dialog opens in — set by the header's two distinct
  // buttons ("Send now" vs "Schedule for later") so the choice is explicit up
  // front and clicking one never implies the other fires.
  const [dialogMode, setDialogMode] = React.useState<"now" | "later">("now");

  // SND-05 cancel: a clear "Cancel campaign" affordance on the details page for
  // draft/scheduled campaigns, behind a confirm dialog (marking canceled can't be
  // undone). Also the way to clear a leftover frozen-but-unsent campaign.
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [canceling, setCanceling] = React.useState(false);
  const [cancelError, setCancelError] = React.useState("");

  // Success confirmation after a send or schedule commits. Shown as a clear modal,
  // then "Back to campaigns" returns to the list (/email).
  const [successOpen, setSuccessOpen] = React.useState(false);
  const [successKind, setSuccessKind] = React.useState<"sent" | "scheduled">("sent");
  const [successDetail, setSuccessDetail] = React.useState("");

  // The Stats tab is shown only once the campaign has been sent (or is sending) —
  // a draft has no engagement data to report (RESEARCH Pattern 8).
  const showStats = draft?.status === "sent" || draft?.status === "sending";

  // The Send button is offered while the campaign is still send-able (a draft to
  // freeze, or an already-frozen "scheduled" campaign to review + fire).
  const canOfferSend = !!draft?.id && (draft.status === "draft" || draft.status === "scheduled");
  // Cancel is legal only while draft or scheduled (matching the server guard —
  // sending/sent/canceled refuse). Same predicate as canOfferSend today.
  const canCancel = canOfferSend;
  const isScheduled = draft?.status === "scheduled";

  // A live ref to the draft so the send handlers read the latest id/status/version
  // (avoids stale closures across the freeze/reload round-trips).
  const draftRef = React.useRef(draft);
  draftRef.current = draft;

  // On /email/new: open the template picker first (no design yet).
  React.useEffect(() => {
    if (!id) setPickerOpen(true);
  }, [id]);

  // The initial design to hand the builder on mount: the persisted blockJson.
  const initialDesign = React.useMemo<UnlayerDesignJson | undefined>(() => {
    if (!draft?.blockJson) return undefined;
    try {
      return JSON.parse(draft.blockJson) as UnlayerDesignJson;
    } catch {
      return undefined;
    }
  }, [draft?.blockJson]);

  // Resolve the "Sending as" campus name from the accessible campus list.
  const campusName = React.useMemo(() => {
    if (!draft?.campusId) return "All campuses";
    return campuses.find((c) => c.id === draft.campusId)?.name ?? "—";
  }, [campuses, draft?.campusId]);

  // Route a picked design into the builder. If the draft has no id yet, create
  // it first (so image uploads have a namespace) then load the design.
  const applyPickedDesign = React.useCallback(
    async (design: UnlayerDesignJson) => {
      const blockJson = JSON.stringify(design);
      if (!draft?.id) {
        // Persist the picked design as the first save (creates + navigates /:id),
        // and queue the design to load once the builder mounts.
        pendingDesignRef.current = design;
        await save({ blockJson });
      } else {
        builderRef.current?.loadDesign(design);
        scheduleAutosave({ blockJson });
      }
    },
    [draft?.id, save, scheduleAutosave]
  );

  // Once the builder is mounted and a pending design is queued (post-create), load it.
  const handleBuilderExport = React.useCallback(
    (design: UnlayerDesignJson, html: string) => {
      scheduleAutosave({ blockJson: JSON.stringify(design), renderedHtml: html });
    },
    [scheduleAutosave]
  );

  // Manual "Save Draft": flush the builder's current design first, then save immediately.
  const handleSaveDraft = React.useCallback(() => {
    builderRef.current?.captureDesign(({ design, html }) => {
      save({ blockJson: JSON.stringify(design), renderedHtml: html }, { immediate: true });
    });
  }, [save]);

  // Flush the builder's LATEST export + save and resolve once persisted. The
  // Preview & Test panel awaits this before a server preview / test-send so the
  // server renders the CURRENT design (not a stale autosave). If the builder
  // isn't mounted yet we resolve immediately (nothing to flush).
  const ensureExportedAndSaved = React.useCallback((): Promise<void> => {
    const builder = builderRef.current;
    if (!builder) return Promise.resolve();
    return new Promise<void>((resolve) => {
      builder.captureDesign(({ design, html }) => {
        save({ blockJson: JSON.stringify(design), renderedHtml: html }, { immediate: true })
          .catch(() => {}) // errors surface via the draft `error` Alert; don't block preview
          .finally(() => resolve());
      });
    });
  }, [save]);

  // Parse the audience descriptor off a specific campaign row, defaulting to
  // whole-church when empty/unparseable. Fed from the AUTHORITATIVE server row
  // returned by reload() (never a post-await draftRef read).
  const parseAudienceDescriptor = React.useCallback((row: CampaignInterface | null): AudienceDescriptor => {
    const json = row?.audienceFilterJson;
    if (!json) return { type: "church" };
    try {
      const parsed = JSON.parse(json) as AudienceDescriptor;
      if (parsed && typeof parsed.type === "string") return parsed;
    } catch {
      /* fall through to whole-church default */
    }
    return { type: "church" };
  }, []);

  // "Send now" / "Schedule for later" click: flush+save the current design, reload
  // to get the AUTHORITATIVE row, then open the review dialog. The audience is NOT
  // frozen here — the campaign stays a `draft` with an editable audience. The
  // dialog shows a LIVE audience preview (the same resolver freeze uses), and the
  // freeze happens only when the user actually confirms Send/Schedule (handleFreeze
  // below). So closing the dialog after seeing a wrong count leaves the campaign a
  // draft you can go back and re-audience — nothing was committed. (SND-04: freeze
  // at send/schedule confirmation, not before.)
  const handleSendClick = React.useCallback(async (mode: "now" | "later" = "now") => {
    if (!draftRef.current?.id || freezing) return;
    setDialogMode(mode);
    setFreezing(true);
    try {
      // Flush the current design + save so the preview/send renders current content.
      await ensureExportedAndSaved();
      // Pull the authoritative row: fresh id/version/status/audienceFilterJson.
      await reload();
      setSendOpen(true);
    } catch {
      // ensureExportedAndSaved / reload surface their own errors via the draft
      // `error` Alert; don't crash the click.
    } finally {
      setFreezing(false);
    }
  }, [freezing, ensureExportedAndSaved, reload]);

  // Freeze the audience at CONFIRMATION time (the dialog calls this the instant the
  // user commits to Send or Schedule). Flips draft→scheduled under OCC using the
  // fresh row's version + descriptor and materializes the immutable
  // campaignRecipients. Returns the post-freeze version so the caller can drive the
  // subsequent /schedule (which needs expectedVersion) or /send. An already-frozen
  // (scheduled) campaign is a no-op that returns its current version. Errors
  // (409 conflict, etc.) propagate for the dialog to surface — the campaign stays
  // whatever it was, never a half-committed state.
  const handleFreeze = React.useCallback(async (): Promise<number> => {
    const current = draftRef.current;
    if (!current?.id) throw new Error("Campaign not ready.");
    if (current.status === "scheduled") return current.version ?? 0; // already frozen
    const descriptor = parseAudienceDescriptor(current);
    await freezeAudience(current.id, descriptor, current.version ?? 0);
    const fresh = await reload();
    return fresh?.version ?? 0;
  }, [parseAudienceDescriptor, reload]);

  // Confirm dialog fired the send: close it, reload so status reflects "sending",
  // then show a clear success modal. "Back to campaigns" returns to the list.
  const handleSent = React.useCallback(async (recipientCount?: number) => {
    setSendOpen(false);
    setSentInitiated(true);
    await reload();
    const n = recipientCount ?? 0;
    setSuccessKind("sent");
    setSuccessDetail(
      n > 0
        ? `Your email is on its way to ${n.toLocaleString()} ${n === 1 ? "recipient" : "recipients"}.`
        : "Your email is on its way."
    );
    setSuccessOpen(true);
  }, [reload]);

  // "Back to campaigns" from the success modal → the campaigns list.
  const goToList = React.useCallback(() => {
    setSuccessOpen(false);
    navigate("/email");
  }, [navigate]);

  // Confirm dialog chose Schedule-for-later (SND-04). The dialog has just frozen
  // the audience (via onFreeze) and passes the POST-freeze `version` so the
  // /schedule OCC guard matches the now-"scheduled" row. We stamp scheduledAt, then
  // reload (status stays "scheduled", now with scheduledAt) and close the dialog.
  // Errors (422 LEAD_TIME / DOMAIN_UNVERIFIED, 409) propagate for the dialog to
  // surface via its parseApiError mapping — do NOT swallow them here.
  const handleSchedule = React.useCallback(
    async (scheduledAtIso: string, version: number, churchTz: string) => {
      const current = draftRef.current;
      if (!current?.id) return;
      await scheduleCampaign(current.id, scheduledAtIso, version);
      await reload();
      setSendOpen(false);
      const label = dayjs.utc(scheduledAtIso).tz(churchTz).format("MMM D, YYYY h:mm A");
      setSuccessKind("scheduled");
      setSuccessDetail(`It will send on ${label} (${churchTz}).`);
      setSuccessOpen(true);
    },
    [reload]
  );

  // SND-05 — cancel a draft/scheduled campaign (→ canceled) under OCC, then
  // reload so the page reflects the terminal state. A 409 means it already moved
  // on (e.g. the poller claimed it → sending); surface it rather than silently
  // failing. Uses the fresh draftRef version to satisfy the server's OCC guard.
  const handleCancelCampaign = React.useCallback(async () => {
    const current = draftRef.current;
    if (!current?.id || canceling) return;
    setCanceling(true);
    setCancelError("");
    try {
      await cancelCampaign(current.id, current.version ?? 0);
      await reload();
      setCancelOpen(false);
    } catch (err) {
      const body = parseApiError(err);
      if (body.error === "conflict" || body.code === "BAD_STATUS" || body.error === "not_cancelable") {
        setCancelError("This campaign can no longer be canceled — it may already be sending or sent.");
        await reload();
      } else {
        setCancelError(body.error || "Couldn't cancel the campaign.");
      }
    } finally {
      setCanceling(false);
    }
  }, [canceling, reload]);

  // Drain a queued design once the draft (with id) + builder exist.
  React.useEffect(() => {
    if (draft?.id && pendingDesignRef.current) {
      const design = pendingDesignRef.current;
      pendingDesignRef.current = null;
      // Defer so the builder ref is mounted.
      const t = setTimeout(() => builderRef.current?.loadDesign(design), 0);
      return () => clearTimeout(t);
    }
  }, [draft?.id]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <>
      <PageBreadcrumbs
        items={[{ label: "Email", path: "/email" }, { label: draft?.name || (id ? "Edit campaign" : "New campaign") }]}
      />
      <PageHeader title={draft?.name || "Campaign"} subtitle="Design, personalize, and prepare your email." />

      <Box sx={{ p: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* Live send progress (SND-06): visible while the campaign is sending, or
            immediately after firing the send (before the reload flips status). */}
        {draft?.id && (draft.status === "sending" || sentInitiated) && (
          <Box
            sx={{ mb: 2, p: 2, border: 1, borderColor: "divider", borderRadius: 1, bgcolor: "background.paper" }}
            data-testid="send-progress-panel"
          >
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Sending this campaign</Typography>
            <SendProgress campaignId={draft.id} onComplete={() => reload()} />
          </Box>
        )}

        {/* Header row: name + sending-as + save controls + template actions */}
        <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="Campaign name"
              fullWidth
              size="small"
              value={draft?.name ?? ""}
              onChange={(e) => scheduleAutosave({ name: e.target.value })}
              data-testid="campaign-name"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Chip label={`Sending as: ${campusName}`} variant="outlined" data-testid="sending-as-campus" />
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center" flexWrap="wrap">
              <Typography variant="caption" color="text.secondary" data-testid="autosave-status">
                {saving ? "Saving…" : lastSavedAt ? `Saved ${formatTime(lastSavedAt)}` : "Not saved yet"}
              </Typography>
              <Button
                size="small"
                startIcon={<DashboardCustomizeIcon />}
                onClick={() => setPickerOpen(true)}
                data-testid="open-template-picker"
              >
                Templates
              </Button>
              <Button
                size="small"
                startIcon={<BookmarkAddIcon />}
                onClick={() => setSaveTplOpen(true)}
                data-testid="open-save-as-template"
              >
                Save as template
              </Button>
              <Button
                size="small"
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSaveDraft}
                disabled={saving}
                data-testid="save-draft"
              >
                Save Draft
              </Button>
              {canCancel && (
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<BlockIcon />}
                  onClick={() => { setCancelError(""); setCancelOpen(true); }}
                  disabled={freezing || canceling}
                  data-testid="cancel-campaign"
                >
                  {isScheduled ? "Cancel scheduled send" : "Cancel campaign"}
                </Button>
              )}
              {canOfferSend && (
                <Button
                  size="small"
                  variant="outlined"
                  color="primary"
                  startIcon={freezing && dialogMode === "later" ? <CircularProgress size={16} color="inherit" /> : <ScheduleIcon />}
                  onClick={() => handleSendClick("later")}
                  disabled={freezing || canceling}
                  data-testid="schedule-campaign"
                >
                  Schedule for later
                </Button>
              )}
              {canOfferSend && (
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  startIcon={freezing && dialogMode === "now" ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                  onClick={() => handleSendClick("now")}
                  disabled={freezing || canceling}
                  data-testid="send-campaign"
                >
                  {freezing && dialogMode === "now" ? "Preparing…" : "Send now"}
                </Button>
              )}
            </Stack>
          </Grid>
        </Grid>

        {/* Subject + preheader (BLD-04) — merge-field capable (server interprets) */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="Subject"
              fullWidth
              size="small"
              value={draft?.subject ?? ""}
              onChange={(e) => scheduleAutosave({ subject: e.target.value })}
              helperText="Merge fields like {{firstName|Friend}} are supported."
              data-testid="campaign-subject"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="Preview / preheader text"
              fullWidth
              size="small"
              value={draft?.preheader ?? ""}
              onChange={(e) => scheduleAutosave({ preheader: e.target.value })}
              helperText="Shown after the subject in most inboxes."
              data-testid="campaign-preheader"
            />
          </Grid>
        </Grid>

        {/* Tab host: Design (builder) + Audience (12-07) + Preview & Test (12-07) */}
        <Tabs
          value={tab === "stats" && !showStats ? "design" : tab}
          onChange={(_e, v) => setTab(v)}
          sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
        >
          <Tab value="design" label="Design" />
          <Tab value="audience" label="Audience" />
          <Tab value="preview" label="Preview & Test" />
          {/* Stats appears only for sent/sending campaigns (drafts have no data). */}
          {showStats && <Tab value="stats" label="Stats" data-testid="stats-tab-trigger" />}
        </Tabs>

        {/* Design tab — the builder stays mounted; we just hide non-active tabs so
            the editor state (and any in-flight upload) survives tab switches. */}
        <Box sx={{ display: tab === "design" ? "block" : "none" }}>
          <UnlayerBuilder
            ref={builderRef}
            initialDesign={initialDesign}
            campaignId={draft?.id}
            onExport={handleBuilderExport}
            minHeight={640}
          />
        </Box>
        <Box sx={{ display: tab === "audience" ? "block" : "none", py: 4 }}>
          <AudienceTab
            draft={draft}
            onChange={(desc) => scheduleAutosave({ audienceFilterJson: JSON.stringify(desc) })}
          />
        </Box>
        {/* Preview & Test — mounted only while active so switching TO it triggers a
            fresh export+save (via onEnsureSaved) so the server renders current content. */}
        {tab === "preview" && (
          <Box sx={{ py: 4 }}>
            <PreviewTestPanel
              campaignId={draft?.id}
              dirty
              onEnsureSaved={ensureExportedAndSaved}
            />
          </Box>
        )}
        {/* Stats (13-04) — sent/sending only; mounted while active. A stat card
            click opens the pre-filtered recipient drill-down. */}
        {tab === "stats" && showStats && draft?.id && (
          <Box sx={{ py: 4 }}>
            <StatsTab
              campaignId={draft.id}
              onDrill={(s) => {
                setDrillStatus(s);
                setDrillOpen(true);
              }}
            />
          </Box>
        )}
      </Box>

      {/* The stat-card recipient drill-down (mounted regardless of active tab so
          it can open from a Stats card). */}
      {showStats && draft?.id && (
        <RecipientDrilldown
          campaignId={draft.id}
          initialStatus={drillStatus}
          open={drillOpen}
          onClose={() => setDrillOpen(false)}
        />
      )}

      {/* The review & send dialog (SND-02) — opened after a successful freeze (or
          directly for an already-scheduled campaign). onSent hands off to the
          inline SendProgress. */}
      {draft?.id && (
        <SendConfirmDialog
          campaignId={draft.id}
          subject={draft.subject}
          open={sendOpen}
          initialMode={dialogMode}
          descriptor={parseAudienceDescriptor(draft)}
          onFreeze={handleFreeze}
          onClose={() => setSendOpen(false)}
          onSent={handleSent}
          onSchedule={handleSchedule}
        />
      )}

      {/* SND-05 — confirm before canceling a draft/scheduled campaign. */}
      <Dialog open={cancelOpen} onClose={canceling ? undefined : () => setCancelOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{isScheduled ? "Cancel scheduled send?" : "Cancel this campaign?"}</DialogTitle>
        <DialogContent>
          {cancelError && <Alert severity="error" sx={{ mb: 2 }}>{cancelError}</Alert>}
          <DialogContentText>
            {isScheduled
              ? "This campaign is scheduled to send. Canceling stops it — it will not be sent — and marks it canceled. This can’t be undone."
              : "This will mark the campaign canceled and remove it from your active campaigns. This can’t be undone."}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelOpen(false)} disabled={canceling} data-testid="cancel-dialog-keep">
            Keep campaign
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleCancelCampaign}
            disabled={canceling}
            startIcon={canceling ? <CircularProgress size={16} color="inherit" /> : <BlockIcon />}
            data-testid="cancel-dialog-confirm"
          >
            {canceling ? "Canceling…" : isScheduled ? "Cancel send" : "Cancel campaign"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success confirmation after a send/schedule commits → back to the list. */}
      <Dialog open={successOpen} onClose={goToList} maxWidth="xs" fullWidth data-testid="send-success-dialog">
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <CheckCircleIcon color="success" />
            <span>{successKind === "scheduled" ? "Campaign scheduled" : "Campaign is sending"}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>{successDetail}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" color="primary" onClick={goToList} data-testid="success-back-to-list">
            Back to campaigns
          </Button>
        </DialogActions>
      </Dialog>

      <TemplatePickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(design) => applyPickedDesign(design)}
        refreshToken={pickerRefresh}
      />
      <SaveAsTemplateDialog
        open={saveTplOpen}
        onClose={() => setSaveTplOpen(false)}
        captureDesign={(cb) => builderRef.current?.captureDesign(cb)}
        defaultSubject={draft?.subject}
        onSaved={() => setPickerRefresh((n) => n + 1)}
      />

      <Snackbar
        open={!!notice}
        autoHideDuration={6000}
        onClose={clearNotice}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="info" onClose={clearNotice}>{notice}</Alert>
      </Snackbar>
    </>
  );
};

export default EmailEditorPage;
