// Saved-audience API client + wire<->UI mapper + staleness helper (Plan 18-02).
//
// The shared frontend foundation the Save modal + Load picker (Plan 03) and the
// Manage page (Plan 04) all compose over. Three concerns live here so those plans
// stay pure composition:
//
//   1. API functions over MessagingApi's /audiences CRUD (Plan 01 endpoints).
//   2. The wire<->UI descriptor mapper (the "single most important integration
//      detail" per 18-RESEARCH Pitfall 1): the server row is FLAT with an
//      `audienceType` column and NO personIds, while the UI descriptor uses
//      `type` and a closed union. toDescriptor/toSaved bridge the two directions.
//   3. isTargetStale — describeAudience returns NO stale flag (RESEARCH Mismatch
//      1); the caller must compute whether a targeted descriptor still resolves
//      against the same campuses/groups/auxiliaries lists the tab already loads.
//
// PATH NOTE (mirrors campaignApi.ts): MessagingApi's base URL already ends in
// "/messaging", so we issue BARE "/audiences" paths — a "/messaging" prefix here
// would double to a 404. The app-name key is "MessagingApi", NOT "messaging".
//
// UPDATE-VIA-POST: @churchapps/apphelper's ApiHelper has get/post/patch/delete
// but NO put(). updateSavedAudience therefore POSTs to /audiences/:id (the
// POST /:id endpoint from Plan 01), matching campaignApi.ts's updateDraft pattern.

import { ApiHelper } from "@churchapps/apphelper";
import { type AudienceDescriptor } from "./emailTypes";

const APP = "MessagingApi";

// Wire row — mirrors the server `SavedAudience` model: FLAT, `audienceType`
// (NOT `type`), and NO personIds column (people-type audiences are not saveable).
export interface SavedAudienceRow {
  id?: string;
  churchId?: string;
  label?: string;
  audienceType?: string;
  targetId?: string;
  filterJson?: string;
  createdAt?: string;
  createdBy?: string;
  removed?: boolean;
}

// ---- API functions --------------------------------------------------------

// GET /audiences — every saved audience visible to the caller's church scope.
export function listSavedAudiences(): Promise<SavedAudienceRow[]> {
  return ApiHelper.get("/audiences", APP);
}

// POST /audiences — persist a new saved audience. Returns the created row (with id).
export function saveSavedAudience(body: SavedAudienceRow): Promise<SavedAudienceRow> {
  return ApiHelper.post("/audiences", body, APP);
}

// POST /audiences/:id — update an existing saved audience (ApiHelper has NO put;
// the Plan 01 endpoint accepts POST /:id for the update).
export function updateSavedAudience(id: string, body: SavedAudienceRow): Promise<SavedAudienceRow> {
  return ApiHelper.post(`/audiences/${id}`, body, APP);
}

// DELETE /audiences/:id — soft-delete a saved audience.
export function deleteSavedAudience(id: string): Promise<void> {
  return ApiHelper.delete(`/audiences/${id}`, APP);
}

// ---- Wire<->UI descriptor mapper (RESEARCH Pitfall 1) ---------------------

// Wire row -> UI descriptor. Maps the FLAT `audienceType` column onto the UI
// `type` union (defaulting to "church" when absent) and carries targetId +
// filterJson through. personIds is intentionally absent — saved audiences never
// carry an explicit-people carrier (no column for it), so a loaded descriptor is
// always a filter/scope descriptor.
export const toDescriptor = (a: SavedAudienceRow): AudienceDescriptor => ({
  type: (a.audienceType ?? "church") as AudienceDescriptor["type"],
  targetId: a.targetId,
  filterJson: a.filterJson,
});

// UI descriptor + label -> wire row. Maps `type` onto `audienceType` and DROPS
// personIds (people-type audiences aren't saveable — there's no personIds column).
export const toSaved = (label: string, d: AudienceDescriptor): SavedAudienceRow => ({
  label,
  audienceType: d.type,
  targetId: d.targetId,
  filterJson: d.filterJson,
});

// ---- Staleness helper (RESEARCH Mismatch 1) -------------------------------

// The descriptor types that point at one record (a targetId that can go stale).
const TARGETED = ["campus", "group", "auxiliary"] as const;

// Compute whether a descriptor's target is stale (deleted / no longer present) by
// checking the same {campuses, groups, auxiliaries} lists the Audience tab already
// loads. Only targeted types with a targetId can be stale; church/people/filtered
// descriptors never are. describeAudience keeps its own "(targetId)" fallback for
// the summary string — the warning BADGE is driven by THIS boolean (Open Q4).
export function isTargetStale(
  d: { type?: string; targetId?: string },
  lists: { campuses?: { id?: string }[]; groups?: { id?: string }[]; auxiliaries?: { id?: string }[] }
): boolean {
  if (!d.type || !d.targetId || !TARGETED.includes(d.type as (typeof TARGETED)[number])) return false;
  const pool =
    d.type === "campus" ? lists.campuses : d.type === "group" ? lists.groups : lists.auxiliaries;
  return !(pool ?? []).some((r) => r.id === d.targetId);
}
