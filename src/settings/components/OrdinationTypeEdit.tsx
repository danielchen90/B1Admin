import React from "react";
import { Alert, TextField, FormControlLabel, Switch } from "@mui/material";
import { useForm, Controller } from "react-hook-form";
import { type OrdinationTypeInterface } from "./OrdinationTypeInterface";
import { ApiHelper } from "@churchapps/apphelper";
import { FormCard } from "../../components/ui";
import { parseApiError } from "../../helpers/OrdinationHelper";

interface Props {
  ordinationType: OrdinationTypeInterface;
  updatedFunction: () => void;
}

type AnyRecord = Record<string, any>;

// Church-wide ordination type editor (create/edit/deactivate). All three flows
// route through ONE POST array endpoint — there is no DELETE route for the
// vocabulary, so "Deactivate" simply saves the row with active:false (and
// reactivation is editing + toggling Active back on). churchId is never sent; the
// server overwrites it from the JWT.
export const OrdinationTypeEdit: React.FC<Props> = (props) => {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const { register, handleSubmit, reset, control, formState } = useForm<AnyRecord>({ defaultValues: { name: "", code: "", sortOrder: 0, description: "", active: true } });
  const e = formState.errors as any;
  const summaryErrors: string[] = [];
  if (e.name?.message) summaryErrors.push(e.name.message);
  if (e.code?.message) summaryErrors.push(e.code.message);

  const save = (values: AnyRecord) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    const { churchId, ...rest } = props.ordinationType;
    const merged = { ...rest, ...values, sortOrder: Number(values.sortOrder) || 0 };
    return ApiHelper.post("/ordinationTypes", [merged], "MembershipApi")
      .then(props.updatedFunction)
      .catch((err: any) => { setErrorMessage(parseApiError(err) || err.message); })
      .finally(() => { setIsSubmitting(false); });
  };

  const onValid = (values: AnyRecord) => { save(values); };

  const handleDelete = () => {
    if (window.confirm("Deactivate this ordination type? It will be hidden from new credential issuance but existing records are retained. You can reactivate it later.")) {
      save({ ...props.ordinationType, active: false });
    }
  };

  React.useEffect(() => {
    reset({
      name: props.ordinationType?.name || "",
      code: props.ordinationType?.code || "",
      sortOrder: props.ordinationType?.sortOrder ?? 0,
      description: props.ordinationType?.description || "",
      active: props.ordinationType?.active ?? true
    });
  }, [props.ordinationType, reset]);

  if (props.ordinationType === null) return null;

  return (
    <FormCard
      id="ordinationTypeBox"
      data-testid="ordination-type-box"
      onCancel={props.updatedFunction}
      onSave={handleSubmit(onValid)}
      onDelete={props.ordinationType?.id ? handleDelete : undefined}
      deleteText="Deactivate"
      title={props.ordinationType.name || "Ordination Type"}
      icon="workspace_premium"
      isSubmitting={isSubmitting}
      help="docs/b1-admin/settings/">
      {errorMessage && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage}</Alert>}
      {summaryErrors.length > 0 && <Alert severity="error" sx={{ mb: 2 }}>{summaryErrors.map((msg) => <div key={msg}>{msg}</div>)}</Alert>}
      <TextField fullWidth label="Name" id="name" type="text" data-testid="ordination-type-name-input" error={!!e.name} helperText={e.name?.message} {...register("name", { required: "Name is required" })} sx={{ mb: 1 }} />
      <TextField fullWidth label="Code" id="code" type="text" data-testid="ordination-type-code-input" error={!!e.code} helperText={e.code?.message} {...register("code", { required: "Code is required" })} sx={{ mb: 1 }} />
      <TextField fullWidth label="Sort Order" id="sortOrder" type="number" data-testid="ordination-type-sortorder-input" {...register("sortOrder")} sx={{ mb: 1 }} />
      <TextField fullWidth multiline minRows={2} label="Description" id="description" type="text" data-testid="ordination-type-description-input" {...register("description")} sx={{ mb: 1 }} />
      <Controller
        name="active"
        control={control}
        render={({ field }) => (
          <FormControlLabel control={<Switch checked={!!field.value} onChange={(ev) => field.onChange(ev.target.checked)} data-testid="ordination-type-active-switch" />} label="Active" />
        )}
      />
    </FormCard>
  );
};
