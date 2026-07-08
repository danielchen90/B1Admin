import React from "react";
import { Stack, Grid, Box, Card, CardHeader, Collapse, IconButton, Button } from "@mui/material";
import { FlashOn, ExpandMore, ExpandLess, Dashboard as DashboardIcon } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { TaskList } from "../serving/tasks/components/TaskList";
import { PeopleSearch, AdminWelcome, MemberWelcome } from "./components";
import { Groups } from "../people/components";
import { UserHelper, Permissions, Locale, PageHeader } from "@churchapps/apphelper";
import { PageContainer } from "../components/ui/PageContainer";
import { GRID_SIZES } from "../components/ui/layoutPresets";
import { canWriteOrdinations } from "../helpers/OrdinationHelper";

export const DashboardPage = () => {
  const navigate = useNavigate();

  const isDomainAdmin = UserHelper.checkAccess(Permissions.membershipApi.settings.edit)
    && UserHelper.checkAccess(Permissions.membershipApi.roles.edit)
    && UserHelper.checkAccess(Permissions.givingApi.settings.edit)
    && UserHelper.checkAccess(Permissions.contentApi.content.edit);

  const canViewPeople = UserHelper.checkAccess(Permissions.membershipApi.people.view);
  // Admins reach their personal dashboard via the admin dashboard's "View my personal
  // dashboard" link; show a reciprocal link back so the toggle is bidirectional. Non-admins
  // never see it (they have no admin dashboard).
  const isOrdinationAdmin = canWriteOrdinations();

  // Quick Actions is collapsed by default (ADMIN-04) — expand on header click.
  const [quickOpen, setQuickOpen] = React.useState(false);

  const churchName = UserHelper.currentUserChurch?.church?.name || Locale.label("dashboard.memberWelcome.fallbackChurchName");
  const headerTitle = isDomainAdmin
    ? Locale.label("dashboard.adminWelcome.title")
    : Locale.label("dashboard.memberWelcome.title").replace("{churchName}", churchName);
  const headerSubtitle = isDomainAdmin
    ? Locale.label("dashboard.adminWelcome.subtitle")
    : Locale.label("dashboard.memberWelcome.subtitle");

  return (
    <>
      <PageHeader title={headerTitle} subtitle={headerSubtitle} />
      <PageContainer>
        {isOrdinationAdmin && (
          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
            <Button variant="text" size="small" startIcon={<DashboardIcon />} onClick={() => navigate("/")}>
              Back to Admin Dashboard
            </Button>
          </Stack>
        )}

        <Box sx={{ mb: 3 }}>
          <Card>
            <CardHeader
              onClick={() => setQuickOpen((o) => !o)}
              sx={{ cursor: "pointer", borderBottom: quickOpen ? 1 : 0, borderColor: "divider" }}
              avatar={<FlashOn sx={{ color: "primary.main", fontSize: 20 }} />}
              title={Locale.label("helpers.secondaryMenuHelper.quickActions")}
              titleTypographyProps={{ variant: "h6" }}
              action={
                <IconButton aria-label={quickOpen ? "Collapse Quick Actions" : "Expand Quick Actions"} size="small">
                  {quickOpen ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              }
            />
            <Collapse in={quickOpen} unmountOnExit>
              <Box sx={{ p: 2 }}>
                {isDomainAdmin ? <AdminWelcome /> : <MemberWelcome />}
              </Box>
            </Collapse>
          </Card>
        </Box>

        <Stack spacing={3}>
          {canViewPeople && <PeopleSearch />}
          <Grid container spacing={3}>
            <Grid size={GRID_SIZES.sidebar}>
              <Groups personId={UserHelper.person?.id} title={Locale.label("dashboard.myGroups")} />
            </Grid>
            <Grid size={GRID_SIZES.mainContent}>
              <TaskList compact={true} status={Locale.label("tasks.taskPage.open")} />
            </Grid>
          </Grid>
        </Stack>
      </PageContainer>
    </>
  );
};
