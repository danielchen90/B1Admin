import {
  Group as GroupIcon,
  VolunteerActivism as DonationIcon,
  CalendarMonth as AttendanceIcon,
  Notes as NotesIcon,
  Person as PersonIcon,
  WorkspacePremium as OrdinationIcon
} from "@mui/icons-material";
import { memo, useMemo } from "react";
import { Locale } from "@churchapps/apphelper";
import { NavigationTabs, type NavigationTab } from "../../components/ui";

interface Props {
  selectedTab: string;
  onTabChange: (tab: string) => void;
  ordinationCount?: number;
}

export const PersonNavigation = memo((props: Props) => {
  const { selectedTab, onTabChange } = props;

  const tabs: NavigationTab[] = useMemo(() => {
    const t: NavigationTab[] = [
      { value: "details", label: Locale.label("people.personNavigation.details"), icon: <PersonIcon /> },
      { value: "notes", label: Locale.label("people.personNavigation.notes"), icon: <NotesIcon /> },
      { value: "groups", label: Locale.label("people.personNavigation.groups"), icon: <GroupIcon /> },
      { value: "attendance", label: Locale.label("people.personNavigation.attendance"), icon: <AttendanceIcon /> },
      { value: "donations", label: Locale.label("people.personNavigation.donations"), icon: <DonationIcon /> }
    ];
    // Always show the Ordinations tab, even for people with no current credential,
    // so staff can add a first ordination straight from the person's detail page
    // (the tab's empty state hosts the "Add ordination" flow).
    t.push({ value: "ordinations", label: "Ordinations", icon: <OrdinationIcon /> });
    return t;
  }, []);

  return (
    <NavigationTabs
      selectedTab={selectedTab}
      onTabChange={onTabChange}
      tabs={tabs}
    />
  );
});
