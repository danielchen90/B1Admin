import React from "react";
import { PageHeader } from "@churchapps/apphelper";
import { Box } from "@mui/material";
import { OrdinationTypesSection } from "./components/OrdinationTypesSection";

// Page-renders + section-gates: any settings user may VIEW the church-wide
// ordination vocabulary, while OrdinationTypesSection hides Add/edit behind
// canManageOrdinationTypes (Leadership Admin dual gate, also enforced server-side).
export const OrdinationTypesPage: React.FC = () => (
  <>
    <PageHeader title="Ordination Types" subtitle="Define the church-wide ordination credential vocabulary." />
    <Box sx={{ p: 3 }}>
      <OrdinationTypesSection />
    </Box>
  </>
);
