// ReportTable — the right-column grouped/nested on-screen presentation for the leadership
// report (Plan 08-02). Generalizes printStation/GroupedRoster into a MUI <Table> with the 7
// RPT-04 columns: Name, Campus, Ordination(s), Status, Credential #, Granted, Expires. Renders
// nested group headers (primary, then nested sub-group) each with a CountChip of DISTINCT
// people, and an EmptyState when there are no rows. Fully presentational — no data shaping.
import React from "react";
import { Box, Stack, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Link, Checkbox } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import GroupsIcon from "@mui/icons-material/Groups";
import { PersonAvatar } from "@churchapps/apphelper";
import { DateHelper } from "@churchapps/helpers";
import { CountChip, EmptyState, StatusChip } from "../../components/ui";
import { type ReportGroup, type ReportRow } from "./reportTypes";

interface ReportTableProps {
  groups: ReportGroup[];
  onTogglePaid?: (row: ReportRow, next: boolean) => void;
  onToggleExempt?: (row: ReportRow, next: boolean) => void;
}

const COLUMNS = ["Name", "Campus", "Ordination(s)", "Status", "Credential #", "Granted", "Expires", "Paid", "Exempt"];
const COL_COUNT = COLUMNS.length;

// Format a date-only "YYYY-MM-DD" as a LOCAL calendar day (Pitfall 4) then pretty-print.
const formatDate = (value: string | null): string => {
  if (!value) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  return isNaN(d.getTime()) ? "" : DateHelper.prettyDate(d);
};

export const ReportTable: React.FC<ReportTableProps> = ({ groups, onTogglePaid, onToggleExempt }) => {
  const hasRows = groups.some((g) => g.rows.length > 0 || (g.subGroups ?? []).some((s) => s.rows.length > 0));

  if (groups.length === 0 || !hasRows) {
    return (
      <EmptyState
        variant="card"
        icon={<GroupsIcon />}
        title="No credential holders match these filters"
        description="Adjust the campus, ordination type, status, or search to see leaders."
      />
    );
  }

  const renderGroupHeader = (group: ReportGroup, nested: boolean) => (
    <TableRow>
      <TableCell
        colSpan={COL_COUNT}
        sx={{
          backgroundColor: nested ? "var(--bg-sub)" : "var(--bg-sub)",
          borderTop: "1px solid var(--border-light)",
          py: nested ? 0.5 : 1,
          pl: nested ? 4 : 2
        }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant={nested ? "subtitle2" : "subtitle1"} sx={{ fontWeight: 600 }}>
            {group.label}
          </Typography>
          <CountChip count={group.personIds.length} />
        </Stack>
      </TableCell>
    </TableRow>
  );

  const renderRow = (row: ReportRow) => (
    <TableRow key={row.personId + "|" + row.campusId + "|" + row.ordinationTypeId + "|" + row.status} hover>
      <TableCell>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <PersonAvatar person={row.person} size="small" />
          <Link
            component={RouterLink}
            to={"/people/" + row.personId}
            sx={{ color: "var(--link)", fontWeight: 500, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
            {row.displayName}
          </Link>
        </Stack>
      </TableCell>
      <TableCell>{row.campusName}</TableCell>
      <TableCell>{row.ordinationsCell ?? row.callingName}</TableCell>
      <TableCell>{row.status ? <StatusChip status={row.status} /> : null}</TableCell>
      <TableCell>{row.credentialNumber ?? ""}</TableCell>
      <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(row.grantedDate)}</TableCell>
      <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(row.expirationDate)}</TableCell>
      <TableCell padding="checkbox">
        <Checkbox size="small" checked={row.paid} onChange={(e) => onTogglePaid?.(row, e.target.checked)} />
      </TableCell>
      <TableCell padding="checkbox">
        <Checkbox size="small" checked={row.exempt} onChange={(e) => onToggleExempt?.(row, e.target.checked)} />
      </TableCell>
    </TableRow>
  );

  return (
    <Box>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              {COLUMNS.map((c) => (
                <TableCell key={c} sx={{ fontWeight: 600 }}>{c}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {groups.map((group) => (
              <React.Fragment key={group.key}>
                {renderGroupHeader(group, false)}
                {group.subGroups && group.subGroups.length > 0
                  ? group.subGroups.map((sub) => (
                      <React.Fragment key={sub.key}>
                        {renderGroupHeader(sub, true)}
                        {sub.rows.map((row) => renderRow(row))}
                      </React.Fragment>
                    ))
                  : group.rows.map((row) => renderRow(row))}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
