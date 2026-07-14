// Shared descriptor → plain-language helper (Plan 16-03).
//
// Extracted VERBATIM from AudienceTab's `summary` useMemo so there is ONE source
// of truth for turning an AudienceDescriptor into a human-readable line. Both the
// editable Audience tab (draft) AND the Phase-16 LOCKED record view render the
// SAME string from this helper — a sent campaign's audience reads identically to
// how it read as a draft, just frozen.
//
// The lookups are named lists (campuses/groups/auxiliaries) the caller already
// loads via useCampuses/useGroups/useAuxiliaries; when a target isn't found we
// fall back to the raw targetId in parentheses so the summary never breaks.

import { type AudienceDescriptor } from "./emailTypes";

// The audience-type labels (kept in step with AudienceTab's AUDIENCE_TYPES). A
// minimal label map — re-declared here rather than imported so the helper is
// self-contained and AudienceTab can import THIS as the single source of truth.
const TYPE_LABELS: Record<AudienceDescriptor["type"], string> = {
  church: "Whole church",
  campus: "A campus",
  group: "A group",
  auxiliary: "An auxiliary",
  people: "Specific people",
};

// Types that resolve from a targetId (campus/group/auxiliary point at one record).
const TARGETED_TYPES: AudienceDescriptor["type"][] = ["campus", "group", "auxiliary"];

// One record from a named list (only id + name are needed to label the summary).
// `name` is loose (optional) so the hooks' CampusInterface/GroupInterface/
// AuxiliaryInterface rows assign without a cast — a missing name simply yields the
// targetId fallback.
interface NamedRecord {
  id?: string;
  name?: string;
}

export interface AudienceLists {
  campuses: NamedRecord[];
  groups: NamedRecord[];
  auxiliaries: NamedRecord[];
}

// Turn an AudienceDescriptor into a plain-language summary line:
//   people    → "N specific person/people selected"
//   campus    → "Campus: North Campus"  (falls back to "Campus (targetId)")
//   group     → "Group: …"              (falls back to "Group (targetId)")
//   auxiliary → "Auxiliary: …"          (falls back to "Auxiliary (targetId)")
//   filtered  → "{typeLabel} — filtered"
//   otherwise → the plain type label ("Whole church")
export function describeAudience(descriptor: AudienceDescriptor, lists: AudienceLists): string {
  if (descriptor.type === "people") {
    const n = descriptor.personIds?.length ?? 0;
    return `${n} specific ${n === 1 ? "person" : "people"} selected`;
  }
  const typeLabel = TYPE_LABELS[descriptor.type] ?? descriptor.type;
  if (TARGETED_TYPES.includes(descriptor.type) && descriptor.targetId) {
    // Name the target from the loaded lists so the summary reads human-readably.
    if (descriptor.type === "campus") {
      const name = lists.campuses.find((c) => c.id === descriptor.targetId)?.name;
      return name ? `Campus: ${name}` : `Campus (${descriptor.targetId})`;
    }
    if (descriptor.type === "group") {
      const name = lists.groups.find((g) => g.id === descriptor.targetId)?.name;
      return name ? `Group: ${name}` : `Group (${descriptor.targetId})`;
    }
    const auxName = lists.auxiliaries.find((a) => a.id === descriptor.targetId)?.name;
    return auxName ? `Auxiliary: ${auxName}` : `Auxiliary (${descriptor.targetId})`;
  }
  if (descriptor.filterJson) return `${typeLabel} — filtered`;
  return typeLabel;
}

export default describeAudience;
