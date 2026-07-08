import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Chart } from "react-google-charts";
import { Loading, PageHeader } from "@churchapps/apphelper";
import { type GroupInterface } from "@churchapps/helpers";
import { Box, Grid, Stack, Button, Typography, Card, CardContent, Alert, List, ListItem, ListItemText, useTheme } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import GroupsIcon from "@mui/icons-material/Groups";
import EmojiPeopleIcon from "@mui/icons-material/EmojiPeople";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import HistoryIcon from "@mui/icons-material/History";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import DonutLargeIcon from "@mui/icons-material/DonutLarge";
import { useNavigate } from "react-router-dom";
import { PageContainer } from "../../components/ui/PageContainer";
import { CardWithHeader } from "../../components/ui/CardWithHeader";
import { CountChip } from "../../components/ui/CountChip";
import { GRID_SIZES } from "../../components/ui/layoutPresets";
import { DonutChart } from "../../people/demographics/components/DonutChart";
import { getChartTheme, CHART_PALETTE } from "../../people/demographics/components/chartTheme";
import { useOrdinationTypes } from "../../hooks/useOrdinationTypes";
import { type PersonOrdinationInterface } from "../../people/components/PersonOrdinationInterface";
import { useDemographics, useAttendanceTrend, useGroups, useGroupSummary, useRecentLogins, useLoginsWeekly, useNewMembersTrend } from "./adminHooks";
import { deriveMembershipMetrics, computeOrdinationBreakdown, loginsThisWeek, trackingSince, type WeekPoint } from "./adminMetrics";

// Format a "YYYY-MM-DD"-prefixed value as a LOCAL calendar day (avoids the UTC off-by-one). Weekly
// chart labels use full ISO datetimes and are formatted with plain Date (see WeeklyChart).
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
}

// A single big-number stat tile.
const MetricTile: React.FC<MetricTileProps> = ({ label, value, icon }) => (
  <Card sx={{ height: "100%" }}>
    <CardContent>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, color: "text.secondary" }}>
        {icon}
        <Typography variant="body2" color="text.secondary">{label}</Typography>
      </Stack>
      <Typography variant="h3" sx={{ color: "text.primary", fontWeight: 600 }}>{value.toLocaleString()}</Typography>
    </CardContent>
  </Card>
);

interface WeeklyChartProps {
  title: string;
  icon: React.ReactNode;
  data: WeekPoint[];
  valueKey: "count" | "visits";
  seriesLabel: string;
  caption?: string;
  note?: string;
}

// A weekly line chart over one of the aligned trend series. `week` values are full ISO datetimes, so
// plain `new Date(week)` is safe for the axis labels.
const WeeklyChart: React.FC<WeeklyChartProps> = ({ title, icon, data, valueKey, seriesLabel, caption, note }) => {
  const theme = useTheme();
  const chartTheme = getChartTheme(theme.palette.mode === "dark");
  const rows: any[] = [["Week", seriesLabel]];
  (data || []).forEach((r) => rows.push([new Date(r.week).toLocaleDateString(), Number(r[valueKey] ?? 0)]));
  const options = {
    legend: { position: "none" as const },
    backgroundColor: chartTheme.backgroundColor,
    colors: CHART_PALETTE,
    chartArea: { width: "85%", height: "70%" },
    hAxis: { textStyle: chartTheme.textStyle },
    vAxis: { textStyle: chartTheme.textStyle, gridlines: { color: chartTheme.gridColor }, baselineColor: chartTheme.baselineColor, minValue: 0 }
  };
  return (
    <CardWithHeader title={title} icon={icon}>
      {note && <Alert severity="info" sx={{ mb: 2 }}>{note}</Alert>}
      {data && data.length > 0 ? (
        <>
          <Box sx={{ display: { xs: "none", sm: "block" } }}>
            <Chart chartType="LineChart" data={rows} width="100%" height="280px" options={options} />
          </Box>
          <Box sx={{ display: { xs: "block", sm: "none" } }}>
            <Typography color="text.secondary" variant="body2">Chart hidden on small screens — latest: {Number((data[data.length - 1]?.[valueKey]) ?? 0).toLocaleString()}.</Typography>
          </Box>
          {caption && <Typography variant="caption" color="text.secondary">{caption}</Typography>}
        </>
      ) : (
        <Typography color="text.secondary">No data yet.</Typography>
      )}
    </CardWithHeader>
  );
};

