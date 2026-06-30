import React from "react";
import { type OrdinationTypeInterface } from "./OrdinationTypeInterface";
import { Loading } from "@churchapps/apphelper";
import { Box, Button, Card, Grid, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { WorkspacePremium as WorkspacePremiumIcon, Add as AddIcon } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { CountChip, StatusChip } from "../../components/ui";
import { canManageOrdinationTypes } from "../../helpers/OrdinationHelper";
import { OrdinationTypeEdit } from "./OrdinationTypeEdit";

// Church-wide ordination vocabulary admin (list + inline editor). Reads the /all
// endpoint so inactive types are visible/editable by a Leadership Admin. Add/edit
// controls are UX-gated by canManageOrdinationTypes (server still dual-gates).
export const OrdinationTypesSection: React.FC = () => {
  const [editType, setEditType] = React.useState<OrdinationTypeInterface | null>(null);
  const canManage = canManageOrdinationTypes();

  const ordinationTypes = useQuery<OrdinationTypeInterface[]>({
    queryKey: ["/ordinationTypes/all", "MembershipApi"],
    placeholderData: []
  });

  const handleUpdated = () => {
    setEditType(null);
    ordinationTypes.refetch();
  };

  if (ordinationTypes.isLoading) return <Loading />;

  const data = ordinationTypes.data || [];
  const nextSortOrder = data.reduce((max, t) => Math.max(max, t.sortOrder ?? 0), 0) + 1;

  const openEdit = (t: OrdinationTypeInterface) => { if (canManage) setEditType(t); };

  const rows = data.map((t) => (
    <TableRow
      key={t.id}
      sx={{ cursor: canManage ? "pointer" : "default", "&:hover": canManage ? { backgroundColor: "action.hover" } : undefined, transition: "background-color 0.2s ease" }}
      hover={canManage}
      onClick={() => openEdit(t)}
      data-testid={`ordination-type-row-${t.id}`}>
      <TableCell>
        <Stack direction="row" spacing={1} alignItems="center">
          <WorkspacePremiumIcon sx={{ color: "primary.main", fontSize: 20 }} />
          <Typography variant="body2" sx={{ fontWeight: 500 }}>{t.name}</Typography>
        </Stack>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color={t.code ? "text.primary" : "text.secondary"}>{t.code || "—"}</Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.primary">{t.sortOrder ?? "—"}</Typography>
      </TableCell>
      <TableCell>
        <StatusChip status={t.active ? "active" : "inactive"} />
      </TableCell>
    </TableRow>
  ));

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: editType ? 7 : 12 }}>
        <Card sx={{ borderRadius: 2, border: "1px solid", borderColor: "grey.200" }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2, borderBottom: 1, borderColor: "var(--border-light)" }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <WorkspacePremiumIcon sx={{ color: "primary.main", fontSize: 20 }} />
              <Typography variant="h6">Ordination Types</Typography>
              {data.length > 0 && <CountChip count={data.length} />}
            </Stack>
            {canManage && (
              <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => setEditType({ active: true, sortOrder: nextSortOrder })} data-testid="add-ordination-type-button">
                Add
              </Button>
            )}
          </Stack>
          {rows.length > 0 ? (
            <Table>
              <TableHead sx={{ backgroundColor: "var(--bg-sub)" }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Code</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Sort Order</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>{rows}</TableBody>
            </Table>
          ) : (
            <Box sx={{ p: 5, textAlign: "center" }}>
              <WorkspacePremiumIcon sx={{ fontSize: 48, color: "grey.400", mb: 1 }} />
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>No ordination types defined yet.</Typography>
              {canManage && (
                <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setEditType({ active: true, sortOrder: nextSortOrder })} data-testid="add-ordination-type-button-empty">
                  Add
                </Button>
              )}
            </Box>
          )}
        </Card>
      </Grid>
      {editType && canManage && (
        <Grid size={{ xs: 12, md: 5 }}>
          <OrdinationTypeEdit ordinationType={editType} updatedFunction={handleUpdated} />
        </Grid>
      )}
    </Grid>
  );
};
