// PrintTemplateDialog.tsx — the "which template?" step in front of a bulk print batch.
//
// The Leadership Report's "Print Licenses" button opens this first so the operator can
// bulk-print a specific template — a CR80 license OR an 8.5×11 certificate OR any other
// active template — instead of always letting the server auto-pick per ordination type.
//
// Choices:
//   - "Auto — match each person's ordination type" (default) sends NO templateId, so the
//     server keeps its original per-type / global-default auto-selection.
//   - Any ACTIVE template forces EVERY card in the batch onto that one template. The server
//     only requires a cropped photo for templates that actually render one, so a photo-free
//     certificate batch prints for people without a headshot.
//
// Templates are the church-wide vocabulary (useLicenseTemplates, shared cache). Inactive
// templates never appear — they cannot be used for a batch (mirrors the render-time gate).

import React from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, ListItemText, MenuItem, TextField, Typography } from "@mui/material";
import { useLicenseTemplates } from "../../hooks/useLicenseTemplates";
import type { LicenseTemplateInterface, LicenseTemplateLayout } from "../../licenseTemplates/LicenseTemplateInterface";

// Human label for a template's page format, parsed from its serialized layout. Absent /
// unparseable format => "card" (the CR80 back-compat default, matching the renderer).
const formatLabel = (row: LicenseTemplateInterface): string => {
  try {
    const layout = JSON.parse(row.layoutJson || "") as LicenseTemplateLayout;
    const fmt = layout.canvas.format ?? "card";
    if (fmt === "letter-portrait") return "Certificate · 8.5×11 portrait";
    if (fmt === "letter-landscape") return "Certificate · 8.5×11 landscape";
    return "License card · CR80";
  } catch {
    return "License card · CR80";
  }
};

// Sentinel for the "let the server auto-pick" option (an empty templateId).
const AUTO = "";

interface Props {
  open: boolean;
  count: number; // people currently visible (the batch target)
  onClose: () => void;
  onConfirm: (templateId?: string) => void; // undefined => auto (no override)
}

export const PrintTemplateDialog: React.FC<Props> = ({ open, count, onClose, onConfirm }) => {
  const templates = useLicenseTemplates();
  const active = React.useMemo(() => templates.filter((t) => t.active), [templates]);
  const [choice, setChoice] = React.useState<string>(AUTO);

  // Reset to Auto each time the dialog reopens (a stale prior pick must not stick).
  React.useEffect(() => { if (open) setChoice(AUTO); }, [open]);

  const handleConfirm = () => onConfirm(choice === AUTO ? undefined : choice);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Print — choose a template</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {count} {count === 1 ? "person" : "people"} will be printed. Pick which template to use for the whole batch.
        </Typography>
        <TextField
          select
          fullWidth
          size="small"
          label="Template"
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          data-testid="print-template-select"
        >
          <MenuItem value={AUTO}>
            <ListItemText primary="Auto — match each person's ordination type" secondary="Server picks the per-type license (or global default) for each card" />
          </MenuItem>
          {active.map((t) => (
            <MenuItem key={t.id} value={t.id}>
              <ListItemText primary={t.name || "(untitled)"} secondary={formatLabel(t)} />
            </MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleConfirm} disabled={count === 0}>
          Print {count > 0 ? `(${count})` : ""}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
