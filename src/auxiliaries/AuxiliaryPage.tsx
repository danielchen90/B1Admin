import React, { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Box, Card, Stack, Typography, Table, TableBody, TableCell, TableRow, Link, Chip, CircularProgress, Button, FormGroup, FormControlLabel, Checkbox } from "@mui/material";
import { Workspaces as AuxIcon, People as PeopleIcon, Edit as EditIcon, LocationOn as LocationIcon, FilterAlt as FilterIcon } from "@mui/icons-material";
import { ApiHelper, UserHelper, Permissions } from "@churchapps/apphelper";
import { type GroupInterface, type GroupMemberInterface } from "@churchapps/helpers";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageBreadcrumbs, CountChip, ExportButton } from "../components/ui";
import { useCampuses } from "../hooks/useCampuses";
import { type AuxiliaryInterface } from "./AuxiliaryInterface";
import { AuxiliaryEdit } from "./components/AuxiliaryEdit";
import { AuxiliaryPresidents } from "./components/AuxiliaryPresidents";
import { AuxiliaryMemberManager } from "./components/AuxiliaryMemberManager";

interface Rollup { auxiliary: AuxiliaryInterface; instances: GroupInterface[]; members: GroupMemberInterface[] }

const CSV_HEADERS = [
  { label: "Campus", key: "campus" },
  { label: "Name", key: "name" },
  { label: "Leader", key: "leader" },
  { label: "Group", key: "group" },
  { label: "Email", key: "email" }
];

