// bindings.ts — the field-binding catalog (RESEARCH §Field Binding Catalog).
//
// A `binding` is a stable string key the Phase 6 renderer resolves against a real
// (person, ordination, campus, church) record. The required keys are LOCKED; the
// extensions are a modest, justified set from the Phase 2 data model. SAMPLE_BINDINGS
// drives the editor's live preview; resolveBinding is reused by 05-06's real-person
// preview and by the Phase 6 renderer.

import dayjs from "dayjs";

export interface BindingDef {
  key: string;
  label: string;
  isDate?: boolean;
}

// Required (locked) keys first, then justified extensions. Date keys flagged.
export const BINDING_CATALOG: BindingDef[] = [
  // --- person ---
  { key: "person.lastName", label: "Person — Last Name" }, // required
  { key: "person.firstName", label: "Person — First Name" }, // extension
  { key: "person.displayName", label: "Person — Display Name" }, // extension
  { key: "person.middleName", label: "Person — Middle Name" }, // extension
  // --- ordination type ---
  { key: "ordinationType.name", label: "Ordination Type — Name" }, // required
  { key: "ordinationType.code", label: "Ordination Type — Code" }, // extension
  // --- campus ---
  { key: "campus.name", label: "Campus — Name" }, // required
  { key: "campus.city", label: "Campus — City" }, // extension
  { key: "campus.state", label: "Campus — State" }, // extension
  // --- credential / ordination ---
  { key: "credentialNumber", label: "Credential Number" }, // required
  { key: "ordination.grantedDate", label: "Granted Date", isDate: true }, // required
  { key: "ordination.expirationDate", label: "Expiration Date", isDate: true }, // required
  { key: "ordination.status", label: "Status" }, // required
  // --- church ---
  { key: "church.name", label: "Church — Name" }, // extension (issuing org line)
];

// Friendly binding key -> the real nested path on a fetched record (05-06 / Phase 6
// real-person preview reuses this when resolving an actual Person/PersonOrdination).
// Person.name is a Name object (first/middle/last/display); the others are flat.
export const BINDING_REAL_PATHS: Record<string, string> = {
  "person.lastName": "person.name.last",
  "person.firstName": "person.name.first",
  "person.displayName": "person.name.display",
  "person.middleName": "person.name.middle",
  "ordinationType.name": "ordinationType.name",
  "ordinationType.code": "ordinationType.code",
  "campus.name": "campus.name",
  "campus.city": "campus.city",
  "campus.state": "campus.state",
  "credentialNumber": "ordination.credentialNumber",
  "ordination.grantedDate": "ordination.grantedDate",
  "ordination.expirationDate": "ordination.expirationDate",
  "ordination.status": "ordination.status",
  "church.name": "church.name",
};

// Sample values for the default live preview (flat keys matching BINDING_CATALOG).
export const SAMPLE_BINDINGS: Record<string, string> = {
  "person.lastName": "Sample",
  "person.firstName": "Jordan",
  "person.displayName": "Jordan Sample",
  "person.middleName": "Lee",
  "ordinationType.name": "Pastor",
  "ordinationType.code": "PAS",
  "campus.name": "Main Campus",
  "campus.city": "Springfield",
  "campus.state": "IL",
  "credentialNumber": "ORD-0001",
  "ordination.grantedDate": "2024-01-15",
  "ordination.expirationDate": "2027-01-15",
  "ordination.status": "active",
  "church.name": "Grace Church",
};

const isDateKey = (key: string): boolean =>
  BINDING_CATALOG.find((b) => b.key === key)?.isDate === true;

// Resolve a binding key against a flat data map (e.g. SAMPLE_BINDINGS, or a flattened
// real record). Date keys format via dayjs with the element's dateFormat (default
// "MMM D, YYYY"). Returns "" when missing — the caller applies element.fallback.
export const resolveBinding = (
  key: string,
  data: Record<string, any>,
  dateFormat?: string
): string => {
  const value = data?.[key];
  if (value === undefined || value === null || value === "") return "";
  if (isDateKey(key)) {
    const d = dayjs(value);
    return d.isValid() ? d.format(dateFormat || "MMM D, YYYY") : "";
  }
  return String(value);
};
