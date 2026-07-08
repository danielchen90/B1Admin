// Pure metric derivation for the admin dashboard (quick task 1). No React, no ApiHelper —
// inputs are already-fetched, already-scoped arrays. Mirrors the reportHelpers pattern:
// the credential's OWN campusId is authoritative, and date-only strings are parsed as LOCAL
// calendar days (never `new Date("YYYY-MM-DD")`, which is UTC-midnight and shifts a day in
// negative-offset zones). Consumes STATUS_ORDER from the shared report layer so the donut's
// status ordering matches the leadership report.
import { type PersonOrdinationInterface } from "../../people/components/PersonOrdinationInterface";
import { type CampusInterface } from "../../settings/components/CampusInterface";
import { type OrdinationTypeInterface } from "../../settings/components/OrdinationTypeInterface";
import { STATUS_ORDER } from "../../ordinations/reports/reportHelpers";

// Named thresholds — the expiring-soon horizon and the recently-issued list length.
export const EXPIRING_SOON_DAYS = 60;
export const RECENT_GRANTS_LIMIT = 5;
// Statuses that should NOT count as "expired still-on-file" even if their date is past.
const EXPIRED_EXCLUDED_STATUSES = ["revoked"];

export interface NameCount {
  name: string;
  count: number;
}

export interface RecentGrant {
  id: string;
  personId: string;
  campusId: string;
  campusName: string;
  ordinationTypeId: string;
  callingName: string;
  credentialNumber: string | null;
  grantedDate: string | null;
}

export interface AdminMetrics {
  totalMinisters: number;
  activeCredentials: number;
  expiringSoon: number;
  expired: number;
  unpaid: number;
  byStatus: NameCount[];
  byCampus: NameCount[];
  recentGrants: RecentGrant[];
}

// Parse a date-only "YYYY-MM-DD" as a LOCAL calendar day. Returns null for null/blank/malformed.
function parseLocalDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function titleCase(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Derive the admin-dashboard metrics from the raw credential rows + campus/type vocabulary.
// `now` is injectable for deterministic tests.
export function computeAdminMetrics(
  ords: PersonOrdinationInterface[],
  campuses: CampusInterface[],
  types: OrdinationTypeInterface[],
  now: Date = new Date()
): AdminMetrics {
  const today = startOfLocalDay(now);
  const horizon = new Date(today.getFullYear(), today.getMonth(), today.getDate() + EXPIRING_SOON_DAYS);

  const campusNameById = new Map<string, string>();
  campuses.forEach((c) => {
    if (c.id) campusNameById.set(c.id, c.name ?? "Unassigned");
  });
  const typeNameById = new Map<string, string>();
  types.forEach((t) => {
    if (t.id) typeNameById.set(t.id, t.name ?? "Unknown");
  });

  const ministerIds = new Set<string>();
  let activeCredentials = 0;
  let expiringSoon = 0;
  let expired = 0;
  let unpaid = 0;

  const statusCounts = new Map<string, number>();
  const activeByCampus = new Map<string, number>(); // campusId -> active count

  ords.forEach((o) => {
    const status = o.status ?? "";
    if (o.personId) ministerIds.add(o.personId);

    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);

    const exp = parseLocalDateOnly(o.expirationDate);

    if (status === "active") {
      activeCredentials += 1;
      const campusKey = o.campusId ?? "";
      activeByCampus.set(campusKey, (activeByCampus.get(campusKey) ?? 0) + 1);

      if (exp && exp >= today && exp <= horizon) expiringSoon += 1;
      if (o.paid === false && o.exempt !== true) unpaid += 1;
    }

    // Expired = a past expiration on any still-on-file (non-revoked) credential.
    if (exp && exp < today && !EXPIRED_EXCLUDED_STATUSES.includes(status)) expired += 1;
  });

  // byStatus over STATUS_ORDER, skipping zero-count buckets (feeds the donut).
  const byStatus: NameCount[] = [];
  (STATUS_ORDER as readonly string[]).forEach((status) => {
    const count = statusCounts.get(status) ?? 0;
    if (count > 0) byStatus.push({ name: titleCase(status), count });
  });

  // byCampus — active credentials per campus, name-resolved, "Unassigned" fallback, A–Z.
  const byCampus: NameCount[] = [];
  activeByCampus.forEach((count, campusId) => {
    const name = campusId ? campusNameById.get(campusId) ?? "Unassigned" : "Unassigned";
    byCampus.push({ name, count });
  });
  byCampus.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  // recentGrants — the 5 most recently granted credentials (by local grantedDate desc). Rows
  // with no parseable grantedDate are excluded from the recency ranking.
  const recentGrants: RecentGrant[] = ords
    .filter((o) => parseLocalDateOnly(o.grantedDate) !== null)
    .sort((a, b) => (parseLocalDateOnly(b.grantedDate)!.getTime() - parseLocalDateOnly(a.grantedDate)!.getTime()))
    .slice(0, RECENT_GRANTS_LIMIT)
    .map((o) => ({
      id: o.id ?? "",
      personId: o.personId ?? "",
      campusId: o.campusId ?? "",
      campusName: o.campusId ? campusNameById.get(o.campusId) ?? "Unassigned" : "Unassigned",
      ordinationTypeId: o.ordinationTypeId ?? "",
      callingName: o.ordinationTypeId ? typeNameById.get(o.ordinationTypeId) ?? "Unknown" : "Unknown",
      credentialNumber: o.credentialNumber ?? null,
      grantedDate: o.grantedDate ?? null
    }));

  return {
    totalMinisters: ministerIds.size,
    activeCredentials,
    expiringSoon,
    expired,
    unpaid,
    byStatus,
    byCampus,
    recentGrants
  };
}
