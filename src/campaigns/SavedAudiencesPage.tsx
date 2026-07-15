import React from "react";
import {
  Box, Grid, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Typography, CircularProgress, Alert, Button, Stack,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions
} from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { PageHeader } from "@churchapps/apphelper";
import { PageBreadcrumbs } from "../components/ui";
import { useCampuses } from "../hooks/useCampuses";
import { useGroups } from "../hooks/useGroups";
import { useAuxiliaries } from "../hooks/useAuxiliaries";
import { apiErrorMessage } from "./apiError";
import { describeAudience } from "./describeAudience";
import {
  listSavedAudiences, deleteSavedAudience, toDescriptor, isTargetStale,
  type SavedAudienceRow
} from "./savedAudience";
import { SavedAudienceFilterPanel, type SavedAudienceFilter } from "./SavedAudienceFilterPanel";
import { EditAudienceDialog } from "./EditAudienceDialog";

// The standalone Saved Audiences MANAGE page (Plan 18-04 / AUD-09). Lists every saved
// audience the caller's church scope can see in the standard B1Admin list style: a
// controlled two-facet filter sidebar (audience type + availability) on the left, a
// table of rows on the right. Each row shows its label + a plain-language descriptor
// summary + a stale-target WARNING badge when its saved target no longer resolves
// (RESEARCH Mismatch 1 — a stale row STAYS listed and remains deletable, per CONTEXT).
// Row actions: Edit (rename + re-descriptor via the shared controls) and Delete
// (soft-delete behind a confirm). Both reload the list on success.
export const SavedAudiencesPage: React.FC = () => {
  // The same {campuses, groups, auxiliaries} lists the Audience tab loads — they both
  // NAME targets in the summary and drive staleness detection.
  const campuses = useCampuses();
  const groups = useGroups();
  const auxiliaries = useAuxiliaries();

  const [audiences, setAudiences] = React.useState<SavedAudienceRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [filter, setFilter] = React.useState<SavedAudienceFilter>({ search: "", types: [], availability: [] });

  // The row currently open in the Edit dialog (null = closed).
  const [editing, setEditing] = React.useState<SavedAudienceRow | null>(null);
  // The row pending a delete confirm (null = no confirm open).
  const [deleting, setDeleting] = React.useState<SavedAudienceRow | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  // The lists describeAudience / isTargetStale both consume.
  const lists = React.useMemo(() => ({ campuses, groups, auxiliaries }), [campuses, groups, auxiliaries]);

  const load = React.useCallback(() => {
    setLoading(true);
    listSavedAudiences()
      .then((data) => setAudiences(Array.isArray(data) ? data : []))
      .catch((err: unknown) => setError(apiErrorMessage(err, "Couldn't load saved audiences.")))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    listSavedAudiences()
      .then((data) => {
        if (active) setAudiences(Array.isArray(data) ? data : []);
      })
      .catch((err: unknown) => {
        if (active) setError(apiErrorMessage(err, "Couldn't load saved audiences."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Client-side filter — search over label + AND-across / OR-within facets (the
  // ordination-report behavior, mirroring CampaignListPage's `filtered`).
  const filtered = React.useMemo(() => {
    const q = (filter.search ?? "").trim().toLowerCase();
    return audiences.filter((a) => {
      if (q && !(a.label ?? "").toLowerCase().includes(q)) return false;
      const descriptor = toDescriptor(a);
      // Audience type facet (OR-within, AND-across).
      if (filter.types.length > 0 && !filter.types.includes(descriptor.type)) return false;
      // Availability facet — "stale" iff the target no longer resolves.
      if (filter.availability.length > 0) {
        const stale = isTargetStale(descriptor, lists);
        const bucket = stale ? "stale" : "available";
        if (!filter.availability.includes(bucket)) return false;
      }
      return true;
    });
  }, [audiences, filter, lists]);

  const handleDelete = React.useCallback(async () => {
    if (!deleting?.id) return;
    setError("");
    setDeleteBusy(true);
    try {
      await deleteSavedAudience(deleting.id);
      setDeleting(null);
      load();
    } catch (err: unknown) {
      setError(apiErrorMessage(err, "Couldn't delete this saved audience."));
    } finally {
      setDeleteBusy(false);
    }
  }, [deleting, load]);

  return (
    <>
      <PageBreadcrumbs items={[{ label: "Email", path: "/email" }, { label: "Saved Audiences" }]} />
      <PageHeader title="Saved Audiences" subtitle="Reuse, rename, and manage the audiences you've saved for your campaigns." />
      <Box sx={{ p: 3 }}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 3 }}>
            <SavedAudienceFilterPanel filter={filter} onChange={setFilter} disabled={loading} />
          </Grid>
          <Grid size={{ xs: 12, md: 9 }}>
            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                <CircularProgress size={28} />
              </Box>
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
                    {audiences.length === 0
                      ? "No saved audiences yet. Configure an audience and click Save audience to reuse it later."
                      : "No saved audiences match your filters."}
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              <TableContainer component={Card}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Label</TableCell>
                      <TableCell>Audience</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filtered.map((a) => {
                      const descriptor = toDescriptor(a);
                      const stale = isTargetStale(descriptor, lists);
                      return (
                        <TableRow key={a.id} hover data-testid={`saved-audience-row-${a.id}`}>
                          <TableCell sx={{ fontWeight: 500 }}>{a.label || "(untitled audience)"}</TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="body2" color="text.secondary">
                                {describeAudience(descriptor, lists)}
                              </Typography>
                              {stale && (
                                <Chip
                                  size="small"
                                  color="warning"
                                  icon={<WarningAmberIcon fontSize="small" />}
                                  label="Target missing"
                                  data-testid={`saved-audience-stale-${a.id}`}
                                />
                              )}
                            </Stack>
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                              <Button size="small" onClick={() => setEditing(a)} sx={{ textTransform: "none" }} data-testid={`saved-audience-edit-${a.id}`}>
                                Edit
                              </Button>
                              <Button size="small" color="error" onClick={() => setDeleting(a)} sx={{ textTransform: "none" }} data-testid={`saved-audience-delete-${a.id}`}>
                                Delete
                              </Button>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Grid>
        </Grid>
      </Box>

      {/* Edit dialog — rename + re-descriptor via the shared AudienceDescriptorControls. */}
      {editing && (
        <EditAudienceDialog
          open={!!editing}
          row={editing}
          lists={lists}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      {/* Delete confirm — stale rows are deletable too (never blocked). */}
      <Dialog open={!!deleting} onClose={() => (deleteBusy ? undefined : setDeleting(null))}>
        <DialogTitle>Delete saved audience</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete saved audience &ldquo;{deleting?.label || "(untitled audience)"}&rdquo;? This can&apos;t be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)} disabled={deleteBusy} sx={{ textTransform: "none" }}>Cancel</Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={deleteBusy}
            startIcon={deleteBusy ? <CircularProgress size={14} color="inherit" /> : undefined}
            sx={{ textTransform: "none" }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SavedAudiencesPage;
