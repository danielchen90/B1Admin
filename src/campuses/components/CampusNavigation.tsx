import { People as PeopleIcon } from "@mui/icons-material";
import { memo, useMemo } from "react";
import { NavigationTabs, type NavigationTab } from "../../components/ui";

interface Props {
  selectedTab: string;
  onTabChange: (tab: string) => void;
}

// Campus detail tab strip. People-only for now; future campus-scoped tabs
// (groups, services, giving, etc.) are added here + as a case in CampusPage.
export const CampusNavigation = memo((props: Props) => {
  const tabs: NavigationTab[] = useMemo(() => [{ value: "people", label: "People", icon: <PeopleIcon /> }], []);
  return <NavigationTabs selectedTab={props.selectedTab} onTabChange={props.onTabChange} tabs={tabs} />;
});
