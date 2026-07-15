// The dedicated Audience tab (Plan 12-07, BLD-03 audience half).
//
// 12-CONTEXT locks two things this component honors:
//   1. The audience is ALWAYS referable — a dedicated tab that renders the
//      carried-in descriptor human-readably (BOTH carry types: a filter
//      descriptor { type, targetId?, filterJson? } OR the explicit-people carry
//      { type:"people", personIds:[...] } from 12-02/12-08).
//   2. The audience is FREELY EDITABLE until send — the user can broaden /
//      narrow / replace it while the campaign is a draft; once status !== draft
//      the audience is frozen (read-only).
//
// The resolved count + skipped/suppressed breakdown come from the SAME resolver
// the freeze uses (campaignApi.previewAudience → CampaignAudienceController
// /audience/preview), so what the user sees here is what will actually send. The
// descriptor is POSTed live, so an unsaved edit re-previews immediately.
//
// Edit affordance: the audience type is a dropdown (church / campus / group /
// auxiliary / explicit-people). Switching to a scope re-targets; a "targetId"
// field lets the user point at a specific campus/group/auxiliary; the explicit-
// people set is shown with a "clear selection" control (dropping it falls back to
// an editable filter). Every change routes through onChange(descriptor), which
// the page persists via scheduleAutosave({ audienceFilterJson }). Full roster/
// report picker richness is intentionally out of scope here — the MUST is that
// the audience is VISIBLE, COUNTED, and EDITABLE (not read-only).

import React from "react";
import {
  Box, Grid, Stack, Chip, Typography, Alert,
  Card, CardContent, CircularProgress, Divider,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer, TablePagination,
} from "@mui/material";
import GroupsIcon from "@mui/icons-material/Groups";
import { useCampuses } from "../hooks/useCampuses";
import { useGroups } from "../hooks/useGroups";
import { useAuxiliaries } from "../hooks/useAuxiliaries";
import { previewAudience } from "./campaignApi";
import { describeAudience } from "./describeAudience";
import { AudienceDescriptorControls } from "./AudienceDescriptorControls";
import { type AudienceDescriptor, type AudiencePreviewResult, type CampaignInterface } from "./emailTypes";
import { apiErrorMessage } from "./apiError";

export interface AudienceTabProps {
  // The current draft — we read its audienceFilterJson descriptor, campusId, id,
  // and status. Null while the draft is still loading.
  draft: CampaignInterface | null;
  // Persist a new descriptor (the page routes this into
  // scheduleAutosave({ audienceFilterJson: JSON.stringify(descriptor) })).
  onChange: (descriptor: AudienceDescriptor) => void;
}

// AUDIENCE_TYPES + TARGETED_TYPES now live in AudienceDescriptorControls (the
// single source both the tab and the manage editor share).

// Parse the stored audienceFilterJson into a descriptor, defaulting to whole-church
// when absent/unparseable so the tab always has an editable starting point.
function parseDescriptor(json?: string): AudienceDescriptor {
  if (!json) return { type: "church" };
  try {
    const parsed = JSON.parse(json) as AudienceDescriptor;
    if (parsed && typeof parsed.type === "string") return parsed;
  } catch {
    /* fall through to the default */
  }
  return { type: "church" };
}

