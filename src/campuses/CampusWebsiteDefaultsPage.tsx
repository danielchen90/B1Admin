import React from "react";
import { PageBreadcrumbs } from "../components/ui";
import { CampusWebsiteContent } from "./components/CampusWebsiteContent";

// Network-wide public website defaults (the campusContent org-default row). Only leadership
// (org-wide) admins can save here; the Api enforces it (campus admins get 401).
export const CampusWebsiteDefaultsPage: React.FC = () => (
  <>
    <PageBreadcrumbs items={[{ label: "Campuses", path: "/campuses" }, { label: "Website defaults" }]} />
    <CampusWebsiteContent campusId={null} />
  </>
);
