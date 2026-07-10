import React from "react";
import { useParams } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import { PageHeader } from "@churchapps/apphelper";
import { PageBreadcrumbs } from "../components/ui";

// PLACEHOLDER (Plan 12-04). The real Unlayer campaign editor is built in 12-05 —
// this stub only exists so /email/new and /email/:id route without a lazy-import
// error the moment the Email area ships. 12-05 REPLACES this file wholesale.
export const EmailEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return (
    <>
      <PageBreadcrumbs items={[{ label: "Email", path: "/email" }, { label: id ? "Edit campaign" : "New campaign" }]} />
      <PageHeader title={id ? "Edit campaign" : "New campaign"} subtitle="The campaign builder is coming soon." />
      <Box sx={{ p: 3 }}>
        <Typography variant="body2" color="text.secondary">
          The email campaign builder will appear here.
        </Typography>
      </Box>
    </>
  );
};
