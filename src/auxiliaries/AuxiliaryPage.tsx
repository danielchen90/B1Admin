import React, { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Box, Card, Stack, Typography, Table, TableBody, TableCell, TableRow, Link, Chip, CircularProgress, Button } from "@mui/material";
import { Workspaces as AuxIcon, People as PeopleIcon, Edit as EditIcon, LocationOn as LocationIcon } from "@mui/icons-material";
import { ApiHelper, UserHelper, Permissions } from "@churchapps/apphelper";
import { type GroupInterface, type GroupMemberInterface } from "@churchapps/helpers";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageBreadcrumbs, CountChip, ExportButton } from "../components/ui";
import { useCampuses } from "../hooks/useCampuses";
import { type AuxiliaryInterface } from "./AuxiliaryInterface";
import { AuxiliaryEdit } from "./components/AuxiliaryEdit";

const CSV_HEADERS = [
  { label: "Campus", key: "campus" },
  { label: "Name", key: "name" },
  { label: "Leader", key: "leader" },
  { label: "Group", key: "group" },
  { label: "Email", key: "email" }
];

// Auxiliary detail = the cross-campus rollup an international president needs:
// members of every campus instance, grouped by campus, with per-campus counts
// and a full CSV export. Admins (settings.edit) can edit/delete the auxiliary.
export const AuxiliaryPage: React.FC = () => {
  const params = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canEdit = UserHelper.checkAccess(Permissions.membershipApi.settings.edit);
  const [editMode, setEditMode] = useState(false);

  const auxQuery = useQuery<AuxiliaryInterface>({ queryKey: [`/auxiliaries/${params.id}`, "MembershipApi"], placeholderData: {} as AuxiliaryInterface });
  const aux = auxQuery.data;
  const campuses = useCampuses();
  const cName = useMemo(() => new Map(campuses.map((c) => [c.id, c.name])), [campuses]);

  const groupsQuery = useQuery<GroupInterface[]>({ queryKey: ["/groups", "MembershipApi"], placeholderData: [] });
  const instances = useMemo(() => (groupsQuery.data || []).filter((g) => (g as any).auxiliaryId === params.id), [groupsQuery.data, params.id]);
  const groupIds = useMemo(() => instances.map((g) => g.id).filter(Boolean) as string[], [instances]);
  const gid = useMemo(() => new Map(instances.map((g) => [g.id, g])), [instances]);

  const membersQuery = useQuery<GroupMemberInterface[]>({
    queryKey: ["auxMembers", params.id, groupIds.join(",")],
    queryFn: () => ApiHelper.get("/groupmembers?groupIds=" + groupIds.join(","), "MembershipApi"),
    enabled: groupIds.length > 0,
    placeholderData: []
  });
  const members = membersQuery.data || [];

  const campusOf = (gm: GroupMemberInterface) => (gid.get(gm.groupId as string) as any)?.campusId || "";
  const byCampus = useMemo(() => {
    const m = new Map<string, GroupMemberInterface[]>();
    for (const gm of members) { const cid = campusOf(gm); if (!m.has(cid)) m.set(cid, []); m.get(cid)!.push(gm); }
    return [...m.entries()].sort((a, b) => (cName.get(a[0]) || "Unassigned").localeCompare(cName.get(b[0]) || "Unassigned"));
  }, [members, gid, cName]);

  const exportData = useMemo(() => members.map((gm) => ({
    campus: cName.get(campusOf(gm)) || "Unassigned",
    name: gm.person?.name?.display || "",
    leader: gm.leader ? "Yes" : "",
    group: (gid.get(gm.groupId as string) as any)?.name || "",
    email: gm.person?.contactInfo?.email || ""
  })), [members, gid, cName]);

  const campusCount = useMemo(() => new Set(instances.map((g) => (g as any).campusId).filter(Boolean)).size, [instances]);
  const refresh = (deleted?: boolean) => {
    setEditMode(false);
    qc.invalidateQueries({ queryKey: ["/auxiliaries", "MembershipApi"] });
    if (deleted) navigate("/auxiliaries");
    else auxQuery.refetch();
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
                <Chip icon={<PeopleIcon />} color="primary" label={`${members.length} members`} />
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
        {membersQuery.isLoading ? (
          <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress /></Box>
        ) : byCampus.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 2 }}>No members across this auxiliary's campus instances yet.</Typography>
        ) : (
          byCampus.map(([cid, gms]) => (
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
