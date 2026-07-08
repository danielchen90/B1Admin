import { People as PeopleIcon, Groups as GroupsIcon } from "@mui/icons-material";
import { memo, useMemo } from "react";
import { NavigationTabs, type NavigationTab } from "../../components/ui";

interface Props {
  selectedTab: string;
  onTabChange: (tab: string) => void;
}

// Campus detail tab strip. People + Groups today; future campus-scoped tabs
// (services, giving, etc.) are added here + as a case in CampusPage.
export const CampusNavigation = memo((props: Props) => {
  const tabs: NavigationTab[] = useMemo(() => [
    { value: "people", label: "People", icon: <PeopleIcon /> },
    { value: "groups", label: "Groups", icon: <GroupsIcon /> }
  ], []);
  return <NavigationTabs selectedTab={props.selectedTab} onTabChange={props.onTabChange} tabs={tabs} />;
});
