// GroupedRoster — the right-column, fully-controlled presentational roster for the
// enhanced print-station (Phase 07.1). It renders RosterGroup[] (already ordered,
// de-duped and secondary-sorted by Plan 01) as subsummary buckets: each group gets a
// consistent header (label + CountChip of DISTINCT people + a per-group select-all),
// and each row is an individually checkbox-selectable person (avatar + name link +
// calling/campus badge). Selection is entirely prop-driven (selectedPersonIds owned by
// the parent) so a person appearing in multiple groups toggles everywhere at once —
// this component holds NO internal selection state.
import React from "react";
import { Box, Stack, Typography, Checkbox, Link, Divider, Button } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import GroupsIcon from "@mui/icons-material/Groups";
import { PersonAvatar } from "@churchapps/apphelper";
import { CountChip, EmptyState } from "../../components/ui";
import { type RosterGroup, type RosterRow } from "./rosterTypes";

interface GroupedRosterProps {
  groups: RosterGroup[];
  selectedPersonIds: string[]; // parent-owned selection (union across all groups)
  canSelect: boolean; // canWriteOrdinations gate — hides every selection control when false
  onTogglePerson: (personId: string) => void;
  onToggleGroup: (groupPersonIds: string[]) => void; // per-group select-all / clear
  onToggleAll: (allIds: string[]) => void; // global select-all / clear across the whole filtered roster
}

export const GroupedRoster: React.FC<GroupedRosterProps> = ({ groups, selectedPersonIds, canSelect, onTogglePerson, onToggleGroup, onToggleAll }) => {
  const selected = new Set(selectedPersonIds);
  // Distinct union of every group's personIds — drives the roster-level "select all matching".
  const allIds = Array.from(new Set(groups.flatMap((g) => g.personIds)));
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const hasRows = groups.some((g) => g.rows.length > 0);

  if (groups.length === 0 || !hasRows) {
    return (
      <EmptyState
        variant="card"
        icon={<GroupsIcon />}
        title="No ministers match these filters"
        description="Adjust the location or calling selection to see printable ministers."
      />
    );
  }

  const renderGroupHeader = (group: RosterGroup) => {
    const allGroupSelected = group.personIds.length > 0 && group.personIds.every((id) => selected.has(id));
    return (
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 2, py: 1, backgroundColor: "var(--bg-sub)", borderRadius: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, flexGrow: 1 }}>
          {group.label}
        </Typography>
        <CountChip count={group.personIds.length} />
        {canSelect && (
          <Button size="small" variant="text" onClick={() => onToggleGroup(group.personIds)}>
            {allGroupSelected ? "Clear" : "Select all"}
          </Button>
        )}
      </Stack>
    );
  };

  const renderRow = (row: RosterRow) => (
    <Stack key={row.personId + "|" + row.campusId + "|" + row.ordinationTypeId} direction="row" alignItems="center" spacing={1.5} sx={{ px: 2, py: 0.75 }}>
      {canSelect && (
        <Checkbox
          size="small"
          checked={selected.has(row.personId)}
          onChange={() => onTogglePerson(row.personId)}
          slotProps={{ input: { "aria-label": `Select ${row.displayName}` } }}
        />
      )}
      <PersonAvatar person={row.person} size="medium" />
      <Box sx={{ minWidth: 0 }}>
        <Link
          component={RouterLink}
          to={"/people/" + row.personId}
          sx={{ color: "var(--link)", fontWeight: 500, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
          {row.displayName}
        </Link>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
          {row.callingName}
          {row.campusName ? " · " + row.campusName : ""}
        </Typography>
      </Box>
    </Stack>
  );

  return (
    <Box>
      {canSelect && (
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ px: 2, py: 1, mb: 1, borderBottom: "1px solid var(--border-light)" }}>
          <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
            {allSelected ? "All matching ministers selected" : `${selectedPersonIds.length} of ${allIds.length} selected`}
          </Typography>
          <Button size="small" variant="outlined" onClick={() => onToggleAll(allIds)}>
            {allSelected ? "Clear all" : "Select all matching"}
          </Button>
        </Stack>
      )}
      {groups.map((group, idx) => (
        <Box key={group.key}>
          {renderGroupHeader(group)}
          {group.rows.map((row) => renderRow(row))}
          {idx < groups.length - 1 && <Divider sx={{ my: 1 }} />}
        </Box>
      ))}
    </Box>
  );
};
