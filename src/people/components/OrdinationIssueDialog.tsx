import React from "react";
import { useForm } from "react-hook-form";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from "@mui/material";
import { ApiHelper } from "@churchapps/apphelper";
import { CampusSelect } from "../../components/CampusSelect";
import { useOrdinationTypes } from "../../hooks/useOrdinationTypes";
import { parseApiError } from "../../helpers/OrdinationHelper";

interface Props {
  open: boolean;
  personId: string;
  onClose: () => void;
  onIssued: () => void;
}

type IssueForm = {
  ordinationTypeId: string;
  campusId: string;
  credentialNumber: string;
  grantedDate: string;
  expirationDate: string;
  notes: string;
};

const EMPTY: IssueForm = { ordinationTypeId: "", campusId: "", credentialNumber: "", grantedDate: "", expirationDate: "", notes: "" };

// Shared issue dialog reused by the Person credential tab (Plan 04) and the Nav
// hub (Plan 05). Issuing always creates a PENDING credential (server default), so
// we never send `status`; `version`/`activeFlag` are server-owned and never sent.
// Pitfall 1: ApiHelper discards the HTTP status, so duplicate-active is classified
// via parseApiError (the JSON `error` code), never an HTTP status read.
export const OrdinationIssueDialog: React.FC<Props> = (props) => {
  const allTypes = useOrdinationTypes();
  const activeTypes = allTypes.filter((t) => t.active); // only active types are issuable
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState("");

  const { register, control, handleSubmit, reset, formState } = useForm<IssueForm>({ defaultValues: EMPTY });
  const e = formState.errors as any;

  React.useEffect(() => {
    if (props.open) { reset(EMPTY); setErrorMsg(""); }
  }, [props.open, reset]);

  const onValid = async (values: IssueForm) => {
    setIsSubmitting(true);
    setErrorMsg("");
    try {
      await ApiHelper.post("/personOrdinations", {
        personId: props.personId,
        ordinationTypeId: values.ordinationTypeId,
        campusId: values.campusId || undefined,
        credentialNumber: values.credentialNumber || undefined,
        grantedDate: values.grantedDate || undefined, // omit empty date strings
        expirationDate: values.expirationDate || undefined,
        notes: values.notes || undefined
      }, "MembershipApi");
      props.onIssued();
      props.onClose();
    } catch (err: any) {
      const code = parseApiError(err);
      if (code === "duplicate_active") setErrorMsg("This person already has an active credential of this type.");
      else setErrorMsg(err?.message || "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={props.open} onClose={props.onClose} fullWidth scroll="body">
      <DialogTitle>Issue Credential</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {errorMsg && <Alert severity="error" data-testid="ordination-issue-error">{errorMsg}</Alert>}
          <TextField
            fullWidth
            select
            label="Credential Type"
            defaultValue=""
            error={!!e.ordinationTypeId}
            helperText={e.ordinationTypeId?.message}
            data-testid="ordination-type-select"
            {...register("ordinationTypeId", { required: "Credential type is required" })}
          >
            {activeTypes.map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
          </TextField>
          <CampusSelect control={control} label="Campus" testId="ordination-campus-select" />
          <TextField fullWidth label="Credential Number" data-testid="ordination-credential-number-input" {...register("credentialNumber")} />
          <Stack direction="row" spacing={2}>
            <TextField fullWidth type="date" label="Granted Date" InputLabelProps={{ shrink: true }} data-testid="ordination-granted-date-input" {...register("grantedDate")} />
            <TextField fullWidth type="date" label="Expiration Date" InputLabelProps={{ shrink: true }} data-testid="ordination-expiration-date-input" {...register("expirationDate")} />
          </Stack>
          <TextField fullWidth multiline rows={2} label="Notes" data-testid="ordination-notes-input" {...register("notes")} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={props.onClose} data-testid="ordination-issue-cancel-button">Cancel</Button>
        <Button variant="contained" onClick={handleSubmit(onValid)} disabled={isSubmitting} data-testid="ordination-issue-save-button">Issue</Button>
      </DialogActions>
    </Dialog>
  );
};
