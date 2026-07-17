import React from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@mui/material";
import { PageBreadcrumbs } from "../components/ui";
import { type CampusInterface } from "../settings/components/CampusInterface";
import { CampusEdit } from "../settings/components/CampusEdit";
import { CampusBanner } from "./components/CampusBanner";
import { CampusNavigation } from "./components/CampusNavigation";
import { CampusPeople } from "./components/CampusPeople";
import { CampusGroups } from "./components/CampusGroups";

// Per-campus detail page: name in the header, a location map, and tabs of
// campus-scoped data. People is the only tab today; more slot in as new cases.
export const CampusPage: React.FC = () => {
  const params = useParams();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = React.useState("people");
  const [editing, setEditing] = React.useState(false);
  const campusQuery = useQuery<CampusInterface>({ queryKey: [`/campuses/${params.id}`, "MembershipApi"], placeholderData: {} as CampusInterface });
  const campus = campusQuery.data;

  // Close the edit dialog and refetch the campus so the hero shows the saved
  // address/name/timezone/website without a manual reload (mirrors
  // CampusesSection.handleUpdated). Key must match campusQuery exactly.
  const handleUpdated = () => {
    setEditing(false);
    queryClient.invalidateQueries({ queryKey: [`/campuses/${params.id}`, "MembershipApi"] });
  };

  const getCurrentTab = () => {
    switch (selectedTab) {
      case "groups":
        return <CampusGroups campus={campus} />;
      case "people":
      default:
        return <CampusPeople campus={campus} />;
    }
  };

  return (
    <>
      <PageBreadcrumbs items={[{ label: "Campuses", path: "/campuses" }, { label: campus?.name || "Campus" }]} />
      <CampusBanner campus={campus} onEdit={() => setEditing(true)} />
      <CampusNavigation selectedTab={selectedTab} onTabChange={setSelectedTab} />
      <div id="mainContent">{getCurrentTab()}</div>
      {editing && campus?.id && (
        <Dialog open={editing} onClose={() => setEditing(false)} maxWidth="sm" fullWidth>
          <DialogContent>
            <CampusEdit campus={campus} updatedFunction={handleUpdated} />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
