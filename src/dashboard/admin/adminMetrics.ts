// Pure metric derivation for the church-admin command-view dashboard (quick task 2). No React,
// no ApiHelper — inputs are already-fetched, already-scoped arrays/objects. Date-only strings are
// parsed as LOCAL calendar days (never `new Date("YYYY-MM-DD")`, which is UTC-midnight and shifts a
// day in negative-offset zones). Weekly-series `week` values come back from the API as full ISO
// datetimes (STR_TO_DATE(...) → a real DATE), so plain `new Date(week)` is safe for those.
//
// The FOCUS is church operations: people totals, membership-status breakdown, active/visitor counts,
// and going-forward login / new-member signals. Ordinations are DE-EMPHASIZED to a single distinct-
// people-per-type breakdown (byOrdinationType) — the old byStatus/byCampus/expiring/expired/unpaid
// emphasis is gone.
import { type PersonOrdinationInterface } from "../../people/components/PersonOrdinationInterface";
import { type OrdinationTypeInterface } from "../../settings/components/OrdinationTypeInterface";

export interface NameCount {
  name: string;
  count: number;
}

// A point on any of the three aligned weekly series (attendance uses `visits`, logins/new-members
// use `count`). `week` is a full ISO datetime string from the API.
export interface WeekPoint {
  week: string;
  count?: number;
  visits?: number;
}

// Local subset of the /people/demographics payload the dashboard consumes (the demographics page's
// own interface is not exported — this is the church-wide membership-status breakdown + total).
export interface DemographicsData {
  total: number;
  membershipStatus: NameCount[];
  gender?: NameCount[];
  campus?: { name: string; count: number; id: string }[];
}

// One row from /membership/accessLogs/recent (the READ side of the existing login-capture write).
export interface RecentLogin {
  id: string;
  churchId?: string;
  userId?: string;
  appName?: string;
  loginTime: string;
}

// One row from /attendancerecords/groupsummary.
export interface GroupSummaryRow {
  groupId: string;
  sessionCount: number;
  totalVisits: number;
  averageAttendance: number;
  lastSessionDate: string | null;
}

// Membership-status buckets that count as "active people". Matched case-insensitively against the
// free-text membershipStatus values coming out of the demographics aggregate.
const ACTIVE_STATUSES = ["member", "regular attendee", "staff"];
const VISITOR_STATUSES = ["visitor"];

export interface MembershipMetrics {
  totalPeople: number;
  activePeople: number;
  visitors: number;
  membershipStatus: NameCount[];
}

export interface OrdinationBreakdown {
  byOrdinationType: NameCount[];
  totalMinisters: number;
}

// Parse a date-only "YYYY-MM-DD" as a LOCAL calendar day. Returns null for null/blank/malformed.
// Kept for any date-ONLY field (grantedDate/expirationDate style); weekly-series values are full
// datetimes and do not need it.
export function parseLocalDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

// Derive people totals / active / visitors + the raw status breakdown from the demographics payload.
export function deriveMembershipMetrics(demographics?: DemographicsData | null): MembershipMetrics {
  const membershipStatus = (demographics?.membershipStatus ?? []).map((s) => ({ name: s.name, count: Number(s.count) }));
  const totalPeople = demographics?.total ?? membershipStatus.reduce((sum, s) => sum + s.count, 0);
  let activePeople = 0;
  let visitors = 0;
  membershipStatus.forEach((s) => {
    const key = (s.name || "").trim().toLowerCase();
    if (ACTIVE_STATUSES.includes(key)) activePeople += s.count;
    if (VISITOR_STATUSES.includes(key)) visitors += s.count;
  });
  return { totalPeople, activePeople, visitors, membershipStatus };
}

// The ONLY surviving ordination panel: DISTINCT people per ordination type, resolved to type name.
// Also returns totalMinisters (distinct people holding ANY credential) for the panel caption.
export function computeOrdinationBreakdown(
  ords: PersonOrdinationInterface[],
  types: OrdinationTypeInterface[]
): OrdinationBreakdown {
  const typeNameById = new Map<string, string>();
  types.forEach((t) => {
    if (t.id) typeNameById.set(t.id, t.name ?? "Unknown");
  });

  const ministerIds = new Set<string>();
  const peopleByType = new Map<string, Set<string>>();
  ords.forEach((o) => {
    if (o.personId) ministerIds.add(o.personId);
    const typeId = o.ordinationTypeId ?? "";
    if (!peopleByType.has(typeId)) peopleByType.set(typeId, new Set<string>());
    if (o.personId) peopleByType.get(typeId)!.add(o.personId);
  });

  const byOrdinationType: NameCount[] = [];
  peopleByType.forEach((people, typeId) => {
    const name = typeId ? typeNameById.get(typeId) ?? "Unknown" : "Unknown";
    byOrdinationType.push({ name, count: people.size });
  });
  byOrdinationType.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  return { byOrdinationType, totalMinisters: ministerIds.size };
}

// Logins recorded in the most recent week of the /accessLogs/weeklycount series (0 if empty). The
// series is ascending, so the last point is the current week.
export function loginsThisWeek(weekly: WeekPoint[] | undefined): number {
  if (!weekly || weekly.length === 0) return 0;
  const last = weekly[weekly.length - 1];
  return Number(last?.count ?? 0);
}

// The earliest date present across the supplied going-forward series (logins + new-members), used to
// honestly label "tracked from <date>". Returns null when no data has accumulated yet (so the UI can
// fall back to "this deploy"). Weekly `week` values are full ISO datetimes — plain Date parsing.
export function trackingSince(...series: (WeekPoint[] | undefined)[]): string | null {
  let earliestTime: number | null = null;
  let earliestRaw: string | null = null;
  series.forEach((s) =>
    (s ?? []).forEach((p) => {
      const t = new Date(p.week).getTime();
      if (!isNaN(t) && (earliestTime === null || t < earliestTime)) {
        earliestTime = t;
        earliestRaw = p.week;
      }
    })
  );
  if (earliestRaw === null) return null;
  const d = new Date(earliestRaw);
  return isNaN(d.getTime()) ? null : d.toLocaleDateString();
}
