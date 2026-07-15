// Load-saved-audience picker (Plan 18-03, AUD-09 load side).
//
// The pick-only counterpart to SaveAudienceDialog: lists every saved audience so
// an admin can drop one back into the campaign's Audience tab. Administration
// (rename / delete) lives in the Manage page (Plan 04) — this modal ONLY picks.
//
// Each row shows THREE things, all from the shared foundation (Plan 02) so nothing
// is re-derived here:
//   1. label
//   2. summary  — describeAudience(toDescriptor(row), lists): the single source of
//      truth for the human-readable line (its "(targetId)" stale fallback is fine).
//   3. live count — previewAudience(draftId, toDescriptor(row)).deliverableCount,
//      but ONLY when a saved campaign id exists (Pitfall 3 — the preview endpoint is
//      campaign-scoped). A brand-new unsaved draft shows a "save first" hint instead.
//
// A stale target (isTargetStale, RESEARCH Mismatch 1) gets a warning Chip but stays
// SELECTABLE (CONTEXT: do not hide stale entries). Picking a row confirms first,
// then routes the mapped descriptor back through the tab's onChange via onPick.

import React from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Alert, Stack, Chip,
  List, ListItemButton, ListItemText, Typography, CircularProgress, Box,
} from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
  listSavedAudiences, toDescriptor, isTargetStale, type SavedAudienceRow,
} from "./savedAudience";
import { describeAudience, type AudienceLists } from "./describeAudience";
import { previewAudience } from "./campaignApi";
import { type AudienceDescriptor } from "./emailTypes";

export interface LoadAudienceDialogProps {
  open: boolean;
  // The current campaign id, when the draft has been saved. Absent for a brand-new
  // unsaved draft — the live count is skipped in that case (Pitfall 3).
  draftId?: string;
  // The named lists the summary + staleness check resolve against (the SAME lists
  // the Audience tab already loads via useCampuses/useGroups/useAuxiliaries).
  lists: AudienceLists;
  onClose: () => void;
  // Apply the picked audience — routed through the tab's existing onChange.
  onPick: (descriptor: AudienceDescriptor) => void;
}

// Per-row live deliverable count: undefined = not yet loaded / no draft id;
// null = the per-row preview failed (degrade gracefully to summary-only).
type CountState = Record<string, number | null | undefined>;

export const LoadAudienceDialog: React.FC<LoadAudienceDialogProps> = ({
  open, draftId, lists, onClose, onPick,
}) => {
  const [rows, setRows] = React.useState<SavedAudienceRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [counts, setCounts] = React.useState<CountState>({});

  // Load the saved audiences on open, then (if a saved campaign id exists) fetch a
  // live deliverable count per row in parallel — each independently, so one bad
  // preview only blanks that row's count, never the whole list.
  React.useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError("");
    setCounts({});
    listSavedAudiences()
      .then((list) => {
        if (!active) return;
        const safe = list ?? [];
        setRows(safe);
        setLoading(false);
        if (!draftId) return; // no count without a campaign-scoped id (Pitfall 3)
        safe.forEach((row) => {
          if (!row.id) return;
          const rowId = row.id;
          previewAudience(draftId, toDescriptor(row))
            .then((res) => {
              if (active) setCounts((c) => ({ ...c, [rowId]: res.deliverableCount }));
            })
            .catch(() => {
              // Degrade gracefully — show the summary without a count for this row.
              if (active) setCounts((c) => ({ ...c, [rowId]: null }));
            });
        });
      })
      .catch(() => {
        if (active) {
          setError("Couldn't load your saved audiences.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [open, draftId]);

  const handlePick = (row: SavedAudienceRow) => {
    // Confirm before replacing the current audience (window.confirm is sufficient
    // for a pick-only modal; the descriptor is re-previewable and reversible).
    if (!window.confirm("Replace the current audience with this saved one?")) return;
    onPick(toDescriptor(row));
    onClose();
  };

  const renderCount = (row: SavedAudienceRow) => {
    if (!draftId) {
      return (
        <Typography variant="caption" color="text.secondary">
          Save the campaign to see who this reaches.
        </Typography>
      );
    }
    const c = row.id ? counts[row.id] : undefined;
    if (c === undefined) {
      return (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <CircularProgress size={12} />
          <Typography variant="caption" color="text.secondary">Counting…</Typography>
        </Stack>
      );
    }
    if (c === null) {
      return (
        <Typography variant="caption" color="text.secondary">Count unavailable</Typography>
      );
    }
    return (
      <Typography variant="caption" color="text.secondary" data-testid="saved-audience-count">
        {c.toLocaleString()} deliverable
      </Typography>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Load a saved audience</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {loading ? (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 2 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">Loading saved audiences…</Typography>
          </Stack>
        ) : rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            No saved audiences yet. Configure an audience and click Save audience to reuse it later.
          </Typography>
        ) : (
          <List disablePadding data-testid="saved-audience-list">
            {rows.map((row) => {
              const descriptor = toDescriptor(row);
              const stale = isTargetStale(descriptor, lists);
              return (
                <ListItemButton
                  key={row.id ?? row.label}
                  onClick={() => handlePick(row)}
                  alignItems="flex-start"
                  divider
                  data-testid="saved-audience-row"
                >
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle2">{row.label || "Untitled audience"}</Typography>
                        {stale && (
                          <Chip
                            size="small"
                            color="warning"
                            variant="outlined"
                            icon={<WarningAmberIcon />}
                            label="Target unavailable"
                            data-testid="saved-audience-stale"
                          />
                        )}
                      </Stack>
                    }
                    secondary={
                      <Box component="span" sx={{ display: "block" }}>
                        <Typography variant="body2" color="text.secondary" component="span" sx={{ display: "block" }}>
                          {describeAudience(descriptor, lists)}
                        </Typography>
                        <Box component="span" sx={{ display: "block", mt: 0.5 }}>{renderCount(row)}</Box>
                      </Box>
                    }
                  />
                </ListItemButton>
              );
            })}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default LoadAudienceDialog;