// Auxiliary detail = the cross-campus rollup (fetched from the SCOPED server
// endpoint, so an Auxiliary President only ever gets their own auxiliary's data):
// members of every campus instance grouped by campus, with a full CSV export.
// Admins (settings.edit) can edit/delete the auxiliary and manage its presidents.
export const AuxiliaryPage: React.FC = () => {
  const params = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canEdit = UserHelper.checkAccess(Permissions.membershipApi.settings.edit);
  const [editMode, setEditMode] = useState(false);
  const campuses = useCampuses();
  const cName = useMemo(() => new Map(campuses.map((c) => [c.id, c.name])), [campuses]);
  const [campusFilter, setCampusFilter] = useState<string[]>([]);

  const rollupQuery = useQuery<Rollup>({
    queryKey: [`/auxiliaries/${params.id}/rollup`, "MembershipApi"],
    placeholderData: { auxiliary: {}, instances: [], members: [] }
  });
  const aux = rollupQuery.data?.auxiliary;
  const instances = rollupQuery.data?.instances || [];
  const members = rollupQuery.data?.members || [];
  const gid = useMemo(() => new Map(instances.map((g) => [g.id, g])), [instances]);

  const campusOf = (gm: GroupMemberInterface) => (gid.get(gm.groupId as string) as any)?.campusId || "";
  const byCampusAll = useMemo(() => {
    const m = new Map<string, GroupMemberInterface[]>();
    for (const gm of members) { const cid = campusOf(gm); if (!m.has(cid)) m.set(cid, []); m.get(cid)!.push(gm); }
    return [...m.entries()].sort((a, b) => (cName.get(a[0]) || "Unassigned").localeCompare(cName.get(b[0]) || "Unassigned"));
  }, [members, gid, cName]);

  // Location filter options = campuses that actually have members in this auxiliary.
  const accessibleCampuses = useMemo(() => byCampusAll.map(([cid]) => ({ id: cid, name: cName.get(cid) || "Unassigned" })), [byCampusAll, cName]);
  // Empty selection = show all (matches the ordinations report semantics).
  const displayedByCampus = useMemo(() => (campusFilter.length ? byCampusAll.filter(([cid]) => campusFilter.includes(cid)) : byCampusAll), [byCampusAll, campusFilter]);
  const shownMembers = useMemo(() => displayedByCampus.reduce((n, [, gms]) => n + gms.length, 0), [displayedByCampus]);

  const toggleCampus = (id: string) => setCampusFilter((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  const selectAllCampuses = () => setCampusFilter(accessibleCampuses.map((c) => c.id));
  const clearCampuses = () => setCampusFilter([]);

  const exportData = useMemo(() => displayedByCampus.flatMap(([cid, gms]) => gms.map((gm) => ({
    campus: cName.get(cid) || "Unassigned",
    name: gm.person?.name?.display || "",
    leader: gm.leader ? "Yes" : "",
    group: (gid.get(gm.groupId as string) as any)?.name || "",
    email: gm.person?.contactInfo?.email || ""
  }))), [displayedByCampus, gid, cName]);

  const campusCount = useMemo(() => new Set(instances.map((g) => (g as any).campusId).filter(Boolean)).size, [instances]);
  const refresh = (deleted?: boolean) => {
    setEditMode(false);
    qc.invalidateQueries({ queryKey: ["/auxiliaries", "MembershipApi"] });
    if (deleted) navigate("/auxiliaries");
    else rollupQuery.refetch();
  };

  if (editMode && aux) return <Box sx={{ p: 3, maxWidth: 560 }}><AuxiliaryEdit auxiliary={aux} updatedFunction={refresh} /></Box>;

  return (
    <>
      <PageBreadcrumbs items={[{ label: "Auxiliaries", path: "/auxiliaries" }, { label: aux?.name || "Auxiliary" }]} />
      <Card sx={{ mt: 2, mb: 2 }}>
        <Box sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center"><AuxIcon color="primary" /><Typography variant="h4">{aux?.name}</Typography></Stack>
              {aux?.description && <Typography color="text.secondary" sx={{ mt: 0.5 }}>{aux.description}</Typography>}
              <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
                <Chip icon={<LocationIcon />} variant="outlined" label={`${campusCount} ${campusCount === 1 ? "campus" : "campuses"}`} />
                <Chip icon={<PeopleIcon />} color="primary" label={campusFilter.length ? `${shownMembers} of ${members.length} members` : `${members.length} members`} />
              </Stack>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <ExportButton data={exportData} customHeaders={CSV_HEADERS} filename={`${(aux?.name || "auxiliary").replace(/\s+/g, "-").toLowerCase()}-members.csv`} text="CSV" />
              {canEdit && <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => setEditMode(true)}>Edit</Button>}
            </Stack>
          </Stack>
        </Box>
      </Card>

      <Box sx={{ px: 3, pb: 3 }}>
        {canEdit && params.id && <AuxiliaryPresidents auxiliaryId={params.id} />}

        {params.id && instances.length > 0 && (
          <>
            {!canEdit && <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>You preside over this auxiliary — manage its members below.</Typography>}
            <AuxiliaryMemberManager
              auxiliaryId={params.id}
              instances={instances}
              members={members}
              onChanged={() => qc.invalidateQueries({ queryKey: [`/auxiliaries/${params.id}/rollup`, "MembershipApi"] })}
            />
          </>
        )}

        {accessibleCampuses.length > 1 && (
          <Card variant="outlined" sx={{ mb: 2, p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="row" spacing={1} alignItems="center"><FilterIcon fontSize="small" color="action" /><Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Locations</Typography></Stack>
              <Box>
                <Button size="small" onClick={selectAllCampuses}>All</Button>
                <Button size="small" onClick={clearCampuses} disabled={campusFilter.length === 0}>Clear</Button>
              </Box>
            </Stack>
            <FormGroup row>
              {accessibleCampuses.map((c) => (
                <FormControlLabel key={c.id} control={<Checkbox size="small" checked={campusFilter.includes(c.id)} onChange={() => toggleCampus(c.id)} />} label={c.name} />
              ))}
            </FormGroup>
          </Card>
        )}

        {rollupQuery.isLoading ? (
          <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress /></Box>
        ) : byCampusAll.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 2 }}>No members across this auxiliary's campus instances yet.</Typography>
        ) : displayedByCampus.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 2 }}>No members in the selected locations.</Typography>
        ) : (
          displayedByCampus.map(([cid, gms]) => (
            <Card key={cid || "none"} sx={{ mb: 2 }}>
              <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider", bgcolor: "action.hover" }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <LocationIcon fontSize="small" color="action" />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{cName.get(cid) || "Unassigned"}</Typography>
                  <CountChip count={gms.length} />
                </Stack>
              </Box>
              <Table size="small">
                <TableBody>
                  {gms.map((gm) => (
                    <TableRow key={gm.id} hover>
                      <TableCell><Link component="button" underline="hover" onClick={() => navigate(`/people/${gm.personId}`)}>{gm.person?.name?.display}</Link></TableCell>
                      <TableCell>{gm.leader ? <Chip size="small" label="Leader" color="primary" variant="outlined" /> : null}</TableCell>
                      <TableCell>{gm.person?.contactInfo?.email || ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ))
        )}
      </Box>
    </>
  );
};
