// Save-audience dialog (Plan 18-03, AUD-09 save side).
//
// Captures the campaign Audience tab's CURRENT descriptor and persists it as a
// reusable savedAudience under a user-chosen label. The descriptor is passed in
// (the tab already parses draft.audienceFilterJson), so this dialog needs no
// campaign id — a saved audience is church-wide comms config, not campaign-scoped.
//
// Duplicate blocking is CLIENT-ONLY (18-RESEARCH Pitfall 6 — the SERVER allows
// duplicate labels): on open we fetch the existing saved audiences and block a
// case-insensitive + trimmed label collision before POSTing.
//
// people-type descriptors are NEVER saveable (no personIds column to persist —
// toSaved drops it); the AudienceTab guards the Save button so this dialog only
// ever receives a filter/scope descriptor, but the mapper is safe either way.
//
// apiError codes are surfaced inline (ApiHelper throws raw body strings — parsed
// back via parseApiError).

import React from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Alert, Stack,
} from "@mui/material";
import {
  listSavedAudiences, saveSavedAudience, toSaved, type SavedAudienceRow,
} from "./savedAudience";
import { parseApiError } from "./apiError";
import { type AudienceDescriptor } from "./emailTypes";

export interface SaveAudienceDialogProps {
  open: boolean;
  // The current Audience-tab descriptor to persist (people-type is guarded upstream).
  descriptor: AudienceDescriptor;
  onClose: () => void;
  // Called after a successful save so the parent can refresh any picker list.
  onSaved?: () => void;
}

export const SaveAudienceDialog: React.FC<SaveAudienceDialogProps> = ({
  open, descriptor, onClose, onSaved,
}) => {
  const [name, setName] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  // Existing saved audiences, fetched on open to power client-side dup detection.
  const [existing, setExisting] = React.useState<SavedAudienceRow[]>([]);

  // Reset state + load existing labels each time the dialog opens.
  React.useEffect(() => {
    if (!open) return;
    setName("");
    setError("");
    let active = true;
    listSavedAudiences()
      .then((rows) => {
        if (active) setExisting(rows ?? []);
      })
      .catch(() => {
        // A failed list only weakens client-side dup detection (the save itself
        // still works) — don't block the user, just skip pre-population.
        if (active) setExisting([]);
      });
    return () => {
      active = false;
    };
  }, [open]);

  const handleSave = () => {
    const label = name.trim();
    if (!label) {
      setError("Give this audience a name.");
      return;
    }
    // Case-insensitive + trimmed duplicate block (client-only — the server allows dupes).
    if (existing.some((a) => a.label?.trim().toLowerCase() === label.toLowerCase())) {
      setError("You already have an audience with that name.");
      return;
    }
    setSaving(true);
    setError("");
    // toSaved maps type -> audienceType and DROPS personIds (people-type isn't saveable).
    saveSavedAudience(toSaved(label, descriptor))
      .then(() => {
        setSaving(false);
        onSaved?.();
        onClose();
      })
      .catch((err: unknown) => {
        setSaving(false);
        setError(parseApiError(err).error || "Couldn't save the audience.");
      });
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Save this audience</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Audience name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            autoFocus
            data-testid="audience-name"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving} data-testid="save-audience-confirm">
          {saving ? "Saving…" : "Save audience"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SaveAudienceDialog;
