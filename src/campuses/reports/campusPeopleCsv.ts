import { type PersonInterface } from "@churchapps/helpers";
import { ageFromBirthDate } from "../helpers/campusDemographics";

// Flat per-person rows for the per-campus CSV export, fed to <ExportButton>
// (ExportLink maps each header's `key` → `label`). Mirrors the flattening in
// people/PeoplePage.getExportData but scoped to the campus roster columns.

export const CAMPUS_PEOPLE_HEADERS: { label: string; key: string }[] = [
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

export function toCampusPeopleCsv(people: PersonInterface[]): Record<string, any>[] {
  return people.map((p) => {
    const age = ageFromBirthDate(p.birthDate as any);
    return {
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
