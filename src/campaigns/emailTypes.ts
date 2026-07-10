// Client-side campaign interfaces for the B1Admin Email area (Plan 12-04).
//
// These mirror the 12-03 MessagingApi shapes but stay deliberately loose (most
// fields optional) so a draft can be built incrementally in the editor before
// every field exists. The canonical source-of-truth for the schema lives in the
// Api fork (emailCampaigns / emailTemplates); this is the wire mirror the UI
// serializes to/from.

// The LOCKED campaign status set (Phase 11 decision — no new columns / statuses).
export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "failed" | "canceled";

// A single email campaign — the draft the editor edits and the sent record the
// list shows. `blockJson` is the Unlayer design (source-of-truth for re-editing);
// `renderedHtml` is the compiled HTML captured at freeze/send.
export interface CampaignInterface {
  id?: string;
  name: string;
  subject?: string;
  preheader?: string;
  status: CampaignStatus;
  campusId?: string;
  createdBy?: string;
  createdAt?: string;
  blockJson?: string;
  renderedHtml?: string;
  audienceFilterJson?: string;
  templateId?: string;
  version?: number;
  sentCount?: number;
  failedCount?: number;
}

// Client mirror of the audience descriptor (closed union — 12-02). The "people"
// carrier ships an explicit personIds list; every other type resolves server-side
// from targetId + filterJson under the caller's re-derived campus scope.
export interface AudienceDescriptor {
  type: "church" | "campus" | "group" | "auxiliary" | "people";
  targetId?: string;
  filterJson?: string;
  personIds?: string[];
}

// The controlled filter state for the campaign LIST page. `statuses` / `campusIds`
// are multi-select intersections; empty arrays mean "no status/campus filter".
export interface CampaignListFilter {
  search?: string;
  statuses: string[];
  campusIds: string[];
}

// One preview render for a specific frozen recipient (test-send / preview flow).
export interface PreviewResult {
  html: string;
  subject: string;
  recipientEmail: string;
  recipientIndex: number;
  totalRecipients: number;
}

// The resolved audience-size preview (CampaignAudienceController /audience/preview,
// 12-03 seam). `deliverableCount` is who actually gets the email; `skipped` are
// people with no/invalid email; `suppressed` are on the unsubscribe/suppression
// list. The three are computed by the SAME resolver freeze uses, so a preview can
// never drift from the eventual frozen list.
export interface AudiencePreviewResult {
  deliverableCount: number;
  skippedNoEmailCount: number;
  suppressedCount: number;
}

// A reusable email template (BLD-02). `blockJson` is present ONLY on get-template
// (list omits the heavy payload); legacy HTML-only templates have it NULL, so the
// editor must guard on `hasBlockJson` before calling `editor.loadDesign`.
export interface TemplateInterface {
  id?: string;
  name: string;
  subject?: string;
  category?: string;
  blockJson?: string | null;
  hasBlockJson?: boolean;
  dateModified?: string;
}
