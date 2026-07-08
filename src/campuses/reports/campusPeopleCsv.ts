import { type PersonInterface } from "@churchapps/helpers";
import { ageFromBirthDate } from "../helpers/campusDemographics";
import { type OrdinationInfo, ordinationTitle } from "../helpers/campusOrdinations";

// Flat per-person rows for the per-campus CSV export, fed to <ExportButton>
// (ExportLink maps each header's `key` → `label`). Mirrors the flattening in
// people/PeoplePage.getExportData but scoped to the campus roster columns, with
// the leadership section + ordination title surfaced so the export reflects the
// same "leaders first, then members" grouping as the on-screen list.

export const CAMPUS_PEOPLE_HEADERS: { label: string; key: string }[] = [
  { label: "Section", key: "section" },
  { label: "Ordination", key: "ordination" },
  { label: "Display Name", key: "displayName" },
  { label: "First Name", key: "firstName" },
  { label: "Last Name", key: "lastName" },
  { label: "Gender", key: "gender" },
  { label: "Age", key: "age" },
  { label: "Membership Status", key: "membershipStatus" },
  { label: "Marital Status", key: "maritalStatus" },
  { label: "Email", key: "email" },
  { label: "Mobile Phone", key: "mobilePhone" },
  { label: "Home Phone", key: "homePhone" },
  { label: "Address", key: "address1" },
  { label: "City", key: "city" },
  { label: "State", key: "state" },
  { label: "Zip", key: "zip" }
];

// `people` is expected already ordered leaders-first by the caller.
export function toCampusPeopleCsv(people: PersonInterface[], ordByPerson: Map<string, OrdinationInfo>): Record<string, any>[] {
  return people.map((p) => {
    const ordination = ordinationTitle(p, ordByPerson);
    const age = ageFromBirthDate(p.birthDate as any);
    return {
      section: ordination ? "Ordained Leader" : "Member",
      ordination,
      displayName: p.name?.display || "",
      firstName: p.name?.first || "",
      lastName: p.name?.last || "",
      gender: p.gender || "",
      age: age ?? "",
      membershipStatus: p.membershipStatus || "",
      maritalStatus: p.maritalStatus || "",
      email: p.contactInfo?.email || "",
      mobilePhone: p.contactInfo?.mobilePhone || "",
      homePhone: p.contactInfo?.homePhone || "",
      address1: p.contactInfo?.address1 || "",
      city: p.contactInfo?.city || "",
      state: p.contactInfo?.state || "",
      zip: p.contactInfo?.zip || ""
    };
  });
}
