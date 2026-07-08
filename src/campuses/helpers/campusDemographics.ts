import { type PersonInterface } from "@churchapps/helpers";

// Pure, client-side demographic aggregation shared by the Campuses list cards
// and the campus detail page. Derived from the same person records the People
// page already loads (no dedicated aggregation endpoint).

export interface GenderSplit { male: number; female: number; unspecified: number }
export interface Bucket { label: string; count: number }
export interface CampusDemographics {
  total: number;
  gender: GenderSplit;
  ageGroups: Bucket[];
  membershipStatus: Bucket[];
}

const AGE_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "0–17", min: 0, max: 17 },
  { label: "18–34", min: 18, max: 34 },
  { label: "35–54", min: 35, max: 54 },
  { label: "55+", min: 55, max: 200 }
];

export function ageFromBirthDate(birthDate?: Date | string | null): number | null {
  if (!birthDate) return null;
  const d = typeof birthDate === "string" ? new Date(birthDate) : birthDate;
  if (!(d instanceof Date) || isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

export function computeCampusDemographics(people: PersonInterface[]): CampusDemographics {
  const gender: GenderSplit = { male: 0, female: 0, unspecified: 0 };
  const ageGroups: Bucket[] = AGE_BUCKETS.map((b) => ({ label: b.label, count: 0 }));
  const statusMap = new Map<string, number>();

  for (const p of people) {
    const g = (p.gender || "").trim().toLowerCase();
    if (g.startsWith("m")) gender.male++;
    else if (g.startsWith("f")) gender.female++;
    else gender.unspecified++;

    const age = ageFromBirthDate(p.birthDate as any);
    if (age !== null) {
      const idx = AGE_BUCKETS.findIndex((b) => age >= b.min && age <= b.max);
      if (idx >= 0) ageGroups[idx].count++;
    }

    const status = (p.membershipStatus || "").trim() || "Unspecified";
    statusMap.set(status, (statusMap.get(status) || 0) + 1);
  }

  const membershipStatus = [...statusMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  return { total: people.length, gender, ageGroups, membershipStatus };
}

// Group people by their campusId. People with no campusId land under "".
export function groupPeopleByCampus(people: PersonInterface[]): Map<string, PersonInterface[]> {
  const map = new Map<string, PersonInterface[]>();
  for (const p of people) {
    const key = (p as any).campusId || "";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return map;
}
