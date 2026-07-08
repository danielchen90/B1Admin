import React, { useMemo, useState } from "react";
import { GroupAdd } from "./components";
import { ApiHelper, UserHelper, Loading, Locale, PageHeader } from "@churchapps/apphelper";
import { Link } from "react-router-dom";
import { Table, TableBody, TableCell, TableRow, Box, Card, Chip, Button, Stack, Typography, Grid } from "@mui/material";
import { Add as AddIcon, Folder as FolderIcon, Group as GroupIcon, Inbox as InboxIcon, LocationOn as CampusIcon, MonitorHeart as HealthIcon, People as PeopleIcon } from "@mui/icons-material";
import { type GroupInterface, type GroupJoinRequestInterface } from "@churchapps/helpers";
import { useMountedState, Permissions } from "@churchapps/apphelper";
import { useQuery } from "@tanstack/react-query";
import { CountChip, ExportButton, SortableTableHead } from "../components/ui";
import { useCampuses } from "../hooks/useCampuses";
import { GroupsFilterPanel, matchesGroupsFilter, activeGroupsFilterCount, EMPTY_GROUPS_FILTER, type GroupsFilterSpec } from "./GroupsFilterPanel";

const formatHeader = (key: string): string => {
  const customMap: Record<string, string> = {
    id: "ID",
    churchId: "Church ID",
    campusId: "Campus ID",
    categoryName: "Category Name",
    joinPolicy: "Join Policy",
    labelCount: "Label Count",
    memberCount: "Member Count",
    meetingLocation: "Meeting Location",
    meetingTime: "Meeting Time",
    name: "Name",
    labels: "Labels",
    tags: "Tags"
  };

  if (customMap[key]) {
    return customMap[key];
  }

  // Programmatic camelCase to spaced Title Case fallback
  const result = key
    .replace(/([A-Z])/g, " $1")
    .replace(/([0-9]+)/g, " $1")
    .trim();
  return result.charAt(0).toUpperCase() + result.slice(1);
};

