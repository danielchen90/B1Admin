import React from "react";
import { Link as RouterLink } from "react-router-dom";
import { PageHeader } from "@churchapps/apphelper";
import { Box, Button, Stack } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SettingsIcon from "@mui/icons-material/Settings";
import GroupsIcon from "@mui/icons-material/Groups";
import { PageBreadcrumbs } from "../components/ui";
import { CampaignListPage } from "./CampaignListPage";

// The top-level Email area shell (Plan 12-04). Mirrors the OrdinationsHubPage
// layout (PageBreadcrumbs + PageHeader + body) and stays THIN — it hosts the
// CampaignListPage (which does the fetch/filter work) plus a primary "New
// Campaign" action and a Settings affordance (the P11 EmailSettingsForm lives at
// /settings — see settings routes). This is the discoverable entry point the
// editor (12-05) and entry flow (12-07) build on.
export const EmailHubPage: React.FC = () => {
  return (
    <>
      <PageBreadcrumbs items={[{ label: "Email" }]} />
      <PageHeader title="Email" subtitle="Create, send, and track email campaigns across your campuses." />
      <Box sx={{ p: 3 }}>
        <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mb: 3 }}>
          <Button
            variant="outlined"
            component={RouterLink}
            to="/email/audiences"
            startIcon={<GroupsIcon />}
            data-testid="saved-audiences-link"
          >
            Saved Audiences
          </Button>
          <Button
            variant="outlined"
            component={RouterLink}
            to="/settings"
            startIcon={<SettingsIcon />}
            data-testid="email-settings-link"
          >
            Settings
          </Button>
          <Button
            variant="contained"
            component={RouterLink}
            to="/email/new"
            startIcon={<AddIcon />}
            data-testid="new-campaign-button"
          >
            New Campaign
          </Button>
        </Stack>
        <CampaignListPage />
      </Box>
    </>
  );
};
