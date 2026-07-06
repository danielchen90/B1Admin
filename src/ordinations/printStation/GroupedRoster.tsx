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
import { PersonAvatar } from "@churchapps/apphelper";
import { CountChip } from "../../components/ui";
import { type RosterGroup, type RosterRow } from "./rosterTypes";

interface GroupedRosterProps {
  groups: RosterGroup[];
  selectedPersonIds: string[]; // parent-owned selection (union across all groups)
  canSelect: boolean; // canWriteOrdinations gate — hides every selection control when false
  onTogglePerson: (personId: string) => void;
  onToggleGroup: (groupPersonIds: string[]) => void; // per-group select-all / clear
}

export const GroupedRoster: React.FC<GroupedRosterProps> = ({ groups, selectedPersonIds, canSelect, onTogglePerson, onToggleGroup }) => {
  const selected = new Set(selectedPersonIds);

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
