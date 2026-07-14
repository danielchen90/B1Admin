import React from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Box, Grid, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Typography, CircularProgress, Alert
} from "@mui/material";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { useCampuses } from "../hooks/useCampuses";
import { apiErrorMessage } from "./apiError";
import { listCampaigns, getSchedulingTimezone } from "./campaignApi";
import { type CampaignInterface, type CampaignListFilter, type CampaignStatus } from "./emailTypes";
import { CampaignListFilterPanel } from "./CampaignListFilterPanel";

dayjs.extend(utc);
dayjs.extend(timezone);

const DEFAULT_TZ = "America/New_York";

// Status → MUI Chip color. Keeps the sent/failed record legible at a glance.
const STATUS_COLOR: Record<CampaignStatus, "default" | "info" | "warning" | "success" | "error"> = {
  draft: "default",
  scheduled: "info",
  sending: "warning",
  sent: "success",
  failed: "error",
  canceled: "default"
};

const StatusChip: React.FC<{ status: string }> = ({ status }) => {
  const color = STATUS_COLOR[status as CampaignStatus] ?? "default";
  return <Chip size="small" color={color} label={status.charAt(0).toUpperCase() + status.slice(1)} />;
};

const formatDate = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
};

// The campaign LIST (Plan 12-04 — SND-03 list surface). Fetches every campaign
// (draft + sent) on mount, renders the controlled CampaignListFilterPanel in a
// left column, and applies the filter CLIENT-side: search across name/subject +
// status/campus multi-select intersection. Each row opens the editor at /email/:id.
export const CampaignListPage: React.FC = () => {
  const campuses = useCampuses();
  const [campaigns, setCampaigns] = React.useState<CampaignInterface[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [filter, setFilter] = React.useState<CampaignListFilter>({ search: "", statuses: [], campusIds: [] });
  // The church scheduling tz drives the "Scheduled for" column formatting so a
  // scheduled time always reads the same church-local value regardless of the
  // viewer's browser timezone. Default while /timezone loads / on error.
  const [churchTz, setChurchTz] = React.useState(DEFAULT_TZ);

  React.useEffect(() => {
    let active = true;
    getSchedulingTimezone()
      .then((r) => {
        if (active && r?.timezone) setChurchTz(r.timezone);
      })
      .catch(() => {
        /* keep DEFAULT_TZ */
      });
    return () => {
      active = false;
    };
  }, []);

  // Format a scheduled UTC instant in the church timezone (— when absent).
  const formatScheduled = React.useCallback(
    (iso?: string) => {
      if (!iso) return "—";
      const d = dayjs.utc(iso);
      return d.isValid() ? d.tz(churchTz).format("MMM D, YYYY h:mm A") : "—";
    },
    [churchTz]
  );

  React.useEffect(() => {
    let active = true;
    listCampaigns()
      .then((data) => {
        if (active) setCampaigns(Array.isArray(data) ? data : []);
      })
      .catch((err: unknown) => {
        if (active) setError(apiErrorMessage(err, "Couldn't load campaigns."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const campusName = React.useCallback(
    (id?: string) => (id ? campuses.find((c) => c.id === id)?.name ?? "—" : "All campuses"),
    [campuses]
  );

  const filtered = React.useMemo(() => {
    const q = (filter.search ?? "").trim().toLowerCase();
    return campaigns.filter((c) => {
      if (q) {
        const hay = `${c.name ?? ""} ${c.subject ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filter.statuses.length > 0 && !filter.statuses.includes(c.status)) return false;
      if (filter.campusIds.length > 0 && !(c.campusId && filter.campusIds.includes(c.campusId))) return false;
      return true;
    });
  }, [campaigns, filter]);

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 3 }}>
        <CampaignListFilterPanel accessibleCampuses={campuses} filter={filter} onChange={setFilter} disabled={loading} />
      </Grid>
      <Grid size={{ xs: 12, md: 9 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
                {campaigns.length === 0
                  ? "No campaigns yet. Create your first one with “New Campaign”."
                  : "No campaigns match the current filter."}
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <TableContainer component={Card}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Subject</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Campus</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Scheduled for</TableCell>
                  <TableCell align="right">Sent / Failed</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow
                    key={c.id}
                    hover
                    component={RouterLink}
                    to={`/email/${c.id}`}
                    sx={{ textDecoration: "none", cursor: "pointer", "& td": { color: "inherit" } }}
                    data-testid={`campaign-row-${c.id}`}
                  >
                    <TableCell sx={{ fontWeight: 500 }}>{c.name || "(untitled)"}</TableCell>
                    <TableCell>{c.subject || "—"}</TableCell>
                    <TableCell><StatusChip status={c.status} /></TableCell>
                    <TableCell>{campusName(c.campusId)}</TableCell>
                    <TableCell>{formatDate(c.createdAt)}</TableCell>
                    <TableCell>{formatScheduled(c.scheduledAt)}</TableCell>
                    <TableCell align="right">
                      {c.status === "sent" || c.status === "sending"
                        ? `${c.sentCount ?? 0} / ${c.failedCount ?? 0}`
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Grid>
    </Grid>
  );
};
