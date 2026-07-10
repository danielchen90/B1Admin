// Save-as-template dialog (Plan 12-05, BLD-02 save side).
//
// Captures the builder's CURRENT design and persists it as a reusable
// emailTemplate (campaignApi.saveAsTemplate → 12-03 Task 4). It asks the builder
// for {design, html} via the passed captureDesign callback (a thin wrapper over
// editor.saveDesign + exportHtml) — this does NOT require a campaign id, so a
// brand-new unsaved campaign can still be saved as a template.
//
// On success the parent refreshes the picker list (onSaved) so the new template
// is immediately reusable. apiError codes are surfaced inline (e.g. a 401 if the
// per-API JWT lacks Campaigns/Send — messaging-campaign-endpoints memory).

import React from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Alert, Stack,
} from "@mui/material";
import { saveAsTemplate } from "./campaignApi";
import { parseApiError } from "./apiError";
import { type CapturedDesign } from "./UnlayerBuilder";

export interface SaveAsTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  // Grabs the builder's current {design, html} on demand (builder.captureDesign).
  captureDesign: (cb: (captured: CapturedDesign) => void) => void;
  // Called after a successful save so the parent can refresh the picker list.
  onSaved?: (created: { id: string; name: string }) => void;
  // Optional seed for the template's subject (e.g. the campaign's current subject).
  defaultSubject?: string;
}

export const SaveAsTemplateDialog: React.FC<SaveAsTemplateDialogProps> = ({
  open, onClose, captureDesign, onSaved, defaultSubject,
}) => {
  const [name, setName] = React.useState("");
  const [subject, setSubject] = React.useState(defaultSubject ?? "");
  const [category, setCategory] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  // Re-seed the subject each time the dialog opens.
  React.useEffect(() => {
    if (open) {
      setSubject(defaultSubject ?? "");
      setError("");
    }
  }, [open, defaultSubject]);

  const handleSave = () => {
    if (!name.trim()) {
      setError("Give the template a name.");
      return;
    }
    setSaving(true);
    setError("");
    // Grab the current design from the builder, then persist it.
    captureDesign(({ design, html }) => {
      saveAsTemplate({
        name: name.trim(),
        subject: subject.trim() || undefined,
        category: category.trim() || undefined,
        blockJson: JSON.stringify(design),
        renderedHtml: html,
      })
        .then((created) => {
          setSaving(false);
          setName("");
          setCategory("");
          onSaved?.(created);
          onClose();
        })
        .catch((err: unknown) => {
          setSaving(false);
          setError(parseApiError(err).error || "Couldn't save the template.");
        });
    });
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Save as template</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Template name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            autoFocus
            data-testid="template-name"
          />
          <TextField
            label="Subject (optional)"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            fullWidth
          />
          <TextField
            label="Category (optional)"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving} data-testid="save-template-confirm">
          {saving ? "Saving…" : "Save template"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SaveAsTemplateDialog;
