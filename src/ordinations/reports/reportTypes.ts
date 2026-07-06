// Shared type contracts for the leadership report (Phase 08). PURE types (no React)
// consumed by the pure helpers (reportHelpers), the CSV mapping (reportCsv), the filter
// panel (ReportFilterPanel), the grouped table (ReportTable) and the page orchestrator.
//
// ReportFilterSpec MUST match Plan 08-01's request-body contract exactly so the on-screen
// grouping and the server PDF grouping consume the same shape (RPT-05 matching). ReportRow
// MUST expose the SHARED GROUPING CONTRACT field names verbatim (personId, campusId,
// ordinationTypeId, status, firstName, lastName, displayName) so reportHelpers' shared block
// stays byte-identical with the server's reportGrouping.ts.
import { type PersonInterface } from "@churchapps/helpers";

export type ReportGroupBy = "none" | "location" | "type" | "status";
export type SortBy = "lastName" | "firstName";
export type SortDir = "asc" | "desc";

// The atomic per-credential row. The first block of fields are the SHARED GROUPING
// CONTRACT fields (verbatim names dedupeKey/compareRows operate on); the rest are display
// extras carried for RPT-04 columns and the "Ordination(s)" aggregation.
export interface ReportRow {
  personId: string;
  campusId: string;
  ordinationTypeId: string;
  status: string;
  firstName: string;
  lastName: string;
  displayName: string;
  // Display extras (not referenced inside the SHARED GROUPING CONTRACT block).
  person: PersonInterface; // full person for PersonAvatar + name link (GET /people/ids)
  campusName: string;
  callingName: string;
  callingSortOrder: number; // OrdinationTypeInterface.sortOrder (seniority rank)
  credentialNumber: string | null;
  grantedDate: string | null;
  expirationDate: string | null;
  ordinationsCell?: string; // computed per leaf group: aggregated callings (none/location) or single (type/status)
}

// One subsummary bucket — supports NESTED groups via `subGroups`. A level-0 group with a
// non-empty `subGroups` renders as a primary header whose children are the nested level-1
// buckets; a leaf group carries `rows` directly (already de-duped + secondary-sorted).
export interface ReportGroup {
  key: string; // campusId | ordinationTypeId | status | "all" (nested keys join with "|")
  label: string;
  sortOrder: number; // group ordering (location A–Z, type by seniority, status by STATUS_ORDER)
  level: number; // 0 = primary, 1 = nested
  rows: ReportRow[]; // populated on leaf groups (empty on a primary that has subGroups)
  personIds: string[]; // distinct personIds under this group (count chip)
  subGroups?: ReportGroup[]; // present on a primary group when groupBy2 !== "none"
}

// The request/grouping spec — byte-identical field shape with Plan 08-01's POST body.
export interface ReportFilterSpec {
  campusIds: string[]; // selected campus checkboxes; [] = no campus narrowing (all)
  ordinationTypeIds: string[]; // [] = all types
  statuses: string[]; // subset of STATUS_ORDER; [] = all
  expiringWithinDays: number | null; // null = no expiration filter
  search: string; // free-text over first/last/credentialNumber; "" = no search
  groupBy1: ReportGroupBy; // primary grouping
  groupBy2: ReportGroupBy; // secondary (nested); "none" = single level
  sortBy: SortBy;
  sortDir: SortDir;
}
