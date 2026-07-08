import React, { useState } from "react";
import { Card, Box, Stack, Typography, IconButton, Button } from "@mui/material";
import { WorkspacePremium as PresidentIcon, Delete as DeleteIcon, PersonAdd as AddIcon } from "@mui/icons-material";
import { ApiHelper, PersonHelper } from "@churchapps/apphelper";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PersonAdd } from "../../components";

interface President { id: string; userId: string; auxiliaryId: string; personId?: string; name?: string; email?: string }

// Admin panel to assign/remove auxiliary presidents. A president (a userAuxiliary
// assignment) sees only this auxiliary's members across campuses. Admin-only
// (rendered when the caller has settings.edit; the API also enforces it).
export const AuxiliaryPresidents: React.FC<{ auxiliaryId: string }> = ({ auxiliaryId }) => {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = `/userAuxiliaries/auxiliary/${auxiliaryId}`;
  const q = useQuery<President[]>({ queryKey: [key, "MembershipApi"], placeholderData: [] });
  const presidents = q.data || [];
  const refresh = () => qc.invalidateQueries({ queryKey: [key, "MembershipApi"] });

  const handleAdd = (person: any) => {
    setError(null);
    ApiHelper.post("/userAuxiliaries", { personId: person.id, auxiliaryId }, "MembershipApi")
      .then((r: any) => { if (r?.error) setError(r.error); setAdding(false); refresh(); })
      .catch(() => setError("Could not assign — this person may not have a login account."));
  };
  const handleRemove = (id: string) => { ApiHelper.delete("/userAuxiliaries/" + id, "MembershipApi").then(refresh); };

  return (
    <Card variant="outlined" sx={{ mb: 2, p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" spacing={1} alignItems="center"><PresidentIcon color="primary" /><Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Presidents</Typography></Stack>
        <Button size="small" startIcon={<AddIcon />} onClick={() => { setError(null); setAdding((a) => !a); }}>{adding ? "Cancel" : "Add"}</Button>
      </Stack>
      <Typography variant="caption" color="text.secondary">Presidents see only this auxiliary's members across every campus.</Typography>
      {error && <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>{error}</Typography>}
      {adding && <Box sx={{ my: 1 }}><PersonAdd getPhotoUrl={PersonHelper.getPhotoUrl} addFunction={handleAdd} includeEmail={true} /></Box>}
      <Stack spacing={0.5} sx={{ mt: 1 }}>
        {presidents.length === 0 && !adding && <Typography variant="body2" color="text.secondary">No presidents assigned.</Typography>}
        {presidents.map((p) => (
          <Stack key={p.id} direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2">{p.name || p.email || p.userId}</Typography>
            <IconButton size="small" onClick={() => handleRemove(p.id)} aria-label="remove president"><DeleteIcon fontSize="small" /></IconButton>
          </Stack>
        ))}
      </Stack>
    </Card>
  );
};
