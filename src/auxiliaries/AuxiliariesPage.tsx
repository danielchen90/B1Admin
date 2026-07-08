import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Card, CardContent, Stack, Typography, TextField, InputAdornment, Grid, Button, Divider } from "@mui/material";
import { Search as SearchIcon, Add as AddIcon, Workspaces as AuxIcon } from "@mui/icons-material";
import { PageHeader, UserHelper, Permissions } from "@churchapps/apphelper";
import { type GroupInterface } from "@churchapps/helpers";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuxiliaries } from "../hooks/useAuxiliaries";
import { type AuxiliaryInterface } from "./AuxiliaryInterface";
import { AuxiliaryEdit } from "./components/AuxiliaryEdit";

const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <Box><Typography variant="h6">{value}</Typography><Typography variant="caption" color="text.secondary">{label}</Typography></Box>
);

// Auxiliaries landing: every church-wide auxiliary with its instance/campus/
// member rollup counts. Admins (settings.edit) can create/edit/delete.
export const AuxiliariesPage: React.FC = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const auxiliaries = useAuxiliaries();
  const groupsQuery = useQuery<GroupInterface[]>({ queryKey: ["/groups", "MembershipApi"], placeholderData: [] });
  const canEdit = UserHelper.checkAccess(Permissions.membershipApi.settings.edit);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AuxiliaryInterface | null>(null);

  const statsByAux = useMemo(() => {
    const m = new Map<string, { instances: number; campuses: Set<string>; members: number }>();
    for (const g of groupsQuery.data || []) {
      const id = (g as any).auxiliaryId;
      if (!id) continue;
      if (!m.has(id)) m.set(id, { instances: 0, campuses: new Set(), members: 0 });
      const s = m.get(id)!;
      s.instances++;
      if ((g as any).campusId) s.campuses.add((g as any).campusId);
      s.members += (g as any).memberCount || 0;
    }
    return m;
  }, [groupsQuery.data]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return auxiliaries
      .filter((a) => !t || (a.name || "").toLowerCase().includes(t))
      .sort((a, b) => (statsByAux.get(b.id!)?.instances || 0) - (statsByAux.get(a.id!)?.instances || 0) || (a.name || "").localeCompare(b.name || ""));
  }, [auxiliaries, search, statsByAux]);

  const refresh = () => { setEditing(null); qc.invalidateQueries({ queryKey: ["/auxiliaries", "MembershipApi"] }); };

  return (
    <>
      <PageHeader title="Auxiliaries" subtitle={`${auxiliaries.length} church-wide ${auxiliaries.length === 1 ? "auxiliary" : "auxiliaries"}`}>
        {canEdit && (
          <Button variant="outlined" startIcon={<AddIcon />} sx={{ color: "#FFF", borderColor: "rgba(255,255,255,0.5)", "&:hover": { borderColor: "#FFF", backgroundColor: "rgba(255,255,255,0.1)" } }} onClick={() => setEditing({} as AuxiliaryInterface)}>
            New Auxiliary
          </Button>
        )}
      </PageHeader>

      <Box sx={{ p: 3 }}>
        {editing && <Box sx={{ mb: 3, maxWidth: 560 }}><AuxiliaryEdit auxiliary={editing} updatedFunction={refresh} /></Box>}

        <TextField size="small" placeholder="Search auxiliaries" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ mb: 2, maxWidth: 360 }} fullWidth InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }} />

        <Grid container spacing={2}>
          {filtered.map((a) => {
            const s = statsByAux.get(a.id!) || { instances: 0, campuses: new Set<string>(), members: 0 };
            return (
              <Grid key={a.id} size={{ xs: 12, md: 6, lg: 4 }}>
                <Card variant="outlined" sx={{ height: "100%", cursor: "pointer", "&:hover": { boxShadow: 3 } }} onClick={() => navigate(`/auxiliaries/${a.id}`)}>
                  <CardContent>
                    <Stack direction="row" spacing={1} alignItems="center"><AuxIcon color="primary" /><Typography variant="h6" noWrap>{a.name}</Typography></Stack>
                    {a.description && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }} noWrap>{a.description}</Typography>}
                    <Divider sx={{ my: 1.5 }} />
                    <Stack direction="row" spacing={3}>
                      <Stat label="Campuses" value={s.campuses.size} />
                      <Stat label="Instances" value={s.instances} />
                      <Stat label="Members" value={s.members} />
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
        {filtered.length === 0 && <Typography color="text.secondary">No auxiliaries {search ? `match "${search}"` : "yet"}.</Typography>}
      </Box>
    </>
  );
};
