import React from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Stack, Alert, CircularProgress, Typography
} from "@mui/material";
import { apiErrorMessage } from "./apiError";
import { type AudienceDescriptor } from "./emailTypes";
import { AudienceDescriptorControls } from "./AudienceDescriptorControls";
import { updateSavedAudience, toDescriptor, toSaved, type SavedAudienceRow } from "./savedAudience";

// Loose named-record shapes matching the hooks' Campus/Group/Auxiliary rows — only
// id + name (+ group categoryName) are read by the descriptor controls / summary.
interface CampusOption { id?: string; name?: string }
interface GroupOption { id?: string; name?: string; categoryName?: string }
interface AuxiliaryOption { id?: string; name?: string }

export interface EditAudienceDialogProps {
  open: boolean;
  row: SavedAudienceRow;
  lists: { campuses: CampusOption[]; groups: GroupOption[]; auxiliaries: AuxiliaryOption[] };
  onClose: () => void;
  onSaved: () => void;
}

// The Saved Audience EDIT dialog (Plan 18-04). Renames + re-descriptors a saved
// audience: a label TextField (prefilled from the row) + the REUSED
// AudienceDescriptorControls (the exact type dropdown + conditional campus/group/
// auxiliary target selects from the Audience tab — CONTEXT: editing reuses the tab's
// controls). On Save it POSTs updateSavedAudience(id, toSaved(label, descriptor)) —
// the Plan-01 POST /:id endpoint (ApiHelper has NO put) — and calls onSaved so the
// page reloads the list. Errors surface inline via parseApiError/apiErrorMessage.
export const EditAudienceDialog: React.FC<EditAudienceDialogProps> = ({ open, row, lists, onClose, onSaved }) => {
  // Local editable state seeded from the row. The descriptor is derived via
  // toDescriptor (wire audienceType -> UI type union, RESEARCH Pitfall 1).
  const [label, setLabel] = React.useState(row.label ?? "");
  const [descriptor, setDescriptor] = React.useState<AudienceDescriptor>(() => toDescriptor(row));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  // Re-seed when a different row opens the dialog.
  React.useEffect(() => {
    setLabel(row.label ?? "");
    setDescriptor(toDescriptor(row));
    setError("");
  }, [row]);

  const handleSave = React.useCallback(async () => {
    const trimmed = label.trim();
    if (!trimmed) {
      setError("Give this saved audience a label.");
      return;
    }
    if (!row.id) {
      setError("This saved audience can't be updated (missing id).");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await updateSavedAudience(row.id, toSaved(trimmed, descriptor));
      onSaved();
    } catch (err: unknown) {
      setError(apiErrorMessage(err, "Couldn't save this audience."));
    } finally {
      setSaving(false);
    }
  }, [label, descriptor, row.id, onSaved]);

  return (
    <Dialog open={open} onClose={() => (saving ? undefined : onClose())} fullWidth maxWidth="sm">
      <DialogTitle>Edit saved audience</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
          <TextField
            label="Label"
            size="small"
            fullWidth
            value={label}
            disabled={saving}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. North Campus leaders"
            data-testid="edit-audience-label"
          />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Audience</Typography>
          <AudienceDescriptorControls
            descriptor={descriptor}
            onChange={setDescriptor}
            campuses={lists.campuses}
            groups={lists.groups}
            auxiliaries={lists.auxiliaries}
            disabled={saving}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
          sx={{ textTransform: "none" }}
          data-testid="edit-audience-save"
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditAudienceDialog;