export const AudienceTab: React.FC<AudienceTabProps> = ({ draft, onChange }) => {
  const campuses = useCampuses();
  const groups = useGroups();
  const auxiliaries = useAuxiliaries();
  const descriptor = React.useMemo(() => parseDescriptor(draft?.audienceFilterJson), [draft?.audienceFilterJson]);

  // A campaign is only editable while it is still a draft (CONTEXT: freely
  // editable UNTIL send). Once frozen/sent the audience is read-only.
  const editable = (draft?.status ?? "draft") === "draft";

  const [preview, setPreview] = React.useState<AudiencePreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewError, setPreviewError] = React.useState("");

  // Recipient-list pagination so users can page through EVERY recipient, not just
  // the first screenful. Reset to page 0 whenever the resolved list changes.
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(25);
  const recipients = preview?.recipients ?? [];
  React.useEffect(() => {
    setPage(0);
  }, [recipients.length, descriptor]);

  const campusName = React.useMemo(() => {
    if (!draft?.campusId) return "All campuses";
    return campuses.find((c) => c.id === draft.campusId)?.name ?? "—";
  }, [campuses, draft?.campusId]);

  // Resolve the deliverable/skipped/suppressed counts for the current descriptor.
  // Re-runs whenever the descriptor changes (an edit re-previews live). Needs a
  // saved campaign id (the endpoint is scoped by campaign); a brand-new unsaved
  // draft shows a "save first" hint instead.
  React.useEffect(() => {
    const id = draft?.id;
    if (!id) return;
    let active = true;
    setPreviewLoading(true);
    setPreviewError("");
    previewAudience(id, descriptor)
      .then((res) => {
        if (active) setPreview(res);
      })
      .catch((err: unknown) => {
        if (active) {
          setPreview(null);
          setPreviewError(apiErrorMessage(err, "Couldn't resolve this audience."));
        }
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });
    return () => {
      active = false;
    };
  }, [draft?.id, descriptor]);

  // Human-readable summary of the descriptor (BOTH carry types). Delegated to the
  // shared describeAudience helper (16-03) so the editable tab and the locked
  // Phase-16 record view render the SAME summary from ONE source of truth.
  const summary = React.useMemo(
    () => describeAudience(descriptor, { campuses, groups, auxiliaries }),
    [descriptor, campuses, groups, auxiliaries]
  );

  // Emit a descriptor change. Guards editability (frozen campaigns are read-only)
  // and preserves the campus-target default: when the controls switch to a fresh
  // campus type with no targetId, seed it from the draft's campusId (the behavior
  // that used to live in the tab's handleTypeChange — kept here because it needs
  // draft.campusId, which the presentational controls don't know about).
  const emit = React.useCallback(
    (next: AudienceDescriptor) => {
      if (!editable) return;
      if (next.type === "campus" && !next.targetId && draft?.campusId) {
        onChange({ ...next, targetId: draft.campusId });
        return;
      }
      onChange(next);
    },
    [editable, onChange, draft?.campusId]
  );

  return (
    <Box data-testid="audience-tab">
      {!editable && (
        <Alert severity="info" sx={{ mb: 2 }}>
          This campaign is no longer a draft, so its audience is frozen and can&rsquo;t be changed.
        </Alert>
      )}

      <Grid container spacing={2}>
        {/* Left: the descriptor summary + resolved count + breakdown. */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <GroupsIcon color="action" fontSize="small" />
                <Typography variant="subtitle2">Current audience</Typography>
              </Stack>
              <Typography variant="body1" data-testid="audience-summary">{summary}</Typography>
              <Chip
                size="small"
                variant="outlined"
                label={`Sending as: ${campusName}`}
                sx={{ mt: 1 }}
                data-testid="audience-sending-as"
              />

              <Divider sx={{ my: 2 }} />

              {!draft?.id ? (
                <Typography variant="body2" color="text.secondary">
                  Save the campaign to resolve how many people this audience reaches.
                </Typography>
              ) : previewLoading ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={18} />
                  <Typography variant="body2" color="text.secondary">Resolving audience…</Typography>
                </Stack>
              ) : previewError ? (
                <Alert severity="warning" data-testid="audience-preview-error">{previewError}</Alert>
              ) : preview ? (
                <Stack spacing={0.5} data-testid="audience-counts">
                  <Typography variant="h6" data-testid="audience-deliverable">
                    {preview.deliverableCount.toLocaleString()} deliverable
                  </Typography>
                  <Typography variant="body2" color="text.secondary" data-testid="audience-skipped">
                    {preview.skippedNoEmailCount.toLocaleString()} skipped (missing / invalid email)
                  </Typography>
                  <Typography variant="body2" color="text.secondary" data-testid="audience-suppressed">
                    {preview.suppressedCount.toLocaleString()} suppressed (unsubscribed / bounced)
                  </Typography>
                </Stack>
              ) : null}
            </CardContent>
          </Card>
        </Grid>

        {/* Right: the edit affordance — broaden / narrow / replace before send. */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>Edit audience</Typography>

              <AudienceDescriptorControls
                descriptor={descriptor}
                onChange={emit}
                campuses={campuses}
                groups={groups}
                auxiliaries={auxiliaries}
                disabled={!editable}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Full-width: the exact list of people this campaign will be sent to.
            Populated from the SAME resolver the freeze uses, for ANY audience type
            (church / campus / group / auxiliary / explicit people). */}
        <Grid size={{ xs: 12 }}>
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <GroupsIcon color="action" fontSize="small" />
                <Typography variant="subtitle2">
                  Recipients{preview ? ` (${preview.deliverableCount.toLocaleString()})` : ""}
                </Typography>
              </Stack>

              {!draft?.id ? (
                <Typography variant="body2" color="text.secondary">
                  Save the campaign to see who it will be sent to.
                </Typography>
              ) : previewLoading ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={18} />
                  <Typography variant="body2" color="text.secondary">Resolving recipients…</Typography>
                </Stack>
              ) : previewError ? (
                <Alert severity="warning">{previewError}</Alert>
              ) : preview && preview.recipients && recipients.length > 0 ? (
                <Box data-testid="audience-recipient-list">
                  <TableContainer sx={{ maxHeight: 440 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>Name</TableCell>
                          <TableCell>Email</TableCell>
                          <TableCell>Campus</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {recipients
                          .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                          .map((r) => (
                            <TableRow key={r.personId} hover>
                              <TableCell>{r.name}</TableCell>
                              <TableCell>{r.email}</TableCell>
                              <TableCell>{r.campusName || "—"}</TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <TablePagination
                    component="div"
                    count={recipients.length}
                    page={page}
                    onPageChange={(_e, p) => setPage(p)}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={(e) => {
                      setRowsPerPage(parseInt(e.target.value, 10));
                      setPage(0);
                    }}
                    rowsPerPageOptions={[25, 50, 100, 250]}
                  />
                </Box>
              ) : preview && !preview.recipients ? (
                <Typography variant="body2" color="text.secondary">
                  This deployment doesn&rsquo;t return the recipient list yet — {preview.deliverableCount.toLocaleString()} deliverable.
                </Typography>
              ) : descriptor.type === "people" && (descriptor.personIds?.length ?? 0) === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No people selected yet. Use &ldquo;Email these people&rdquo; from the People or
                  Leadership Report page to pick a specific set, or choose a different audience type.
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No deliverable recipients for this audience.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AudienceTab;
