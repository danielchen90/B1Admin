import React from "react";
import { useForm } from "react-hook-form";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { ApiHelper } from "@churchapps/apphelper";
import { StatusChip } from "../../components/ui/StatusChip";
import { type PersonOrdinationInterface } from "./PersonOrdinationInterface";
import { allowedNextStatuses, parseApiError } from "../../helpers/OrdinationHelper";

interface Props {
  open: boolean;
  ordination: PersonOrdinationInterface;
  typeName?: string;
  campusName?: string;
  onClose: () => void;
  onChanged: (updated: PersonOrdinationInterface) => void;
  onVersionConflict: () => void;
}

const EM_DASH = "—";
// `type="date"` inputs need a bare YYYY-MM-DD; the API returns full ISO datetimes
// (e.g. 2026-07-17T00:00:00.000Z), which the input silently rejects — leaving the
// field blank. Slice to the date part so existing dates actually pre-populate.
const toDateInput = (v?: string | null): string => (v ? String(v).slice(0, 10) : "");
const fmtDate = (v?: string | null): string => {
  if (!v) return EM_DASH;
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString();
};
const titleCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

type StatusForm = {
  status: string;
  credentialNumber: string;
  grantedDate: string;
  expirationDate: string;
  notes: string;
};

// Edits ONE existing credential's lifecycle. The status options come ONLY from
// allowedNextStatuses (Pitfall 4 — revoked is terminal, so a revoked row offers
// no transitions; re-credentialing is a new issue). Pitfall 5: the row `version`
// is round-tripped — sent on save and refreshed by the parent on conflict — and
// the 200 response is the RELOADED row carrying the server-bumped version, which
// we hand back via onChanged. Pitfall 1: all 409/422 branching is via parseApiError.
export const OrdinationStatusDialog: React.FC<Props> = (props) => {
  const { ordination } = props;
  const options = allowedNextStatuses(ordination?.status ?? "");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState("");

  const { register, handleSubmit, reset, formState } = useForm<StatusForm>({ defaultValues: { status: "", credentialNumber: "", grantedDate: "", expirationDate: "", notes: "" } });
  const e = formState.errors as any;

  React.useEffect(() => {
    if (props.open) {
      reset({
        status: "",
        credentialNumber: ordination?.credentialNumber ?? "",
        grantedDate: toDateInput(ordination?.grantedDate),
        expirationDate: toDateInput(ordination?.expirationDate),
        notes: ordination?.notes ?? ""
      });
      setErrorMsg("");
    }
  }, [props.open, ordination, reset]);

  const onValid = async (values: StatusForm) => {
    setIsSubmitting(true);
    setErrorMsg("");
    try {
      // Pitfall 5: send the row's current version; the response is the reloaded,
      // version-bumped row.
      const updated: PersonOrdinationInterface = await ApiHelper.post("/personOrdinations/" + ordination.id + "/status", {
        status: values.status,
        version: ordination.version,
        credentialNumber: values.credentialNumber || undefined,
        grantedDate: values.grantedDate || undefined,
        expirationDate: values.expirationDate || undefined,
        notes: values.notes || undefined
      }, "MembershipApi");
      props.onChanged(updated);
      props.onClose();
    } catch (err: any) {
      const code = parseApiError(err);
      if (code === "version_conflict") {
        setErrorMsg("This record changed. Reload and try again.");
        props.onVersionConflict();
      } else if (code === "duplicate_active") {
        setErrorMsg("This person already has an active credential of this type.");
      } else if (code === "invalid_transition" || code === "invalid_status") {
        setErrorMsg("That status change isn't allowed.");
      } else {
        setErrorMsg(err?.message || "Something went wrong.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={props.open} onClose={props.onClose} fullWidth scroll="body">
      <DialogTitle>Change Credential Status</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {errorMsg && <Alert severity="error" data-testid="ordination-status-error">{errorMsg}</Alert>}

          {/* Current values — what the user is changing FROM. */}
          <Stack spacing={1} sx={{ bgcolor: "action.hover", borderRadius: 1, p: 1.5 }} data-testid="ordination-status-current">
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography sx={{ fontWeight: 600 }}>{props.typeName || "Credential"}</Typography>
              <StatusChip status={ordination?.status || ""} />
              {props.campusName && <Typography variant="body2" color="text.secondary">{props.campusName}</Typography>}
            </Stack>
            <Typography variant="body2" color="text.secondary" component="div">
              {"Current status: "}<b>{titleCase(ordination?.status || EM_DASH)}</b>
              {"  •  #"}{ordination?.credentialNumber || EM_DASH}
              {"  •  Granted "}{fmtDate(ordination?.grantedDate)}
              {"  •  Expires "}{fmtDate(ordination?.expirationDate)}
            </Typography>
          </Stack>
          <Divider />

          <TextField
            fullWidth
            select
            label="New Status"
            defaultValue=""
            error={!!e.status}
            helperText={e.status?.message ?? (options.length === 0 ? "No status changes are available for this credential." : undefined)}
            disabled={options.length === 0}
            data-testid="ordination-status-select"
            {...register("status", { required: "A new status is required" })}
          >
            {options.map((s) => <MenuItem key={s} value={s}>{titleCase(s)}</MenuItem>)}
          </TextField>
          <TextField fullWidth label="Credential Number" data-testid="ordination-status-credential-number-input" {...register("credentialNumber")} />
          <Stack direction="row" spacing={2}>
            <TextField fullWidth type="date" label="Granted Date" InputLabelProps={{ shrink: true }} data-testid="ordination-status-granted-date-input" {...register("grantedDate")} />
            <TextField fullWidth type="date" label="Expiration Date" InputLabelProps={{ shrink: true }} data-testid="ordination-status-expiration-date-input" {...register("expirationDate")} />
          </Stack>
          <TextField fullWidth multiline rows={2} label="Notes" data-testid="ordination-status-notes-input" {...register("notes")} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={props.onClose} data-testid="ordination-status-cancel-button">Cancel</Button>
        <Button variant="contained" onClick={handleSubmit(onValid)} disabled={isSubmitting || options.length === 0} data-testid="ordination-status-save-button">Save</Button>
      </DialogActions>
    </Dialog>
  );
};
