// Pure client-side data layer for the leadership report (Phase 08). No React / ApiHelper —
// inputs are already-fetched, already-scoped arrays. Generalizes the Phase-7.1 print-station
// rosterHelpers substrate: ALL statuses (no active-only skip), extended filters (status +
// expiration window + free-text search), and NESTED 2-level grouping.
//
// The SHARED GROUPING CONTRACT block below is authored BYTE-IDENTICAL with the server copy in
// forks/Api/src/modules/membership/helpers/reportGrouping.ts (Plan 08-01) so the on-screen and
// PDF groupings provably cannot drift (RPT-05 matching). groupReport/filterReport consume
// STATUS_ORDER/dedupeKey/compareRows FROM that block — there is no second copy of the
// ordering/dedupe/sort logic anywhere in this file.
import { type PersonInterface } from "@churchapps/helpers";
import { type PersonOrdinationInterface } from "../../people/components/PersonOrdinationInterface";
import { type OrdinationTypeInterface } from "../../settings/components/OrdinationTypeInterface";
import { type CampusInterface } from "../../settings/components/CampusInterface";
import { type ReportRow, type ReportGroup, type ReportFilterSpec, type ReportGroupBy } from "./reportTypes";

// ===== SHARED GROUPING CONTRACT (RPT-05 parity) START =====
export const STATUS_ORDER = ["pending", "active", "suspended", "emeritus", "revoked"] as const;

export type GroupDim = "location" | "type" | "status";

export function dedupeKey(
  row: { personId: string; campusId: string; ordinationTypeId: string; status: string },
  dims: GroupDim[]
): string {
  const parts = dims.map((dim) => {
    if (dim === "location") return row.personId + "|" + row.campusId;
    if (dim === "type") return row.personId + "|" + row.ordinationTypeId;
    return row.personId + "|" + row.status;
  });
  return parts.join("|");
}

export function compareRows(
  a: { firstName: string; lastName: string; displayName: string },
  b: { firstName: string; lastName: string; displayName: string },
  sortBy: "lastName" | "firstName",
  sortDir: "asc" | "desc"
): number {
  const primaryField = sortBy === "lastName" ? "lastName" : "firstName";
  const otherField = sortBy === "lastName" ? "firstName" : "lastName";
  const dir = sortDir === "desc" ? -1 : 1;
  const primary = a[primaryField].localeCompare(b[primaryField], undefined, { sensitivity: "base" });
  if (primary !== 0) return primary * dir;
  const other = a[otherField].localeCompare(b[otherField], undefined, { sensitivity: "base" });
  if (other !== 0) return other;
  return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" });
}
// ===== SHARED GROUPING CONTRACT (RPT-05 parity) END =====

// ---------------------------------------------------------------------------
// Compose — one ReportRow per credential (ALL statuses, no active-only skip)
// ---------------------------------------------------------------------------

// Build the atomic report: one ReportRow per credential row, joined to the person (names),
// the ordination type (calling name + seniority) and the campus. Unlike the 7.1 roster this
// keeps EVERY non-removed credential regardless of status, and carries status + credential
// number + granted/expiration dates onto each row. The credential's OWN campusId is
// authoritative — NOT the person's home campus (Pitfall 2).
export function composeReport(
  ordinations: PersonOrdinationInterface[],
  people: PersonInterface[],
  types: OrdinationTypeInterface[],
  campuses: CampusInterface[]
): ReportRow[] {
  const peopleById = new Map<string, PersonInterface>();
  people.forEach((p) => {
    if (p.id) peopleById.set(p.id, p);
  });
  const typeById = new Map<string, OrdinationTypeInterface>();
  types.forEach((t) => {
    if (t.id) typeById.set(t.id, t);
  });
  const campusById = new Map<string, CampusInterface>();
  campuses.forEach((c) => {
    if (c.id) campusById.set(c.id, c);
  });

  const rows: ReportRow[] = [];
  ordinations.forEach((o) => {
    // NO active-only skip — the leadership roster lists all credential holders (RPT-01).
    const personId = o.personId ?? "";
    const person = peopleById.get(personId);
    if (!person) return; // name join miss — skip

    const first = person.name?.first ?? "";
    const last = person.name?.last ?? "";
    const displayName = person.name?.display ?? `${first} ${last}`.trim();
    const campusId = o.campusId ?? ""; // the CREDENTIAL's campus, not the person home campus
    const type = o.ordinationTypeId ? typeById.get(o.ordinationTypeId) : undefined;

    rows.push({
      personId,
      campusId,
      ordinationTypeId: o.ordinationTypeId ?? "",
      status: o.status ?? "",
      firstName: first,
      lastName: last,
      displayName,
      id: o.id ?? "",
      version: o.version ?? 0,
      paid: !!o.paid,
      exempt: !!o.exempt,
      person,
      campusName: campusById.get(campusId)?.name ?? "Unassigned",
      callingName: type?.name ?? "Unknown",
      callingSortOrder: type?.sortOrder ?? 999,
      credentialNumber: o.credentialNumber ?? null,
      grantedDate: o.grantedDate ?? null,
      expirationDate: o.expirationDate ?? null
    });
  });
  return rows;
}

