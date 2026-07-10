// The Unlayer merge-tag catalog for the campaign builder (Plan 12-05, BLD-03).
//
// Unlayer stores a merge tag's `value` VERBATIM into the design/exported HTML —
// it does NOT interpret it. The SERVER (12-01 MergeFieldHelper) later resolves
// `{{key|fallback}}` at render time against each frozen recipient's mergeData.
// So the whole client contribution is: give the user a categorized picker that
// writes the correct `{{key|fallback}}` literal WITHOUT them memorizing the
// syntax (BLD-03 "no syntax memorization").
//
// The KEYS below MUST match the server merge keys produced by the audience
// resolve/mergeData enrichment (12-01/12-02): person basics + church/campus +
// the active-ordination credential. `sample` drives the editor's live preview
// only (never sent). We use Unlayer's GROUPED shape: a parent MergeTag carries a
// `name` + a nested `mergeTags` map (no leaf `value`), so the picker renders the
// three categories as collapsible groups (see MergeTag in @unlayer/types).

import type { MergeTags } from "@unlayer/types";

// Person basics — resolved from the recipient person record. `firstName` carries
// a friendly fallback so an unnamed recipient still reads naturally ("Friend").
const PERSON_BASICS: MergeTags = {
  firstName: { name: "First name", value: "{{firstName|Friend}}", sample: "Jane" },
  lastName: { name: "Last name", value: "{{lastName}}", sample: "Doe" },
  displayName: { name: "Display name", value: "{{displayName}}", sample: "Jane Doe" },
  email: { name: "Email", value: "{{email}}", sample: "jane@example.org" },
};

// Church / campus — resolved from the sending campus + church (12-01).
const CHURCH_CAMPUS: MergeTags = {
  churchName: { name: "Church name", value: "{{churchName}}", sample: "Grace Fellowship" },
  campusName: { name: "Campus name", value: "{{campusName}}", sample: "Downtown Campus" },
  campusAddress: { name: "Campus address", value: "{{campusAddress}}", sample: "123 Main St" },
};

// Ordination credential — the recipient's ACTIVE credential, frozen at audience
// resolve time (12-02). Empty strings render when the person has no active
// credential, so these tags safely no-op for non-credentialed recipients.
const ORDINATION: MergeTags = {
  ordinationTitle: { name: "Ordination title", value: "{{ordinationTitle}}", sample: "Pastor" },
  credentialNumber: { name: "Credential number", value: "{{credentialNumber}}", sample: "ORD-00421" },
  ordinationStatus: { name: "Ordination status", value: "{{ordinationStatus}}", sample: "active" },
};

// The full grouped catalog handed to the Unlayer editor via `options.mergeTags`.
// Three parent groups, each with a `name` (the category label) + nested leaves.
export const MERGE_TAGS: MergeTags = {
  person: { name: "Person", mergeTags: PERSON_BASICS },
  church: { name: "Church & campus", mergeTags: CHURCH_CAMPUS },
  ordination: { name: "Ordination", mergeTags: ORDINATION },
};

export default MERGE_TAGS;
