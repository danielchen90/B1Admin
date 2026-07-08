import React from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageBreadcrumbs } from "../components/ui";
import { type CampusInterface } from "../settings/components/CampusInterface";
import { CampusBanner } from "./components/CampusBanner";
import { CampusNavigation } from "./components/CampusNavigation";
import { CampusPeople } from "./components/CampusPeople";
import { CampusGroups } from "./components/CampusGroups";

// Per-campus detail page: name in the header, a location map, and tabs of
// campus-scoped data. People is the only tab today; more slot in as new cases.
export const CampusPage: React.FC = () => {
  const params = useParams();
  const [selectedTab, setSelectedTab] = React.useState("people");
  const campusQuery = useQuery<CampusInterface>({ queryKey: [`/campuses/${params.id}`, "MembershipApi"], placeholderData: {} as CampusInterface });
  const campus = campusQuery.data;

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
      <CampusBanner campus={campus} />
      <CampusNavigation selectedTab={selectedTab} onTabChange={setSelectedTab} />
      <div id="mainContent">{getCurrentTab()}</div>
    </>
  );
};
