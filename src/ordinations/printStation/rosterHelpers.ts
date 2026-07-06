// Pure data-shaping for the print-station roster. No React/ApiHelper — inputs are
// already-fetched, already-scoped arrays.
import { type PersonInterface } from "@churchapps/helpers";
import { type PersonOrdinationInterface } from "../../people/components/PersonOrdinationInterface";
import { type OrdinationTypeInterface } from "../../settings/components/OrdinationTypeInterface";
import { type CampusInterface } from "../../settings/components/CampusInterface";
import { type RosterRow } from "./rosterTypes";

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
