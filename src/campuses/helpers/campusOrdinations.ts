import { type PersonInterface } from "@churchapps/helpers";
import { type PersonOrdinationInterface } from "../../people/components/PersonOrdinationInterface";
import { type OrdinationTypeInterface } from "../../settings/components/OrdinationTypeInterface";

// Per-person ordination summary: the active credential titles a person holds,
// ordered by seniority (OrdinationType.sortOrder — lower = more senior).
export interface OrdinationInfo {
  titles: string[]; // e.g. ["Bishop", "Pastor"]
  primary: string; // most-senior title
  sortOrder: number; // most-senior sortOrder (for ranking leaders)
}

// Map personId → OrdinationInfo for everyone holding at least one ACTIVE
// ordination. Only "active" credentials count as current leadership.
export function buildOrdinationsByPerson(ordinations: PersonOrdinationInterface[], types: OrdinationTypeInterface[]): Map<string, OrdinationInfo> {
  const typeById = new Map(types.filter((t) => t.id).map((t) => [t.id as string, t]));
  const acc = new Map<string, { name: string; so: number }[]>();
  for (const o of ordinations) {
    if (o.status !== "active" || !o.personId) continue;
    const t = o.ordinationTypeId ? typeById.get(o.ordinationTypeId) : undefined;
    if (!acc.has(o.personId)) acc.set(o.personId, []);
    acc.get(o.personId)!.push({ name: t?.name || "Ordained", so: t?.sortOrder ?? 999 });
  }
  const map = new Map<string, OrdinationInfo>();
  for (const [personId, pairs] of acc) {
    pairs.sort((a, b) => a.so - b.so);
    const seen = new Set<string>();
    const titles = pairs.map((p) => p.name).filter((n) => (seen.has(n) ? false : (seen.add(n), true)));
    map.set(personId, { titles, primary: titles[0] || "", sortOrder: pairs[0]?.so ?? 999 });
  }
  return map;
}

const lastFirst = (p: PersonInterface) => `${p.name?.last || ""} ${p.name?.first || ""}`.trim().toLowerCase();

// Split a campus's people into ordained leaders (any active credential) and the
// rest. Leaders are ordered by seniority then name; members alphabetically.
export function splitCampusPeople(people: PersonInterface[], ordByPerson: Map<string, OrdinationInfo>) {
  const leaders: PersonInterface[] = [];
  const members: PersonInterface[] = [];
  for (const p of people) {
    if (p.id && ordByPerson.has(p.id)) leaders.push(p);
    else members.push(p);
  }
  leaders.sort((a, b) => {
    const sa = ordByPerson.get(a.id as string)!.sortOrder;
    const sb = ordByPerson.get(b.id as string)!.sortOrder;
    return sa !== sb ? sa - sb : lastFirst(a).localeCompare(lastFirst(b));
  });
  members.sort((a, b) => lastFirst(a).localeCompare(lastFirst(b)));
  return { leaders, members };
}

export const ordinationTitle = (p: PersonInterface, ordByPerson: Map<string, OrdinationInfo>): string => (p.id ? ordByPerson.get(p.id)?.titles.join(", ") || "" : "");
