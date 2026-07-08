import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loading, PageHeader } from "@churchapps/apphelper";
import { Box, Grid, Stack, Button, Typography, Card, CardContent, Alert, List, ListItem, ListItemText } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import HistoryIcon from "@mui/icons-material/History";
import DonutLargeIcon from "@mui/icons-material/DonutLarge";
import { useNavigate } from "react-router-dom";
import { PageContainer } from "../../components/ui/PageContainer";
import { CardWithHeader } from "../../components/ui/CardWithHeader";
import { CountChip } from "../../components/ui/CountChip";
import { EmptyState } from "../../components/ui/EmptyState";
import { GRID_SIZES } from "../../components/ui/layoutPresets";
import { DonutChart } from "../../people/demographics/components/DonutChart";
import { useCampuses } from "../../hooks/useCampuses";
import { useOrdinationTypes } from "../../hooks/useOrdinationTypes";
import { type PersonOrdinationInterface } from "../../people/components/PersonOrdinationInterface";
import { computeAdminMetrics, EXPIRING_SOON_DAYS } from "./adminMetrics";

// Format a date-only "YYYY-MM-DD" string as a LOCAL calendar day (avoids the UTC off-by-one).
const formatLocalDate = (value: string | null): string => {
  if (!value) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString();
};

interface MetricTileProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: "default" | "warning" | "error";
}

// A single big-number stat tile. `tone` colors the number for the actionable buckets.
const MetricTile: React.FC<MetricTileProps> = ({ label, value, icon, tone = "default" }) => {
  const color = tone === "error" ? "error.main" : tone === "warning" ? "warning.main" : "text.primary";
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, color: "text.secondary" }}>
          {icon}
          <Typography variant="body2" color="text.secondary">{label}</Typography>
        </Stack>
        <Typography variant="h3" sx={{ color, fontWeight: 600 }}>{value.toLocaleString()}</Typography>
      </CardContent>
    </Card>
  );
};

