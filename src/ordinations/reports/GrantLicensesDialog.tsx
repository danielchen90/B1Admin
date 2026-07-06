// Confirm dialog for the bulk "Grant Licenses" action (Phase 08). Grants an active license to
// every currently-visible credential. The granted/expiration dates seed from the page-computed
// defaults (next-week Friday → one year minus a day) and are editable local state, reset each
// time the dialog opens. A busy state disables confirm while the batch POST is in flight; errors
// surface inline. This component is presentational — the page owns the ids + the API call.
import React, { useEffect, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, Stack, TextField, Alert, CircularProgress } from "@mui/material";

interface GrantLicensesDialogProps {
  open: boolean;
  count: number;
  defaultGranted: string;
  defaultExpiration: string;
  onClose: () => void;
  onConfirm: (grantedDate: string, expirationDate: string) => Promise<void>;
}

export const GrantLicensesDialog: React.FC<GrantLicensesDialogProps> = ({ open, count, defaultGranted, defaultExpiration, onClose, onConfirm }) => {
  const [granted, setGranted] = useState(defaultGranted);
  const [expiration, setExpiration] = useState(defaultExpiration);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset editable dates + transient state whenever the dialog (re)opens.
  useEffect(() => {
    if (open) {
      setGranted(defaultGranted);
      setExpiration(defaultExpiration);
      setBusy(false);
      setError(null);
    }
  }, [open, defaultGranted, defaultExpiration]);

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(granted, expiration);
    } catch (e: any) {
      setError(e?.message ? String(e.message) : "Failed to grant licenses.");
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Grant Licenses</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          This will grant an active license to {count} visible credential(s).
        </DialogContentText>
        <Stack spacing={2}>
          <TextField
            label="Granted Date"
            type="date"
            value={granted}
            onChange={(e) => setGranted(e.target.value)}
            InputLabelProps={{ shrink: true }}
            disabled={busy}
            fullWidth
          />
          <TextField
            label="Expiration Date"
            type="date"
            value={expiration}
            onChange={(e) => setExpiration(e.target.value)}
            InputLabelProps={{ shrink: true }}
            disabled={busy}
            fullWidth
          />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={busy}
          startIcon={busy ? <CircularProgress size={16} /> : undefined}>
          {busy ? "Granting…" : "Grant"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
