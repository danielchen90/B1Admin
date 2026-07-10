// "Email these people" list-page entry point (Plan 12-08, BLD-03 + SND-03).
//
// The first-class, expected workflow (12-CONTEXT locks this as a primary way to
// start a campaign, not an afterthought): a people-list surface hands us EITHER
//   (a) an explicit checkbox SELECTION → an explicit-people descriptor
//       { type: "people", personIds } (the 12-02 carry type), or
//   (b) the surface's current FILTER → a filter descriptor
//       { type, targetId?, filterJson? } that re-resolves at freeze (Phase 10),
// and we create a draft campaign carrying that audience, then navigate the user
// into the editor pre-seeded on the Audience tab.
//
// This mirrors LeadershipReportPage.handlePrintLicenses → createBatch →
// navigate("/ordinations/print-station/:batchId): resolve the current
// selection/filter → create a downstream record with it → navigate to the
// page that consumes it.
//
// SCOPE INVARIANT: the "people" carry is a CANDIDATE set only. The server
// (PersonRepo.loadForAudience / applyCampusScope, 12-02) still intersects it
// with the caller's re-derived campus scope at resolve time, so this NEVER
// bypasses campus isolation — an out-of-scope id is structurally dropped.

import { type NavigateFunction } from "react-router-dom";
import { type AudienceDescriptor } from "./emailTypes";
import { createDraft } from "./campaignApi";
import { apiErrorMessage } from "./apiError";

// The two carry shapes the list pages hand us. Exactly one of `personIds` /
// filter-fields drives the descriptor; a `campusId` sets the draft's "Sending
// as" scope and an optional `name` seeds the draft title.
export interface EmailThesePeopleArgs {
  // Explicit checkbox selection → { type: "people", personIds } (12-02).
  personIds?: string[];
  // Filter launch → re-resolving descriptor. Ignored when personIds is present.
  type?: "church" | "campus" | "group" | "auxiliary";
  targetId?: string;
  filterJson?: string;
  // "Sending as" campus scope for the new draft (single-campus context only).
  campusId?: string;
  // Default campaign name (falls back to "New Email").
  name?: string;
}

// Build the AudienceDescriptor from whichever carry the caller supplied. An
// explicit personIds selection wins over any filter fields (a page that has
// both a filter AND a selection is expressing the selection).
function buildDescriptor(args: EmailThesePeopleArgs): AudienceDescriptor {
  const ids = (args.personIds ?? []).filter(Boolean);
  if (ids.length > 0) {
    // Explicit-people carry (12-02) — still campus-scoped server-side at resolve.
    return { type: "people", personIds: ids };
  }
  // Filter launch — re-resolves at freeze (Phase 10). Default to "campus" when
  // a campusId is the only scope the caller has (a coarse, fully-editable start).
  const type = args.type ?? (args.campusId ? "campus" : "church");
  const descriptor: AudienceDescriptor = { type };
  if (args.targetId) descriptor.targetId = args.targetId;
  else if (type === "campus" && args.campusId) descriptor.targetId = args.campusId;
  if (args.filterJson) descriptor.filterJson = args.filterJson;
  return descriptor;
}

// Create a draft carrying the built audience descriptor and navigate into the
// editor pre-seeded on the Audience tab. Returns the new campaign id.
//
// Throws (with a parsed, human-readable message) on a create failure so the
// caller can surface it in its own snackbar/toast — this helper does NOT
// navigate on failure.
export async function emailThesePeople(
  args: EmailThesePeopleArgs,
  navigate: NavigateFunction
): Promise<string> {
  const descriptor = buildDescriptor(args);
  try {
    const created = await createDraft({
      name: args.name ?? "New Email",
      status: "draft",
      campusId: args.campusId,
      audienceFilterJson: JSON.stringify(descriptor)
    });
    const id = created.id ?? "";
    // Router state seeds the editor onto the Audience tab (12-05/12-07 may read
    // it; if not read the tab is still one click away — never a hard dependency).
    navigate("/email/" + id, { state: { tab: "audience" } });
    return id;
  } catch (err) {
    // Re-throw a clean, parsed message (P11 apiError seam) for the caller's UI.
    throw new Error(apiErrorMessage(err, "Failed to start a campaign for these people."));
  }
}
