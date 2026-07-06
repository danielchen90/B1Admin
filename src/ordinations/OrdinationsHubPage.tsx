import React from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { PageHeader, PersonHelper } from "@churchapps/apphelper";
import type { PersonInterface } from "@churchapps/helpers";
import { Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import AssessmentIcon from "@mui/icons-material/Assessment";
import { PersonAdd } from "../components/PersonAdd";
import { OrdinationIssueDialog } from "../people/components/OrdinationIssueDialog";
import { canManageOrdinationTypes, canWriteOrdinations } from "../helpers/OrdinationHelper";

// Grouped Ordination & Leadership hub: the discoverable entry point that LINKS to
// the Settings types screen (org-wide only — it does NOT duplicate it) and hosts the
// "credential a person who has none yet" flow. This is the first-credential path
// because the Person Ordinations tab is hidden at count 0 (03-04): pick any person
// here, issue their first credential, then land on their now-visible tab.
export const OrdinationsHubPage: React.FC = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = React.useState<PersonInterface | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const canWrite = canWriteOrdinations();
  const canManageTypes = canManageOrdinationTypes();

  const handlePersonAdd = (person: PersonInterface) => {
    setSelected(person);
    setDialogOpen(true);
  };

  // On a successful issue, navigate to the person — their Ordinations tab is now
  // visible (count > 0), which is the cleaner affordance than an in-place toast:
  // the user immediately sees the credential they just created in context.
  const handleIssued = () => {
    if (selected) navigate("/people/" + selected.id);
  };

  return (
    <>
      <PageHeader title="Ordination & Leadership" subtitle="Issue and manage ministerial credentials across your campuses." />
      <Box sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Leadership Reports</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                View, group, filter, and export a roster of every credential holder across your campuses.
              </Typography>
              <Button
                variant="outlined"
                component={RouterLink}
                to="/ordinations/reports"
                startIcon={<AssessmentIcon />}
                data-testid="leadership-reports-link"
              >
                Open leadership reports
              </Button>
            </CardContent>
          </Card>

          {canManageTypes && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Ordination Types</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Define the church-wide vocabulary of ordination credentials (Bishop, Pastor, Elder, and more).
                </Typography>
                <Button
                  variant="outlined"
                  component={RouterLink}
                  to="/settings/ordination-types"
                  startIcon={<WorkspacePremiumIcon />}
                  data-testid="manage-ordination-types-link"
                >
                  Manage ordination types
                </Button>
              </CardContent>
            </Card>
          )}

          {canWrite && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Credential a person</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Search for any person to issue their first ordination credential.
                </Typography>
                <PersonAdd
                  getPhotoUrl={PersonHelper.getPhotoUrl}
                  addFunction={handlePersonAdd}
                  actionLabel="Credential"
                  showCreatePersonOnNotFound
                />
              </CardContent>
            </Card>
          )}
        </Stack>
      </Box>

      {selected && (
        <OrdinationIssueDialog
          open={dialogOpen}
          personId={selected.id}
          onClose={() => setDialogOpen(false)}
          onIssued={handleIssued}
        />
      )}
    </>
  );
};
