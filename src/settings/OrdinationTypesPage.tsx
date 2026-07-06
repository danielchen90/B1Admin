import React from "react";
import { PageHeader } from "@churchapps/apphelper";
import { Box } from "@mui/material";
import { OrdinationTypesSection } from "./components/OrdinationTypesSection";
import { PageBreadcrumbs } from "../components/ui";

// Page-renders + section-gates: any settings user may VIEW the church-wide
// ordination vocabulary, while OrdinationTypesSection hides Add/edit behind
// canManageOrdinationTypes (Leadership Admin dual gate, also enforced server-side).
export const OrdinationTypesPage: React.FC = () => (
  <>
    <PageBreadcrumbs items={[{ label: "Settings", path: "/settings" }, { label: "Ordination Types" }]} />
    <PageHeader title="Ordination Types" subtitle="Define the church-wide ordination credential vocabulary." />
    <Box sx={{ p: 3 }}>
      <OrdinationTypesSection />
    </Box>
  </>
);
