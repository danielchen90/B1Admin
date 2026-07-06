// Pure data-shaping for the print-station roster. No React/ApiHelper — inputs are
// already-fetched, already-scoped arrays.
import { type PersonInterface } from "@churchapps/helpers";
import { type PersonOrdinationInterface } from "../../people/components/PersonOrdinationInterface";
import { type OrdinationTypeInterface } from "../../settings/components/OrdinationTypeInterface";
import { type CampusInterface } from "../../settings/components/CampusInterface";
import { type RosterRow, type RosterGroup, type RosterFilterSpec } from "./rosterTypes";

// Compose the atomic roster: one RosterRow per ACTIVE credential row, joined to the
// person (names), the ordination type (calling name + seniority), and the campus.
// The credential's OWN campusId is authoritative — NOT the person's home campus (Pitfall 2).
export function composeRoster(
  activeOrdinations: PersonOrdinationInterface[],
  people: PersonInterface[],
  types: OrdinationTypeInterface[],
  campuses: CampusInterface[]
): RosterRow[] {
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

  const rows: RosterRow[] = [];
  activeOrdinations.forEach((o) => {
    // Defensive re-filter — the caller passes active rows, but never trust it.
    if (o.status !== "active") return;
    const personId = o.personId ?? "";
    const person = peopleById.get(personId);
    if (!person) return; // name join miss — skip

    const first = person.name?.first ?? "";
    const last = person.name?.last ?? "";
    const displayName = person.name?.display ?? `${first} ${last}`.trim();
    const campusId = o.campusId ?? ""; // the CREDENTIAL's campus, not the person home campus
    const type = o.ordinationTypeId ? typeById.get(o.ordinationTypeId) : undefined;

    rows.push({
      person,
      personId,
      displayName,
      lastName: last,
      firstName: first,
      campusId,
      campusName: campusById.get(campusId)?.name ?? "Unassigned",
      ordinationTypeId: o.ordinationTypeId ?? "",
      callingName: type?.name ?? "Unknown",
      callingSortOrder: type?.sortOrder ?? 999
    });
  });
  return rows;
}

// Derive the accessible-campus checkbox list from the DISTINCT campusIds actually
// present in the scoped active credentials (Pattern 4 — Phase-1 isolation). This is
// the SOLE source of truth for the campus filter — never the church-wide /campuses.
export function getAccessibleCampuses(
  activeOrdinations: PersonOrdinationInterface[],
  campuses: CampusInterface[]
): CampusInterface[] {
  const campusById = new Map<string, CampusInterface>();
  campuses.forEach((c) => {
    if (c.id) campusById.set(c.id, c);
  });

  const distinctIds = new Set<string>();
  activeOrdinations.forEach((o) => {
    if (o.status !== "active") return;
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
// Filter + group + sort + dedupe
// ---------------------------------------------------------------------------

// Apply the campus checkbox filter + the OR calling filter. Empty campusIds keeps
// none (the UI pre-checks all, so empty == a deliberate empty selection); empty
// ordinationTypeIds keeps all (no calling filter).
export function filterRoster(rows: RosterRow[], spec: RosterFilterSpec): RosterRow[] {
  return rows.filter((row) => {
    if (!spec.campusIds.includes(row.campusId)) return false;
    if (spec.ordinationTypeIds.length > 0 && !spec.ordinationTypeIds.includes(row.ordinationTypeId)) return false;
    return true;
  });
}

// Case-insensitive secondary comparator honoring spec.sortBy + spec.sortDir, tie-
// breaking on the other name field then displayName.
function makeRowComparator(spec: RosterFilterSpec): (a: RosterRow, b: RosterRow) => number {
  const dir = spec.sortDir === "desc" ? -1 : 1;
  const primary: "lastName" | "firstName" = spec.sortBy === "firstName" ? "firstName" : "lastName";
  const secondary: "lastName" | "firstName" = primary === "lastName" ? "firstName" : "lastName";
  const cmp = (x: string, y: string) => x.localeCompare(y, undefined, { sensitivity: "base" });
  return (a, b) => {
    let r = cmp(a[primary], b[primary]);
    if (r === 0) r = cmp(a[secondary], b[secondary]);
    if (r === 0) r = cmp(a.displayName, b.displayName);
    return r * dir;
  };
}

// Keep the first row per identity key, dropping later duplicates (order-preserving).
function dedupeBy(rows: RosterRow[], keyFn: (r: RosterRow) => string): RosterRow[] {
  const seen = new Set<string>();
  const out: RosterRow[] = [];
  rows.forEach((r) => {
    const k = keyFn(r);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(r);
  });
  return out;
}

function distinctIds(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

// Bucket + dedupe + sort the atomic rows into presentation groups per the LOCKED
// rules:
//   none     — one group, distinct personId.
//   location — bucket by campusId, distinct (personId, campusId) so a person with
//              multiple callings at one campus appears once (Pitfall 5).
//   calling  — bucket by ordinationTypeId, a person appears once per calling they
//              hold (multi-calling person shows in EACH calling group).
// Groups order by name A–Z (location) / callingSortOrder seniority (calling).
export function groupRoster(rows: RosterRow[], spec: RosterFilterSpec): RosterGroup[] {
  const comparator = makeRowComparator(spec);

  if (spec.groupBy === "none") {
    const deduped = dedupeBy(rows, (r) => r.personId).sort(comparator);
    return [
      {
        key: "all",
        label: "All Ministers",
        sortOrder: 0,
        rows: deduped,
        personIds: distinctIds(deduped.map((r) => r.personId))
      }
    ];
  }

  const buckets = new Map<string, RosterRow[]>();
  rows.forEach((row) => {
    const bucketKey = spec.groupBy === "location" ? row.campusId : row.ordinationTypeId;
    const existing = buckets.get(bucketKey);
    if (existing) existing.push(row);
    else buckets.set(bucketKey, [row]);
  });

  const dedupeKey =
    spec.groupBy === "location"
      ? (r: RosterRow) => `${r.personId}|${r.campusId}`
      : (r: RosterRow) => `${r.personId}|${r.ordinationTypeId}`;

  const groups: RosterGroup[] = [];
  buckets.forEach((bucketRows, bucketKey) => {
    const deduped = dedupeBy(bucketRows, dedupeKey).sort(comparator);
    const head = deduped[0] ?? bucketRows[0];
    groups.push({
      key: bucketKey,
      label: spec.groupBy === "location" ? head.campusName : head.callingName,
      // location sortOrder assigned by A–Z index below; calling uses seniority.
      sortOrder: spec.groupBy === "calling" ? head.callingSortOrder : 0,
      rows: deduped,
      personIds: distinctIds(deduped.map((r) => r.personId))
    });
  });

  const labelCmp = (a: RosterGroup, b: RosterGroup) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" });

  if (spec.groupBy === "location") {
    groups.sort(labelCmp);
    groups.forEach((g, i) => {
      g.sortOrder = i;
    });
  } else {
    groups.sort((a, b) => a.sortOrder - b.sortOrder || labelCmp(a, b));
  }
  return groups;
}

// Distinct union of personIds across every group — the global select-all source.
export function allPersonIds(groups: RosterGroup[]): string[] {
  const set = new Set<string>();
  groups.forEach((g) => g.personIds.forEach((id) => set.add(id)));
  return Array.from(set);
}
