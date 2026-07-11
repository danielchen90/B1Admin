// The stat-card recipient drill-down (Plan 13-04, TRK-03).
//
// A MUI Dialog opened when the operator clicks a Stats-tab card. It lists the
// recipients for the clicked status via campaignApi.getCampaignRecipients and
// lets the operator jump to the B1Admin person record.
//
//   PRE-FILTER: opens seeded from `initialStatus` (the clicked card's status) and
//   re-fetches from the server whenever that active status changes. An inline
//   status Select (delivered/opened/clicked/bounced/complained/unsubscribed/all —
//   CONTEXT lock: inline filters ONLY, NOT the left-sidebar CampaignListFilterPanel)
//   plus a client-side name/email search TextField refine the list.
//
//   PERSON DEEP-LINK (RESEARCH Pattern 9): the recipient's Name links to
//   /people/:personId in a NEW browser tab WHEN personId is present; an ad-hoc
//   address (no personId) renders as plain text. target="_blank" + rel="noopener"
//   so the person record opens without losing the operator's place on Stats.

import React from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, TextField,
  MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Typography, Alert, CircularProgress, Box, Link, Chip,
} from "@mui/material";
import { getCampaignRecipients } from "./campaignApi";
import { type RecipientRow } from "./emailTypes";
import { parseApiError } from "./apiError";

export interface RecipientDrilldownProps {
  campaignId: string;
  // The status the clicked card maps to — seeds the filter on open.
  initialStatus?: string;
  open: boolean;
  onClose: () => void;
}

// The inline status filter options. "all" clears the server-side status filter.
const STATUS_OPTIONS = [
  { value: "all", label: "All recipients" },
  { value: "delivered", label: "Delivered" },
  { value: "opened", label: "Opened" },
  { value: "clicked", label: "Clicked" },
  { value: "bounced", label: "Bounced" },
  { value: "complained", label: "Complained" },
  { value: "unsubscribed", label: "Unsubscribed" },
  { value: "sent", label: "Sent" },
];

// Render a stamp as a short local date-time, or a dash when absent.
const formatStamp = (s?: string): string => {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

export const RecipientDrilldown: React.FC<RecipientDrilldownProps> = ({
  campaignId,
  initialStatus,
  open,
  onClose,
}) => {
  const [activeStatus, setActiveStatus] = React.useState<string>(initialStatus || "all");
  const [search, setSearch] = React.useState("");
  const [rows, setRows] = React.useState<RecipientRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  // Re-seed the filter to the clicked card's status each time the dialog opens.
  React.useEffect(() => {
    if (open) {
      setActiveStatus(initialStatus || "all");
      setSearch("");
    }
  }, [open, initialStatus]);

  const load = React.useCallback(async () => {
    if (!campaignId || !open) return;
    setLoading(true);
    setError("");
    try {
      const statusParam = activeStatus === "all" ? undefined : activeStatus;
      const res = await getCampaignRecipients(campaignId, statusParam);
      setRows(res);
    } catch (err: unknown) {
      const body = parseApiError(err);
      setError(body.error || "Couldn't load recipients.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [campaignId, open, activeStatus]);

  // Fetch on open and whenever the active status changes.
  React.useEffect(() => {
    load();
  }, [load]);

  // Client-side name/email search over the server-filtered rows.
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.name?.toLowerCase().includes(q) || r.email?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth data-testid="recipient-drilldown">
      <DialogTitle>Recipients</DialogTitle>
      <DialogContent dividers>
        {/* Inline filters ONLY — status Select + name/email search. */}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }}>
          <TextField
            select
            size="small"
            label="Status"
            value={activeStatus}
            onChange={(e) => setActiveStatus(e.target.value)}
            sx={{ minWidth: 200 }}
            data-testid="drilldown-status-filter"
          >
            {STATUS_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Search name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flex: 1, minWidth: 220 }}
            data-testid="drilldown-search"
          />
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2 }} data-testid="drilldown-error">{error}</Alert>}

        <Box sx={{ position: "relative", minHeight: 120 }}>
          {loading && (
            <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>
              <CircularProgress size={28} />
            </Box>
          )}
          <TableContainer component={Paper} variant="outlined">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Opened</TableCell>
                  <TableCell>Clicked</TableCell>
                  <TableCell>Last activity</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length > 0 ? (
                  filtered.map((r) => (
                    <TableRow key={r.id} data-testid={`recipient-row-${r.id}`}>
                      <TableCell>
                        {r.personId ? (
                          <Link
                            component={RouterLink}
                            to={`/people/${r.personId}`}
                            target="_blank"
                            rel="noopener"
                            data-testid={`recipient-person-link-${r.id}`}
                          >
                            {r.name}
                          </Link>
                        ) : (
                          <Typography component="span" variant="body2">{r.name}</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ wordBreak: "break-all" }}>{r.email}</TableCell>
                      <TableCell>
                        <Chip size="small" variant="outlined" label={r.status} />
                      </TableCell>
                      <TableCell>{formatStamp(r.openedAt)}</TableCell>
                      <TableCell>{formatStamp(r.clickedAt)}</TableCell>
                      <TableCell>{formatStamp(r.lastActivity)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  !loading && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography variant="body2" color="text.secondary" data-testid="drilldown-empty">
                          No recipients match this filter.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} data-testid="drilldown-close">Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default RecipientDrilldown;
