import React, { useMemo, useState } from "react";
import { Card, Box, Stack, Typography, IconButton, Button, Select, MenuItem, FormControl, InputLabel, Table, TableBody, TableCell, TableRow } from "@mui/material";
import { GroupAdd as ManageIcon, Close as RemoveIcon, PersonAdd as AddIcon } from "@mui/icons-material";
import { ApiHelper, PersonHelper } from "@churchapps/apphelper";
import { type GroupInterface, type GroupMemberInterface } from "@churchapps/helpers";
import { PersonAdd } from "../../components";

// Member-management affordance on the auxiliary detail page. A president preside
// over an auxiliary can pick one of its per-campus group instances and add/remove
// members — wired to the strictly-additive president OR-branch on /groupmembers.
// Admins may use it too (they pass the primary Permissions gate server-side).
export const AuxiliaryMemberManager: React.FC<{
  auxiliaryId: string;
  instances: GroupInterface[];
  members: GroupMemberInterface[];
  onChanged: () => void;
}> = ({ auxiliaryId, instances, members, onChanged }) => {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(instances[0]?.id || "");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupMembers = useMemo(() => members.filter((gm) => gm.groupId === selectedGroupId), [members, selectedGroupId]);

  const handleAdd = (person: any) => {
    setError(null);
    if (!selectedGroupId) { setError("Pick a campus group first."); return; }
    ApiHelper.post("/groupmembers", [{ groupId: selectedGroupId, personId: person.id, leader: false }], "MembershipApi")
      .then((r: any) => { if (r?.error) setError(r.error); setAdding(false); onChanged(); })
      .catch(() => setError("Could not add — you may not have access to this group."));
  };
  const handleRemove = (gm: GroupMemberInterface) => {
    ApiHelper.delete("/groupmembers/" + gm.id, "MembershipApi").then(onChanged).catch(() => setError("Could not remove member."));
  };

  return (
    <Card variant="outlined" sx={{ mb: 2, p: 2 }} data-auxiliary-id={auxiliaryId}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" spacing={1} alignItems="center"><ManageIcon color="primary" /><Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Manage Members</Typography></Stack>
        <Button size="small" startIcon={<AddIcon />} disabled={!selectedGroupId} onClick={() => { setError(null); setAdding((a) => !a); }}>{adding ? "Cancel" : "Add member"}</Button>
      </Stack>
      <Typography variant="caption" color="text.secondary">Add or remove members of a campus group in this auxiliary.</Typography>
      {error && <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>{error}</Typography>}

      <FormControl size="small" fullWidth sx={{ mt: 1.5 }}>
        <InputLabel id="aux-member-group-label">Campus group</InputLabel>
        <Select labelId="aux-member-group-label" label="Campus group" value={selectedGroupId} onChange={(e) => { setSelectedGroupId(e.target.value); setAdding(false); }}>
          {instances.map((g) => (<MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>))}
        </Select>
      </FormControl>

      {adding && <Box sx={{ my: 1 }}><PersonAdd getPhotoUrl={PersonHelper.getPhotoUrl} addFunction={handleAdd} includeEmail={true} /></Box>}

      <Table size="small" sx={{ mt: 1 }}>
        <TableBody>
          {groupMembers.length === 0 && (
            <TableRow><TableCell colSpan={2}><Typography variant="body2" color="text.secondary">No members in this group yet.</Typography></TableCell></TableRow>
          )}
          {groupMembers.map((gm) => (
            <TableRow key={gm.id} hover>
              <TableCell>{gm.person?.name?.display || gm.personId}</TableCell>
              <TableCell align="right"><IconButton size="small" onClick={() => handleRemove(gm)} aria-label="remove member"><RemoveIcon fontSize="small" /></IconButton></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};