const GroupsPage = () => {
  const [groups, setGroups] = useState<GroupInterface[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [spec, setSpec] = useState<GroupsFilterSpec>(EMPTY_GROUPS_FILTER);
  const isMounted = useMountedState();

  // Church-wide campus list powers the campus column and the sidebar filter's Campus
  // checkbox list.
  const campuses = useCampuses();
  const campusName = useMemo(() => new Map(campuses.map((c) => [c.id, c.name])), [campuses]);

  const handleAddUpdated = () => {
    setShowAdd(false);
    loadData();
  };

  const loadData = () => {
    setIsLoading(true);
    ApiHelper.get("/groups/tag/standard", "MembershipApi")
      .then((data: any) => {
        if (isMounted()) {
          setGroups(data);
        }
      })
      .finally(() => {
        if (isMounted()) {
          setIsLoading(false);
        }
      });
  };

  React.useEffect(loadData, [isMounted]);

  // Rollup stats across every standard group (not the filtered subset).
  const totalMembers = useMemo(() => groups.reduce((s, g) => s + (g.memberCount || 0), 0), [groups]);
  const campusesCovered = useMemo(() => new Set(groups.map((g) => (g as any).campusId).filter(Boolean)).size, [groups]);

  // Only offer campuses that actually have groups as checkbox options.
  const campusOptions = useMemo(() => {
    const used = new Set(groups.map((g) => (g as any).campusId).filter(Boolean));
    return campuses.filter((c) => used.has(c.id)).map((c) => ({ id: c.id!, name: c.name! })).sort((a, b) => a.name.localeCompare(b.name));
  }, [groups, campuses]);

  const visibleGroups = useMemo(() => groups.filter((g) => matchesGroupsFilter(g, spec)), [groups, spec]);
  const activeFilters = activeGroupsFilterCount(spec);

  const canApproveRequests = UserHelper.checkAccess(Permissions.membershipApi.groupMembers.edit);
  const { data: pendingRequests = [] } = useQuery<GroupJoinRequestInterface[]>({
    queryKey: ["/groupjoinrequests/pending", "MembershipApi"],
    placeholderData: [],
    enabled: canApproveRequests
  });
  const pendingCount = pendingRequests?.length || 0;

  const canEditPlans = UserHelper.checkAccess(Permissions.membershipApi.plans.edit);
  const { data: myMinistries = [] } = useQuery<GroupInterface[]>({
    queryKey: ["/groups/my/ministry", "MembershipApi"],
    placeholderData: [],
    enabled: !canEditPlans
  });
  const showServingTeams = canEditPlans || (myMinistries?.length || 0) > 0;

  const exportData = visibleGroups.map((g) => {
    const { labelArray, ...rest } = g;

    const rawExport: any = {
      ...rest,

      labels: Array.isArray(labelArray)
        ? labelArray.join(", ")
        : "",

      labelCount: Array.isArray(labelArray)
        ? labelArray.length
        : 0,

      memberCount: Number(g.memberCount || 0)
    };

    const formattedExport: any = {};
    Object.keys(rawExport).forEach((key) => {
      formattedExport[formatHeader(key)] = rawExport[key];
    });

    return formattedExport;
  });

  const getRows = () => {
    const rows: JSX.Element[] = [];

    if (visibleGroups.length === 0) {
      rows.push(
        <TableRow key="0">
          <TableCell colSpan={5}>{groups.length === 0 ? Locale.label("groups.groupsPage.noGroupMsg") : "No groups match the current filters."}</TableCell>
        </TableRow>
      );
      return rows;
    }

    let lastCat = "";
    for (let i = 0; i < visibleGroups.length; i++) {
      const g = visibleGroups[i];
      const cat =
        g.categoryName !== lastCat ? (
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <FolderIcon sx={{ color: "text.secondary", fontSize: 18, marginRight: "5px" }} /> {g.categoryName || "Uncategorized"}
          </Box>
        ) : (
          <></>
        );
      const memberCount = g.memberCount === 1 ? Locale.label("groups.groupsPage.pers") : (g.memberCount || 0).toString() + Locale.label("groups.groupsPage.spPpl");
      const campusId = (g as any).campusId as string | undefined;
      rows.push(
        <TableRow sx={{ whiteSpace: "nowrap" }} key={g.id}>
          <TableCell>{cat}</TableCell>
          <TableCell>
            <Box sx={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <GroupIcon sx={{ color: "primary.main", fontSize: 20 }} />{" "}
              <Link to={"/groups/" + g.id.toString()} style={{ color: "var(--link)", fontWeight: 500, textDecoration: "none" }}>{g.name}</Link>
            </Box>
          </TableCell>
          <TableCell>{campusId && campusName.get(campusId) ? campusName.get(campusId) : "—"}</TableCell>
          <TableCell>
            {g.labelArray.map((label, index) => (
              <Chip key={`${g.id}-${label}-${index}`} label={label} variant="outlined" size="small" style={{ marginRight: 5 }} />
            ))}
          </TableCell>
          <TableCell>{memberCount}</TableCell>
        </TableRow>
      );
      lastCat = g.categoryName;
    }
    return rows;
  };

  const addBox = showAdd ? <GroupAdd updatedFunction={handleAddUpdated} tags="standard" /> : <></>;

  const getTable = () => {
    if (isLoading) return <Loading />;
    return (
      <Card>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: "var(--border-light)" }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <GroupIcon sx={{ color: "primary.main", fontSize: 20 }} />
              <Typography variant="h6">{Locale.label("groups.groupsPage.groups")}</Typography>
              {groups.length > 0 && <CountChip count={visibleGroups.length} />}
              {activeFilters > 0 && <Typography variant="caption" sx={{ color: "var(--text-muted)" }}>of {groups.length}</Typography>}
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              {groups.length > 0 && UserHelper.checkAccess(Permissions.membershipApi.groups.edit) && (
                <ExportButton data={exportData} filename="groups.csv" text={Locale.label("groups.groupsPage.export")} />
              )}
            </Stack>
          </Stack>
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          <Table>
            {groups.length > 0 && (
              <SortableTableHead
                columns={[
                  { key: "categoryName", label: Locale.label("groups.groupsPage.cat") },
                  { key: "name", label: Locale.label("common.name") },
                  { key: "campusId", label: "Campus" },
                  { key: "labels", label: Locale.label("groups.groupsPage.labels") },
                  { key: "memberCount", label: Locale.label("groups.groupsPage.ppl") }
                ]}
              />
            )}
            <TableBody>{getRows()}</TableBody>
          </Table>
        </Box>
      </Card>
    );
  };

  return (
    <>
      <PageHeader
        title={Locale.label("groups.groupsPage.groups")}
        subtitle={groups.length > 0 ? Locale.label("groups.groupsPage.subtitle.manage").replace("{count}", groups.length.toString()) : Locale.label("groups.groupsPage.subtitle.create")}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems={{ xs: "flex-start", md: "center" }}
          sx={{ width: "100%" }}
        >
          {groups.length > 0 && (
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={{ xs: 2, sm: 4, md: 5 }}
              sx={{
                position: { xs: "static", md: "absolute" },
                left: { md: "50%" },
                top: { md: "50%" },
                transform: { md: "translateY(-50%)" },
                flexWrap: "wrap"
              }}
            >
              <Stack spacing={0.5} alignItems="center" sx={{ minWidth: 80 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <GroupIcon sx={{ color: "#FFF", fontSize: 24 }} />
                  <Typography variant="h5" sx={{ color: "#FFF", fontWeight: 700 }}>{groups.length}</Typography>
                </Stack>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.85)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: 0.5 }}>{Locale.label("groups.groupsPage.totalGroups")}</Typography>
              </Stack>
              <Stack spacing={0.5} alignItems="center" sx={{ minWidth: 80 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <PeopleIcon sx={{ color: "#FFF", fontSize: 24 }} />
                  <Typography variant="h5" sx={{ color: "#FFF", fontWeight: 700 }}>{totalMembers}</Typography>
                </Stack>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.85)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: 0.5 }}>Members</Typography>
              </Stack>
              {campusesCovered > 0 && (
                <Stack spacing={0.5} alignItems="center" sx={{ minWidth: 80 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CampusIcon sx={{ color: "#FFF", fontSize: 24 }} />
                    <Typography variant="h5" sx={{ color: "#FFF", fontWeight: 700 }}>{campusesCovered}</Typography>
                  </Stack>
                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.85)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: 0.5 }}>Campuses</Typography>
                </Stack>
              )}
            </Stack>
          )}
          <Stack
            direction="row"
            spacing={1.5}
            sx={{
              position: { md: "relative" },
              ml: { md: "auto" },
              zIndex: 1,
              flexWrap: "wrap"
            }}>
            {canApproveRequests && pendingCount > 0 && (
              <Button
                variant="outlined"
                component={Link}
                to="/groups/pending"
                startIcon={<InboxIcon />}
                data-testid="pending-requests-link"
                sx={{ color: "#FFF", borderColor: "rgba(255,255,255,0.5)", "&:hover": { borderColor: "#FFF", backgroundColor: "rgba(255,255,255,0.1)" } }}>
                {pendingCount} pending request{pendingCount === 1 ? "" : "s"}
              </Button>
            )}
            {UserHelper.checkAccess(Permissions.membershipApi.groupMembers.view) && (
              <Button
                variant="outlined"
                component={Link}
                to="/groups/health"
                startIcon={<HealthIcon />}
                data-testid="group-health-link"
                sx={{ color: "#FFF", borderColor: "rgba(255,255,255,0.5)", "&:hover": { borderColor: "#FFF", backgroundColor: "rgba(255,255,255,0.1)" } }}>
                {Locale.label("groups.groupHealth.title")}
              </Button>
            )}
            {showServingTeams && (
              <Button
                variant="outlined"
                component={Link}
                to="/serving"
                startIcon={<PeopleIcon />}
                data-testid="serving-teams-button"
                sx={{ color: "#FFF", borderColor: "rgba(255,255,255,0.5)", "&:hover": { borderColor: "#FFF", backgroundColor: "rgba(255,255,255,0.1)" } }}>
                {Locale.label("components.wrapper.teams")}
              </Button>
            )}
            {UserHelper.checkAccess(Permissions.membershipApi.groups.edit) && (
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setShowAdd(true)}
                sx={{ color: "#FFF", borderColor: "rgba(255,255,255,0.5)", "&:hover": { borderColor: "#FFF", backgroundColor: "rgba(255,255,255,0.1)" } }}
                data-testid="add-group-button">
                {Locale.label("groups.groupsPage.addGroup")}
              </Button>
            )}
          </Stack>
        </Stack>
      </PageHeader>

      {/* Main Content */}
      <Box sx={{ p: 3 }}>
        {addBox}
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 3 }}>
            <GroupsFilterPanel spec={spec} onChange={setSpec} campuses={campusOptions} />
          </Grid>
          <Grid size={{ xs: 12, md: 9 }}>
            {getTable()}
          </Grid>
        </Grid>
      </Box>
    </>
  );
};

export default GroupsPage;