// Distinct campusIds actually present in the (all-status) scoped rows, mapped to campuses
// A–Z — the SOLE campus-checkbox source (Pattern 4, Phase-1 isolation), never church-wide.
export function getAccessibleCampuses(
  ordinations: PersonOrdinationInterface[],
  campuses: CampusInterface[]
): CampusInterface[] {
  const campusById = new Map<string, CampusInterface>();
  campuses.forEach((c) => {
    if (c.id) campusById.set(c.id, c);
  });

  const distinctIds = new Set<string>();
  ordinations.forEach((o) => {
    if (o.campusId) distinctIds.add(o.campusId);
  });

  const result: CampusInterface[] = [];
  distinctIds.forEach((id) => {
    const campus = campusById.get(id);
    if (campus) result.push(campus);
  });
  result.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" }));
  return result;
}

// ---------------------------------------------------------------------------
// Filter — campus / type / status / expiration window / free-text search
// ---------------------------------------------------------------------------

// Parse a date-only "YYYY-MM-DD" as a LOCAL calendar day. AVOID `new Date("YYYY-MM-DD")`
// which parses as UTC midnight and shifts a day in negative-offset zones (Pitfall 4).
function parseLocalDateOnly(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function startOfLocalToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// Apply campus (non-empty = narrow, [] = all), type ([] = all), status ([] = all, using
// STATUS_ORDER membership), expiration window (null = skip; else keep rows whose local-day
// expiration is between today and today+N inclusive) and case-insensitive free-text search
// over "first last credentialNumber".
export function filterReport(rows: ReportRow[], spec: ReportFilterSpec): ReportRow[] {
  const today = startOfLocalToday();
  let cutoff: Date | null = null;
  if (spec.expiringWithinDays != null) {
    cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() + spec.expiringWithinDays);
  }
  const search = spec.search.trim().toLowerCase();

  return rows.filter((row) => {
    if (spec.campusIds.length > 0 && !spec.campusIds.includes(row.campusId)) return false;
    if (spec.ordinationTypeIds.length > 0 && !spec.ordinationTypeIds.includes(row.ordinationTypeId)) return false;
    // statuses is a subset of STATUS_ORDER (the panel builds it from STATUS_ORDER); [] = all.
    if (spec.statuses.length > 0 && !spec.statuses.includes(row.status)) return false;
    if (cutoff) {
      if (!row.expirationDate) return false;
      const exp = parseLocalDateOnly(row.expirationDate);
      if (!exp) return false;
      if (exp < today || exp > cutoff) return false;
    }
    if (search) {
      const hay = `${row.firstName} ${row.lastName} ${row.credentialNumber ?? ""}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    const pay = spec.paymentStatus ?? "all";
    if (pay === "paid" && !row.paid) return false;
    if (pay === "unpaid" && (row.paid || row.exempt)) return false;
    if (pay === "exempt" && !row.exempt) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Group — nested 2-level, consuming the SHARED CONTRACT for order/dedupe/sort
// ---------------------------------------------------------------------------

function toDim(groupBy: ReportGroupBy): GroupDim | null {
  if (groupBy === "location") return "location";
  if (groupBy === "type") return "type";
  if (groupBy === "status") return "status";
  return null; // "none"
}

// Status ordering via the SHARED STATUS_ORDER; unknown statuses sort last.
function statusIndex(status: string): number {
  const idx = (STATUS_ORDER as readonly string[]).indexOf(status);
  return idx === -1 ? STATUS_ORDER.length : idx;
}

interface RawBucket {
  key: string;
  label: string;
  sortOrder: number;
  rows: ReportRow[];
}

// Bucket rows for ONE grouping dimension, ordered per the LOCKED rules: location A–Z,
// type by callingSortOrder seniority, status by STATUS_ORDER index.
function bucketByDim(rows: ReportRow[], dim: GroupDim): RawBucket[] {
  const buckets = new Map<string, ReportRow[]>();
  rows.forEach((row) => {
    const key = dim === "location" ? row.campusId : dim === "type" ? row.ordinationTypeId : row.status;
    const existing = buckets.get(key);
    if (existing) existing.push(row);
    else buckets.set(key, [row]);
  });

  const out: RawBucket[] = [];
  buckets.forEach((bucketRows, key) => {
    const head = bucketRows[0];
    let label: string;
    let sortOrder: number;
    if (dim === "location") {
      label = head.campusName;
      sortOrder = 0; // assigned by A–Z index after sort
    } else if (dim === "type") {
      label = head.callingName;
      sortOrder = head.callingSortOrder;
    } else {
      label = head.status;
      sortOrder = statusIndex(head.status);
    }
    out.push({ key, label, sortOrder, rows: bucketRows });
  });

  const labelCmp = (a: RawBucket, b: RawBucket) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
  if (dim === "location") {
    out.sort(labelCmp);
    out.forEach((b, i) => {
      b.sortOrder = i;
    });
  } else {
    out.sort((a, b) => a.sortOrder - b.sortOrder || labelCmp(a, b));
  }
  return out;
}

// Build a leaf group: dedupe via the SHARED dedupeKey over the active dims, compute the
// per-person "Ordination(s)" cell, then secondary-sort via the SHARED compareRows.
function buildLeaf(
  rows: ReportRow[],
  activeDims: GroupDim[],
  spec: ReportFilterSpec,
  key: string,
  label: string,
  sortOrder: number,
  level: number
): ReportGroup {
  // Grouping by type/status shows the row's single calling; otherwise aggregate the
  // person's distinct callings within this group (RPT-04 "Ordination(s)" cell).
  const singleCalling = activeDims.includes("type") || activeDims.includes("status");
  const callingsByPerson = new Map<string, string[]>();
  if (!singleCalling) {
    rows.forEach((r) => {
      const list = callingsByPerson.get(r.personId) ?? [];
      if (!list.includes(r.callingName)) list.push(r.callingName);
      callingsByPerson.set(r.personId, list);
    });
  }

  const seen = new Set<string>();
  const deduped: ReportRow[] = [];
  rows.forEach((r) => {
    const k = activeDims.length > 0 ? dedupeKey(r, activeDims) : r.personId;
    if (seen.has(k)) return;
    seen.add(k);
    const ordinationsCell = singleCalling ? r.callingName : (callingsByPerson.get(r.personId) ?? [r.callingName]).join(", ");
    deduped.push({ ...r, ordinationsCell });
  });
  deduped.sort((a, b) => compareRows(a, b, spec.sortBy, spec.sortDir));

  return {
    key,
    label,
    sortOrder,
    level,
    rows: deduped,
    personIds: Array.from(new Set(deduped.map((r) => r.personId)))
  };
}

// Produce nested 2-level groups per groupBy1 then groupBy2 ("none" secondary = single level).
// The active dims array (1 or 2 GroupDims) drives dedupeKey; group ordering + row sorting come
// straight from the SHARED GROUPING CONTRACT block.
export function groupReport(rows: ReportRow[], spec: ReportFilterSpec): ReportGroup[] {
  const dim1 = toDim(spec.groupBy1);
  const dim2 = toDim(spec.groupBy2);
  const activeDims: GroupDim[] = [];
  if (dim1) activeDims.push(dim1);
  if (dim2) activeDims.push(dim2);

  // No grouping at all — a single flat "All Leaders" leaf.
  if (activeDims.length === 0) {
    const leaf = buildLeaf(rows, activeDims, spec, "all", "All Leaders", 0, 0);
    return leaf.rows.length > 0 ? [leaf] : [];
  }

  const primaryBuckets = bucketByDim(rows, dim1 as GroupDim);

  // Single level — each primary bucket becomes a leaf.
  if (!dim2) {
    return primaryBuckets
      .map((b) => buildLeaf(b.rows, activeDims, spec, b.key, b.label, b.sortOrder, 0))
      .filter((g) => g.rows.length > 0);
  }

  // Nested — each primary bucket subdivided by dim2 into leaf subGroups.
  const groups: ReportGroup[] = [];
  primaryBuckets.forEach((pb) => {
    const subBuckets = bucketByDim(pb.rows, dim2);
    const subGroups = subBuckets
      .map((sb) => buildLeaf(sb.rows, activeDims, spec, pb.key + "|" + sb.key, sb.label, sb.sortOrder, 1))
      .filter((g) => g.rows.length > 0);
    if (subGroups.length === 0) return;
    const personIds = Array.from(new Set(subGroups.flatMap((s) => s.personIds)));
    groups.push({
      key: pb.key,
      label: pb.label,
      sortOrder: pb.sortOrder,
      level: 0,
      rows: [],
      personIds,
      subGroups
    });
  });
  return groups;
}

// Aggregate a person's distinct calling names (for the "Ordination(s)" cell when grouping
// none/location). Exported for reuse/testing; buildLeaf inlines the same aggregation.
export function aggregateOrdinations(personRows: ReportRow[]): string {
  const names: string[] = [];
  const seen = new Set<string>();
  personRows.forEach((r) => {
    if (seen.has(r.callingName)) return;
    seen.add(r.callingName);
    names.push(r.callingName);
  });
  return names.join(", ");
}
