// Shared type contracts for the enhanced print-station roster (Phase 07.1).
//
// These are PURE types (no React) consumed by the filter panel (Plan 02), the
// grouped roster view (Plan 03), and the orchestrator (Plan 04). The
// RosterFilterSpec below IS the structured `filterJson` shape: it is serialized
// via JSON.stringify into `createBatch.filterJson` for batch provenance (PRT-02)
// and stored verbatim by the unchanged `POST /printBatches` endpoint.
import { type PersonInterface } from "@churchapps/helpers";

export type GroupBy = "none" | "location" | "calling";
export type SortBy = "lastName" | "firstName";
export type SortDir = "asc" | "desc";

// The atomic (person, campus, calling) tuple — one per active credential.
export interface RosterRow {
  person: PersonInterface; // full person for PersonAvatar + name link (from GET /people/ids)
  personId: string;
  displayName: string;
  lastName: string;
  firstName: string;
  campusId: string;
  campusName: string;
  ordinationTypeId: string;
  callingName: string;
  callingSortOrder: number; // from OrdinationTypeInterface.sortOrder (seniority rank)
}

// One subsummary bucket — rows already de-duped per group mode + secondary-sorted.
export interface RosterGroup {
  key: string; // campusId | ordinationTypeId | "all"
  label: string; // campusName | callingName | "All Ministers"
  sortOrder: number; // group ordering (name A–Z for location, sortOrder for calling)
  rows: RosterRow[];
  personIds: string[]; // distinct personIds in this group (per-group select-all + count)
}

// The structured filterJson shape (LOCKED "full filter spec").
export interface RosterFilterSpec {
  campusIds: string[]; // selected campus checkboxes (subset of accessible)
  ordinationTypeIds: string[]; // selected calling checkboxes (empty = all, no filter)
  groupBy: GroupBy;
  sortBy: SortBy;
  sortDir?: SortDir; // default "asc"
}
