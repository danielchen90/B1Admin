import React, { useMemo, useState } from "react";
import { Box, Card, Stack, Typography, TextField, InputAdornment, Table, TableBody, TableCell, TableHead, TableRow, CircularProgress, Link, Chip } from "@mui/material";
import { Search as SearchIcon, Groups as GroupsIcon } from "@mui/icons-material";
import { type GroupInterface } from "@churchapps/helpers";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { CountChip } from "../../components/ui";
import { type CampusInterface } from "../../settings/components/CampusInterface";

// Groups tab: the groups scoped to this campus (group.campusId === campus.id).
// Each links to the existing GroupPage. Phase 1 of the campus-groups work —
// once the Program structure lands, these instances roll up under their program.
export const CampusGroups: React.FC<{ campus?: CampusInterface }> = ({ campus }) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const groupsQuery = useQuery<GroupInterface[]>({ queryKey: ["/groups", "MembershipApi"], placeholderData: [] });

  const campusGroups = useMemo(() => {
    const all = (groupsQuery.data || []).filter((g) => (g as any).campusId === campus?.id);
    const term = search.trim().toLowerCase();
    const filtered = term ? all.filter((g) => (g.name || "").toLowerCase().includes(term)) : all;
    return filtered.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [groupsQuery.data, campus?.id, search]);

  const totalMemberships = useMemo(() => campusGroups.reduce((s, g) => s + ((g as any).memberCount || 0), 0), [campusGroups]);

  return (
    <Box sx={{ p: 3 }}>
      <Card>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ sm: "center" }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <GroupsIcon color="primary" />
              <Typography variant="h6">Groups</Typography>
              <CountChip count={campusGroups.length} />
              {totalMemberships > 0 && <Chip size="small" variant="outlined" label={`${totalMemberships} memberships`} />}
            </Stack>
            <TextField size="small" placeholder="Filter by name" value={search} onChange={(e) => setSearch(e.target.value)} InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }} />
          </Stack>
        </Box>

        {groupsQuery.isLoading ? (
          <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress /></Box>
        ) : campusGroups.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center", color: "text.secondary" }}>No groups {search ? "match your filter" : "scoped to this campus"}.</Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Group</TableCell>
                <TableCell>Meeting</TableCell>
                <TableCell align="right">Members</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {campusGroups.map((g) => (
                <TableRow key={g.id} hover sx={{ cursor: "pointer" }} onClick={() => navigate(`/groups/${g.id}`)}>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Link component="button" underline="hover" onClick={(e) => { e.stopPropagation(); navigate(`/groups/${g.id}`); }}>{g.name}</Link>
                      {g.categoryName && <Chip size="small" label={g.categoryName} variant="outlined" />}
                    </Stack>
                  </TableCell>
                  <TableCell>{[g.meetingTime, g.meetingLocation].filter(Boolean).join(" · ") || "—"}</TableCell>
                  <TableCell align="right"><CountChip count={(g as any).memberCount || 0} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </Box>
  );
};
