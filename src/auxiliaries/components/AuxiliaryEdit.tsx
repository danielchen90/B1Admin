import React from "react";
import { TextField } from "@mui/material";
import { useForm } from "react-hook-form";
import { ApiHelper } from "@churchapps/apphelper";
import { FormCard } from "../../components/ui";
import { type AuxiliaryInterface } from "../AuxiliaryInterface";

interface Props {
  auxiliary: AuxiliaryInterface;
  updatedFunction: (deleted?: boolean) => void;
}

type AnyRecord = Record<string, any>;

// Create / edit / delete an auxiliary. Admin-only (the caller gates on
// settings.edit); the API also enforces Settings Edit on write.
export const AuxiliaryEdit: React.FC<Props> = (props) => {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { register, handleSubmit, reset, formState } = useForm<AnyRecord>({ defaultValues: { name: "", description: "" } });
  const e = formState.errors as any;

  React.useEffect(() => {
    reset({ name: props.auxiliary?.name || "", description: props.auxiliary?.description || "" });
  }, [props.auxiliary, reset]);

  const onValid = (values: AnyRecord) => {
    setIsSubmitting(true);
    const auxiliary = { ...props.auxiliary, ...values };
    ApiHelper.post("/auxiliaries", [auxiliary], "MembershipApi").then(() => props.updatedFunction()).finally(() => setIsSubmitting(false));
  };

  const handleDelete = () => {
    if (window.confirm("Delete this auxiliary? Its group instances stay, but lose their auxiliary link.")) {
      ApiHelper.delete("/auxiliaries/" + props.auxiliary.id, "MembershipApi").then(() => props.updatedFunction(true));
    }
  };

  if (!props.auxiliary) return null;

  return (
    <FormCard
      id="auxiliaryBox"
      onCancel={() => props.updatedFunction()}
      onSave={handleSubmit(onValid)}
      onDelete={props.auxiliary?.id ? handleDelete : undefined}
      title={props.auxiliary.name || "New Auxiliary"}
      icon="workspaces"
      isSubmitting={isSubmitting}>
      <TextField fullWidth label="Name" id="name" data-testid="auxiliary-name-input" error={!!e.name} helperText={e.name?.message} {...register("name", { required: "Name is required" })} sx={{ mb: 1 }} />
      <TextField fullWidth multiline minRows={2} label="Description" id="description" {...register("description")} />
    </FormCard>
  );
};
