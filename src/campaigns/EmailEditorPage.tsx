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
import { useParams } from "react-router-dom";
import {
  Box, Grid, Stack, Button, TextField, Typography, Chip, Tabs, Tab, Alert, Snackbar, CircularProgress,
} from "@mui/material";
import DashboardCustomizeIcon from "@mui/icons-material/DashboardCustomize";
import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import SaveIcon from "@mui/icons-material/Save";
import { PageHeader } from "@churchapps/apphelper";
import { PageBreadcrumbs } from "../components/ui";
import { useCampuses } from "../hooks/useCampuses";
import { useCampaignDraft } from "./useCampaignDraft";
import { UnlayerBuilder, type UnlayerBuilderHandle, type UnlayerDesignJson } from "./UnlayerBuilder";
import { TemplatePickerDialog } from "./TemplatePickerDialog";
import { SaveAsTemplateDialog } from "./SaveAsTemplateDialog";
import { AudienceTab } from "./AudienceTab";
import { PreviewTestPanel } from "./PreviewTestPanel";

type EditorTab = "design" | "audience" | "preview";

const formatTime = (d: Date) =>
  d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export const EmailEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const campuses = useCampuses();
  const draftApi = useCampaignDraft(id);
  const { draft, loading, saving, lastSavedAt, error, notice, clearNotice, scheduleAutosave, save } = draftApi;

  const builderRef = React.useRef<UnlayerBuilderHandle>(null);
  const [tab, setTab] = React.useState<EditorTab>("design");
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [saveTplOpen, setSaveTplOpen] = React.useState(false);
  // Bumped after a save-as-template so the picker refreshes its list.
  const [pickerRefresh, setPickerRefresh] = React.useState(0);
  // A design captured before the draft exists (queued to load once the builder is ready).
  const pendingDesignRef = React.useRef<UnlayerDesignJson | null>(null);

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
        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}>
          <Tab value="design" label="Design" />
          <Tab value="audience" label="Audience" />
          <Tab value="preview" label="Preview & Test" />
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
      </Box>

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
