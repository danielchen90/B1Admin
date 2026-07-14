import React from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  Box, Grid, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Typography, CircularProgress, Alert, Button, Stack
} from "@mui/material";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { useCampuses } from "../hooks/useCampuses";
import { apiErrorMessage } from "./apiError";
import { listCampaigns, getSchedulingTimezone, resendAsNew } from "./campaignApi";
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

// Engagement rate as a whole-percent string. Mirrors StatsTab.rate() (line ~69):
// draft/scheduled/failed/canceled rows omit engagement entirely (count === undefined
// per the 16-01 server contract) so they render "—", NOT 0% (Pitfall 4, CONTEXT lock).
const rate = (count?: number, denom?: number): string =>
  (!denom || denom <= 0 || count === undefined) ? "—" : `${Math.round((count / denom) * 100)}%`;

// The campaign LIST — the Phase-16 activity dashboard (HST-01/HST-04). Fetches every
// campaign (draft + scheduled + sent) on mount, renders the controlled four-facet
// CampaignListFilterPanel (Status / Campus / Sender / Date range) in a left column,
// and applies the filter CLIENT-side: search across subject/sender/name +
// status/campus/sender intersection + effective-date range. Rows show inline
// sender / effective date / engagement rates + status-scoped actions.
export const CampaignListPage: React.FC = () => {
  const campuses = useCampuses();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = React.useState<CampaignInterface[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [filter, setFilter] = React.useState<CampaignListFilter>({ search: "", statuses: [], campusIds: [], senders: [] });
  // The row currently mid-resend (spinner + button-disable). Null when idle.
  const [resendingId, setResendingId] = React.useState<string | null>(null);
  // The church scheduling tz drives the "Scheduled for" date formatting so a
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

  // The effective date a row is sorted/filtered/displayed by, by status: the sent
  // instant for sent rows, the scheduled fire time for scheduled rows, else the
  // draft creation time. Returns undefined only if a row carries none.
  const effectiveDate = React.useCallback(
    (c: CampaignInterface): string | undefined => c.sentAt ?? c.scheduledAt ?? c.createdAt,
    []
  );

  // Render the effective date with the right formatter: scheduled rows use the
  // church-tz clock (formatScheduled); sent/created rows use a plain local date.
  const formatEffectiveDate = React.useCallback(
    (c: CampaignInterface): string => {
      if (c.status === "scheduled" && c.scheduledAt) return formatScheduled(c.scheduledAt);
      return formatDate(c.sentAt ?? c.createdAt);
    },
    [formatScheduled]
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

  // Role-scope the Campus facet (Pitfall 3 — never expose campuses the user can't
  // access). useCampuses() is the church-WIDE list; the current backend has no
  // per-user campus-grant surface, so we pass every campus for now. TODO: once a
  // real per-user grant list exists, filter `campuses` to it here before handing
  // the panel `accessibleCampuses` — the panel is already a pure renderer.
  const accessibleCampuses = campuses;

  // The distinct, sorted, non-empty sender labels drawn from the loaded DTO — feeds
  // the Sender facet (Task 3 seam).
  const senderOptions = React.useMemo(
    () =>
      Array.from(new Set(campaigns.map((c) => c.sender).filter((s): s is string => !!s && s.trim() !== "")))
        .sort((a, b) => a.localeCompare(b)),
    [campaigns]
  );

  const filtered = React.useMemo(() => {
    const q = (filter.search ?? "").trim().toLowerCase();
    const from = filter.dateFrom ? dayjs(filter.dateFrom).startOf("day") : null;
    const to = filter.dateTo ? dayjs(filter.dateTo).endOf("day") : null;
    return campaigns.filter((c) => {
      // Search matches subject + sender + name (CONTEXT: subject + sender).
      if (q) {
        const hay = `${c.subject ?? ""} ${c.sender ?? ""} ${c.name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      // AND-across facets, OR-within a facet (the ordination-report behavior).
      if (filter.statuses.length > 0 && !filter.statuses.includes(c.status)) return false;
      if (filter.campusIds.length > 0 && !(c.campusId && filter.campusIds.includes(c.campusId))) return false;
      if (filter.senders.length > 0 && !(c.sender && filter.senders.includes(c.sender))) return false;
      // Date-range over the row's effective date; guard invalid/missing dates —
      // a row with no effective date passes only when no bound is set.
      if (from || to) {
        const eff = effectiveDate(c);
        const d = eff ? dayjs(eff) : null;
        if (!d || !d.isValid()) {
          if (from || to) return false;
        } else {
          if (from && d.isBefore(from)) return false;
          if (to && d.isAfter(to)) return false;
        }
      }
      return true;
    });
  }, [campaigns, filter, effectiveDate]);

  // Content-only "resend as new" (16-03 helper): clones subject/preheader/design
  // into a fresh draft (NO audience) then drops the user into the editor.
  const handleResend = React.useCallback(
    async (id: string) => {
      setError("");
      setResendingId(id);
      try {
        const created = await resendAsNew(id);
        navigate(`/email/${created.id}`);
      } catch (err: unknown) {
        setError(apiErrorMessage(err, "Couldn't duplicate this campaign."));
      } finally {
        setResendingId(null);
      }
    },
    [navigate]
  );

  // Status-scoped row actions — only ever the valid affordances, no greyed dead
  // buttons (CONTEXT lock). draft/scheduled → Edit + Cancel (Cancel lives in the
  // editor; the list routes there rather than owning a bulk cancel). sent → View +
  // Resend. sending → View. failed/canceled → View + Resend.
  const rowActions = React.useCallback(
    (c: CampaignInterface) => {
      const view = (
        <Button key="view" size="small" component={RouterLink} to={`/email/${c.id}`} sx={{ textTransform: "none" }}>
          View
        </Button>
      );
      const edit = (
        <Button key="edit" size="small" component={RouterLink} to={`/email/${c.id}`} sx={{ textTransform: "none" }}>
          Edit
        </Button>
      );
      // The editor hosts the Cancel affordance; a list-level bulk cancel is out of scope.
      const cancel = (
        <Button key="cancel" size="small" color="error" component={RouterLink} to={`/email/${c.id}`} sx={{ textTransform: "none" }}>
          Cancel
        </Button>
      );
      const resend = (
        <Button
          key="resend"
          size="small"
          onClick={() => handleResend(c.id!)}
          disabled={resendingId === c.id}
          startIcon={resendingId === c.id ? <CircularProgress size={14} /> : undefined}
          sx={{ textTransform: "none" }}
        >
          Resend as new
        </Button>
      );
      switch (c.status) {
        case "draft":
        case "scheduled":
          return [edit, cancel];
        case "sent":
          return [view, resend];
        case "sending":
          return [view];
        case "failed":
        case "canceled":
          return [view, resend];
        default:
          return [view];
      }
    },
    [handleResend, resendingId]
  );

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 3 }}>
        <CampaignListFilterPanel accessibleCampuses={accessibleCampuses} senderOptions={senderOptions} filter={filter} onChange={setFilter} disabled={loading} />
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
                  <TableCell>Subject</TableCell>
                  <TableCell>Sender</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Campus</TableCell>
                  <TableCell align="right">Audience</TableCell>
                  <TableCell align="right">Open rate</TableCell>
                  <TableCell align="right">Click rate</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id} hover data-testid={`campaign-row-${c.id}`}>
                    <TableCell sx={{ fontWeight: 500 }}>
                      {c.subject || "(no subject)"}
                      {c.name && c.name !== c.subject && (
                        <Typography variant="caption" display="block" color="text.secondary">{c.name}</Typography>
                      )}
                    </TableCell>
                    <TableCell>{c.sender ?? "—"}</TableCell>
                    <TableCell>{formatEffectiveDate(c)}</TableCell>
                    <TableCell><StatusChip status={c.status} /></TableCell>
                    <TableCell>{campusName(c.campusId)}</TableCell>
                    <TableCell align="right">{c.recipientCount ?? "—"}</TableCell>
                    <TableCell align="right">{rate(c.opened, c.delivered)}</TableCell>
                    <TableCell align="right">{rate(c.clicked, c.delivered)}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        {rowActions(c)}
                      </Stack>
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
