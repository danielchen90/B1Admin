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
  const { selectedTab, onTabChange, ordinationCount } = props;

  const tabs: NavigationTab[] = useMemo(() => {
    const t: NavigationTab[] = [
      { value: "details", label: Locale.label("people.personNavigation.details"), icon: <PersonIcon /> },
      { value: "notes", label: Locale.label("people.personNavigation.notes"), icon: <NotesIcon /> },
      { value: "groups", label: Locale.label("people.personNavigation.groups"), icon: <GroupIcon /> },
      { value: "attendance", label: Locale.label("people.personNavigation.attendance"), icon: <AttendanceIcon /> },
      { value: "donations", label: Locale.label("people.personNavigation.donations"), icon: <DonationIcon /> }
    ];
    // Count-gated: the Ordinations tab is shown only when the person already
    // holds >=1 credential (locked decision; the "credential a person with none"
    // entry point lives in the leadership hub, Plan 05).
    if ((ordinationCount ?? 0) > 0) t.push({ value: "ordinations", label: "Ordinations", icon: <OrdinationIcon /> });
    return t;
  }, [ordinationCount]);

  return (
    <NavigationTabs
      selectedTab={selectedTab}
      onTabChange={onTabChange}
      tabs={tabs}
    />
  );
});
