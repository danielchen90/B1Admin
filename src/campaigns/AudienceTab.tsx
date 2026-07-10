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
  Box, Grid, Stack, Chip, Typography, TextField, MenuItem, Alert, Button,
  Card, CardContent, CircularProgress, Divider,
} from "@mui/material";
import GroupsIcon from "@mui/icons-material/Groups";
import { useCampuses } from "../hooks/useCampuses";
import { previewAudience } from "./campaignApi";
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

// The selectable audience types, in the order the dropdown offers them.
const AUDIENCE_TYPES: { value: AudienceDescriptor["type"]; label: string }[] = [
  { value: "church", label: "Whole church" },
  { value: "campus", label: "A campus" },
  { value: "group", label: "A group" },
  { value: "auxiliary", label: "An auxiliary" },
  { value: "people", label: "Specific people" },
];

// Types that resolve from a targetId (campus/group/auxiliary point at one record).
const TARGETED_TYPES: AudienceDescriptor["type"][] = ["campus", "group", "auxiliary"];

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
  const descriptor = React.useMemo(() => parseDescriptor(draft?.audienceFilterJson), [draft?.audienceFilterJson]);

  // A campaign is only editable while it is still a draft (CONTEXT: freely
  // editable UNTIL send). Once frozen/sent the audience is read-only.
  const editable = (draft?.status ?? "draft") === "draft";

  const [preview, setPreview] = React.useState<AudiencePreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewError, setPreviewError] = React.useState("");

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

  // Human-readable summary of the descriptor (BOTH carry types).
  const summary = React.useMemo(() => {
    if (descriptor.type === "people") {
      const n = descriptor.personIds?.length ?? 0;
      return `${n} specific ${n === 1 ? "person" : "people"} selected`;
    }
    const typeLabel = AUDIENCE_TYPES.find((t) => t.value === descriptor.type)?.label ?? descriptor.type;
    if (TARGETED_TYPES.includes(descriptor.type) && descriptor.targetId) {
      // For a campus target we can name it; group/auxiliary ids stay opaque here.
      if (descriptor.type === "campus") {
        const name = campuses.find((c) => c.id === descriptor.targetId)?.name;
        return name ? `Campus: ${name}` : `Campus (${descriptor.targetId})`;
      }
      return `${typeLabel} (${descriptor.targetId})`;
    }
    if (descriptor.filterJson) return `${typeLabel} — filtered`;
    return typeLabel;
  }, [descriptor, campuses]);

  const emit = React.useCallback(
    (next: AudienceDescriptor) => {
      if (!editable) return;
      onChange(next);
    },
    [editable, onChange]
  );

  // Switch the audience type. Dropping to a coarse type clears the now-irrelevant
  // targetId / personIds so the descriptor never carries stale carriers.
  const handleTypeChange = (type: AudienceDescriptor["type"]) => {
    if (type === "people") {
      emit({ type: "people", personIds: descriptor.personIds ?? [] });
    } else if (TARGETED_TYPES.includes(type)) {
      // Preserve a campus target when narrowing from another targeted type.
      const targetId = type === "campus" ? draft?.campusId ?? descriptor.targetId : undefined;
      emit({ type, ...(targetId ? { targetId } : {}) });
    } else {
      emit({ type });
    }
  };

  const handleTargetIdChange = (targetId: string) => {
    emit({ ...descriptor, targetId: targetId || undefined });
  };

  // Clear the explicit-people carry — falls back to an editable whole-church
  // filter the user can then re-scope (broaden/replace).
  const handleClearPeople = () => emit({ type: "church" });

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

              {descriptor.type === "people" ? (
                <Stack spacing={2}>
                  <Typography variant="body2" color="text.secondary">
                    This campaign targets an explicit set of{" "}
                    {(descriptor.personIds?.length ?? 0).toLocaleString()} selected people
                    (still campus-scoped when it sends).
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={!editable}
                    onClick={handleClearPeople}
                    data-testid="audience-clear-people"
                  >
                    Clear selection &amp; pick an audience instead
                  </Button>
                </Stack>
              ) : (
                <Stack spacing={2}>
                  <TextField
                    select
                    label="Send to"
                    size="small"
                    fullWidth
                    value={descriptor.type}
                    disabled={!editable}
                    onChange={(e) => handleTypeChange(e.target.value as AudienceDescriptor["type"])}
                    data-testid="audience-type"
                  >
                    {AUDIENCE_TYPES.map((t) => (
                      <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                    ))}
                  </TextField>

                  {descriptor.type === "campus" && (
                    <TextField
                      select
                      label="Campus"
                      size="small"
                      fullWidth
                      value={descriptor.targetId ?? ""}
                      disabled={!editable}
                      onChange={(e) => handleTargetIdChange(e.target.value)}
                      data-testid="audience-campus"
                    >
                      <MenuItem value="">All campuses in scope</MenuItem>
                      {campuses.map((c) => (
                        <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                      ))}
                    </TextField>
                  )}

                  {(descriptor.type === "group" || descriptor.type === "auxiliary") && (
                    <TextField
                      label={descriptor.type === "group" ? "Group ID" : "Auxiliary ID"}
                      size="small"
                      fullWidth
                      value={descriptor.targetId ?? ""}
                      disabled={!editable}
                      onChange={(e) => handleTargetIdChange(e.target.value)}
                      helperText={`The ${descriptor.type} to send to. Re-resolved to its current members at send.`}
                      data-testid="audience-target-id"
                    />
                  )}

                  <Typography variant="caption" color="text.secondary">
                    Broaden, narrow, or replace the audience any time before you send.
                    The count on the left updates to match.
                  </Typography>
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AudienceTab;