// The admin-facing command view. Renders domain metrics + a status donut + campus rollup +
// actionable expiring/expired alerts + a recently-issued list, all from the SAME campus-scoped
// GETs the leadership report uses. The caller (Authenticated.tsx) only mounts this for admins;
// this page does no internal gating. A "View my personal dashboard" link makes the toggle to
// the person side (`/dashboard`) discoverable.
export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();

  // All-status credentials — the campus scope is applied server-side (same key as the report).
  const ordQuery = useQuery<PersonOrdinationInterface[]>({ queryKey: ["/personOrdinations", "MembershipApi"], placeholderData: [] });
  const ordinations = useMemo(() => ordQuery.data ?? [], [ordQuery.data]);
  const campuses = useCampuses();
  const types = useOrdinationTypes();

  const metrics = useMemo(() => computeAdminMetrics(ordinations, campuses, types), [ordinations, campuses, types]);

  const loading = ordQuery.isLoading;
  const hasData = ordinations.length > 0;

  const goReports = () => navigate("/ordinations/reports");

  return (
    <>
      <PageHeader
        title="Admin Dashboard"
        subtitle="Credential health across your campuses at a glance."
      />
      <PageContainer>
        <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
          <Button variant="text" size="small" startIcon={<PersonIcon />} onClick={() => navigate("/dashboard")}>
            View my personal dashboard
          </Button>
        </Stack>

        {loading ? (
          <Loading />
        ) : !hasData ? (
          <EmptyState
            icon={<WorkspacePremiumIcon />}
            title="No credentials on file yet"
            description="Once ministers are credentialed, their status, expirations, and campus rollups appear here."
            action={<Button variant="contained" onClick={goReports}>Open Leadership Report</Button>}
          />
        ) : (
          <Stack spacing={3}>
            {/* Metric tiles */}
            <Grid container spacing={3}>
              <Grid size={GRID_SIZES.fourColumn}>
                <MetricTile label="Total Ministers" value={metrics.totalMinisters} icon={<PersonIcon fontSize="small" />} />
              </Grid>
              <Grid size={GRID_SIZES.fourColumn}>
                <MetricTile label="Active Credentials" value={metrics.activeCredentials} icon={<WorkspacePremiumIcon fontSize="small" />} />
              </Grid>
              <Grid size={GRID_SIZES.fourColumn}>
                <MetricTile label="Expiring Soon" value={metrics.expiringSoon} icon={<WarningAmberIcon fontSize="small" />} tone="warning" />
              </Grid>
              <Grid size={GRID_SIZES.fourColumn}>
                <MetricTile label="Expired" value={metrics.expired} icon={<ErrorOutlineIcon fontSize="small" />} tone="error" />
              </Grid>
              <Grid size={GRID_SIZES.fourColumn}>
                <MetricTile label="Unpaid (Active)" value={metrics.unpaid} icon={<AccountBalanceIcon fontSize="small" />} tone="warning" />
              </Grid>
            </Grid>

            {/* Actionable alerts — only shown when there's something to act on. */}
            {(metrics.expiringSoon > 0 || metrics.expired > 0) && (
              <Stack spacing={2}>
                {metrics.expired > 0 && (
                  <Alert
                    severity="error"
                    icon={<ErrorOutlineIcon />}
                    action={<Button color="inherit" size="small" onClick={goReports}>Review</Button>}
                  >
                    {metrics.expired.toLocaleString()} credential{metrics.expired === 1 ? " has" : "s have"} expired and {metrics.expired === 1 ? "is" : "are"} still on file.
                  </Alert>
                )}
                {metrics.expiringSoon > 0 && (
                  <Alert
                    severity="warning"
                    icon={<WarningAmberIcon />}
                    action={<Button color="inherit" size="small" onClick={goReports}>Review</Button>}
                  >
                    {metrics.expiringSoon.toLocaleString()} active credential{metrics.expiringSoon === 1 ? "" : "s"} expire within the next {EXPIRING_SOON_DAYS} days.
                  </Alert>
                )}
              </Stack>
            )}

            {/* Chart + campus rollup */}
            <Grid container spacing={3}>
              <Grid size={GRID_SIZES.twoColumn}>
                <DonutChart title="Credentials by Status" data={metrics.byStatus} />
              </Grid>
              <Grid size={GRID_SIZES.twoColumn}>
                <CardWithHeader title="Active Credentials by Campus" icon={<AccountBalanceIcon sx={{ color: "primary.main", fontSize: 20 }} />}>
                  {metrics.byCampus.length === 0 ? (
                    <Typography color="text.secondary">No active credentials.</Typography>
                  ) : (
                    <List dense disablePadding>
                      {metrics.byCampus.map((c) => (
                        <ListItem key={c.name} secondaryAction={<CountChip count={c.count} />} disableGutters>
                          <ListItemText primary={c.name} />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </CardWithHeader>
              </Grid>
            </Grid>

            {/* Recently issued */}
            <CardWithHeader title="Recently Issued" icon={<HistoryIcon sx={{ color: "primary.main", fontSize: 20 }} />}>
              {metrics.recentGrants.length === 0 ? (
                <Typography color="text.secondary">No recent grants.</Typography>
              ) : (
                <List dense disablePadding>
                  {metrics.recentGrants.map((g) => (
                    <ListItem key={g.id || `${g.personId}|${g.ordinationTypeId}`} disableGutters>
                      <ListItemText
                        primary={`${g.callingName} · ${g.campusName}`}
                        secondary={`${g.credentialNumber ? "Credential " + g.credentialNumber + " · " : ""}Granted ${formatLocalDate(g.grantedDate)}`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardWithHeader>

            <Box sx={{ display: { xs: "none", md: "block" } }}>
              <Stack direction="row" spacing={1} alignItems="center" color="text.secondary">
                <DonutLargeIcon fontSize="small" />
                <Typography variant="caption">Metrics reflect only the campuses you can access.</Typography>
              </Stack>
            </Box>
          </Stack>
        )}
      </PageContainer>
    </>
  );
};