// The church-admin command view. FOCUS is church operations — people totals, membership-status
// breakdown, active/visitor counts, groups, a weekly attendance trend, a weekly new-members trend,
// and a real recent-logins panel — while ordinations shrink to a single "People per ordination type"
// panel. The caller (Authenticated.tsx) only mounts this for admins; this page does no internal
// gating. Both new-members and logins carry explicit "going-forward only" notes.
export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();

  const demoQuery = useDemographics();
  const attendanceQuery = useAttendanceTrend();
  const groupsQuery = useGroups();
  const groupSummaryQuery = useGroupSummary();
  const recentLoginsQuery = useRecentLogins();
  const loginsWeeklyQuery = useLoginsWeekly();
  const newMembersQuery = useNewMembersTrend();

  // Ordinations demoted to a single distinct-people-per-type breakdown (campus scope applied server-side).
  const ordQuery = useQuery<PersonOrdinationInterface[]>({ queryKey: ["/personOrdinations", "MembershipApi"], placeholderData: [] });
  const ordinations = useMemo(() => ordQuery.data ?? [], [ordQuery.data]);
  const types = useOrdinationTypes();

  const membership = useMemo(() => deriveMembershipMetrics(demoQuery.data), [demoQuery.data]);
  const ordination = useMemo(() => computeOrdinationBreakdown(ordinations, types), [ordinations, types]);

  const groups = groupsQuery.data ?? [];
  const groupSummary = groupSummaryQuery.data ?? [];
  const recentLogins = recentLoginsQuery.data ?? [];
  const loginsWeekly = loginsWeeklyQuery.data ?? [];
  const newMembers = newMembersQuery.data ?? [];

  const groupNameById = useMemo(() => {
    const map = new Map<string, string>();
    (groups as GroupInterface[]).forEach((g) => { if (g.id) map.set(g.id, g.name ?? "Group"); });
    return map;
  }, [groups]);

  // Groups summary rows joined to their names, most-active first.
  const groupRows = useMemo(() =>
    [...groupSummary]
      .sort((a, b) => b.totalVisits - a.totalVisits)
      .map((s) => ({ ...s, name: groupNameById.get(s.groupId) ?? "Group" })),
  [groupSummary, groupNameById]);

  const weeklyLogins = loginsThisWeek(loginsWeekly);
  // One honest "tracked from" label reused by both going-forward panels; null → "this deploy".
  const trackingLabel = trackingSince(loginsWeekly, newMembers) ?? "this deploy";
  const newMembersNote = `New members are tracked from ${trackingLabel} onward — people added before then have no recorded date and cannot be backfilled.`;
  const loginsNote = `Login history is recorded from ${trackingLabel} onward — sign-ins before then were not captured.`;

  const loading = demoQuery.isLoading || ordQuery.isLoading;

  return (
    <>
      <PageHeader
        title="Admin Dashboard"
        subtitle="How your church is doing at a glance."
      />
      <PageContainer>
        <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
          <Button variant="text" size="small" startIcon={<PersonIcon />} onClick={() => navigate("/dashboard")}>
            View my personal dashboard
          </Button>
        </Stack>

        {loading ? (
          <Loading />
        ) : (
          <Stack spacing={3}>
            {/* Metric tiles — people-first */}
            <Grid container spacing={3}>
              <Grid size={GRID_SIZES.fourColumn}>
                <MetricTile label="Total People" value={membership.totalPeople} icon={<PersonIcon fontSize="small" />} />
              </Grid>
              <Grid size={GRID_SIZES.fourColumn}>
                <MetricTile label="Active People" value={membership.activePeople} icon={<HowToRegIcon fontSize="small" />} />
              </Grid>
              <Grid size={GRID_SIZES.fourColumn}>
                <MetricTile label="Visitors" value={membership.visitors} icon={<EmojiPeopleIcon fontSize="small" />} />
              </Grid>
              <Grid size={GRID_SIZES.fourColumn}>
                <MetricTile label="Groups" value={groups.length} icon={<GroupsIcon fontSize="small" />} />
              </Grid>
            </Grid>

            {/* Membership donut + weekly attendance */}
            <Grid container spacing={3}>
              <Grid size={GRID_SIZES.twoColumn}>
                <DonutChart title="People by Membership Status" data={membership.membershipStatus} />
              </Grid>
              <Grid size={GRID_SIZES.twoColumn}>
                <WeeklyChart
                  title="Weekly Attendance"
                  icon={<ShowChartIcon sx={{ color: "primary.main", fontSize: 20 }} />}
                  data={attendanceQuery.data ?? []}
                  valueKey="visits"
                  seriesLabel="Attendance"
                  caption="Total visits across all groups (not split by visitor/member)."
                />
              </Grid>
            </Grid>

            {/* Weekly new members (honest going-forward note) */}
            <WeeklyChart
              title="Weekly New Members"
              icon={<PersonIcon sx={{ color: "primary.main", fontSize: 20 }} />}
              data={newMembers}
              valueKey="count"
              seriesLabel="New Members"
              note={newMembersNote}
            />

            {/* Groups summary + ordination-type breakdown */}
            <Grid container spacing={3}>
              <Grid size={GRID_SIZES.twoColumn}>
                <CardWithHeader title="Groups" icon={<GroupsIcon sx={{ color: "primary.main", fontSize: 20 }} />}>
                  {groupRows.length === 0 ? (
                    <Typography color="text.secondary">No group sessions recorded in the last 13 weeks.</Typography>
                  ) : (
                    <List dense disablePadding>
                      {groupRows.map((g) => (
                        <ListItem key={g.groupId} secondaryAction={<CountChip count={Math.round(g.averageAttendance)} />} disableGutters>
                          <ListItemText
                            primary={g.name}
                            secondary={`${g.totalVisits.toLocaleString()} visits · ${g.sessionCount} sessions · last ${formatLocalDate(g.lastSessionDate)}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </CardWithHeader>
              </Grid>
              <Grid size={GRID_SIZES.twoColumn}>
                <CardWithHeader
                  title="People per Ordination Type"
                  icon={<WorkspacePremiumIcon sx={{ color: "primary.main", fontSize: 20 }} />}
                  actions={<Button variant="text" size="small" onClick={() => navigate("/ordinations")}>Open Leadership Report</Button>}
                >
                  {ordination.byOrdinationType.length === 0 ? (
                    <Typography color="text.secondary">No credentials on file yet.</Typography>
                  ) : (
                    <List dense disablePadding>
                      {ordination.byOrdinationType.map((t) => (
                        <ListItem key={t.name} secondaryAction={<CountChip count={t.count} />} disableGutters>
                          <ListItemText primary={t.name} />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </CardWithHeader>
              </Grid>
            </Grid>

            {/* Recent logins (honest going-forward note) */}
            <CardWithHeader
              title="Recent Logins"
              icon={<HistoryIcon sx={{ color: "primary.main", fontSize: 20 }} />}
              actions={<CountChip count={weeklyLogins} />}
            >
              <Alert severity="info" sx={{ mb: 2 }}>{loginsNote}</Alert>
              <Typography variant="caption" color="text.secondary">{weeklyLogins.toLocaleString()} sign-in{weeklyLogins === 1 ? "" : "s"} this week.</Typography>
              {recentLogins.length === 0 ? (
                <Typography color="text.secondary" sx={{ mt: 1 }}>No logins recorded yet.</Typography>
              ) : (
                <List dense disablePadding sx={{ mt: 1 }}>
                  {recentLogins.map((l) => (
                    <ListItem key={l.id} disableGutters>
                      <ListItemText
                        primary={l.appName || "App"}
                        secondary={`${l.loginTime ? new Date(l.loginTime).toLocaleString() : "—"} · user ${(l.userId || "").slice(0, 8)}`}
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
