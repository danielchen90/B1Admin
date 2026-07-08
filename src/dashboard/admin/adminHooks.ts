import { useQuery } from "@tanstack/react-query";
import { type GroupInterface } from "@churchapps/helpers";
import { type DemographicsData, type WeekPoint, type RecentLogin, type GroupSummaryRow } from "./adminMetrics";

// Thin React Query hooks for the church-admin command view. Mirrors src/hooks/useOrdinationTypes:
// stable query keys (so callers share one cached fetch) + placeholderData for the array queries.
//
// Query keys STRIP the /membership module prefix (the ApiHelper config already points MembershipApi
// at the module base) — proven by DemographicsPage using ["/people/demographics","MembershipApi"]
// for the controller route /membership/people/demographics. The two Task-1/Task-2 additions
// (/accessLogs/*, /people/newmembertrend) follow the same convention.

// Church-wide membership-status / gender / campus counts + total (People-View gated server-side).
export const useDemographics = () =>
  useQuery<DemographicsData>({ queryKey: ["/people/demographics", "MembershipApi"] });

// Church-wide weekly attendance trend (groupId=0 → all groups). Returns [{week, visits}].
export const useAttendanceTrend = () =>
  useQuery<WeekPoint[]>({
    queryKey: ["/attendancerecords/trend?campusId=0&serviceId=0&serviceTimeId=0&groupId=0", "AttendanceApi"],
    placeholderData: []
  });

// All groups (for the count tile + names joined against the group summary).
export const useGroups = () =>
  useQuery<GroupInterface[]>({ queryKey: ["/groups", "MembershipApi"], placeholderData: [] });

// Per-group session/visit rollup over the last 13 weeks.
export const useGroupSummary = () =>
  useQuery<GroupSummaryRow[]>({ queryKey: ["/attendancerecords/groupsummary?weeks=13", "AttendanceApi"], placeholderData: [] });

// Most-recent logins (Task 1 READ endpoint over the existing AccessLog write). Going-forward only.
export const useRecentLogins = () =>
  useQuery<RecentLogin[]>({ queryKey: ["/accessLogs/recent", "MembershipApi"], placeholderData: [] });

// Weekly login counts (Task 1). Returns [{week, count}] ascending. Going-forward only.
export const useLoginsWeekly = () =>
  useQuery<WeekPoint[]>({ queryKey: ["/accessLogs/weeklycount", "MembershipApi"], placeholderData: [] });

// Weekly new-members trend from person.dateAdded (Task 2). Returns [{week, count}]. Going-forward only.
export const useNewMembersTrend = () =>
  useQuery<WeekPoint[]>({ queryKey: ["/people/newmembertrend", "MembershipApi"], placeholderData: [] });
