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
  // Frozen audience size — set at freeze, carried on the list DTO (16-01 server
  // projection). Drives the list "Audience" column; absent on unfrozen drafts.
  recipientCount?: number;
  // ISO UTC instant a scheduled campaign will fire at (set by POST /:id/schedule,
  // surfaced on the list payload). Optional — drafts / send-immediately rows have none.
  scheduledAt?: string;
  // ── Phase 16: history-record fields the list (16-02) + detail (16-03) consume ──
  // "Who it was sent as" — the church's configured from-name (server sets the same
  // value on every list row this phase; a per-creator facet may come later).
  sender?: string;
  // ISO UTC instant the campaign flipped to `sent`. Distinct from createdAt (draft
  // time) and scheduledAt (fire time). ABSENT for draft/scheduled/failed/canceled.
  sentAt?: string;
  // Per-row engagement counts. Present ONLY for sent/sending rows; the server OMITS
  // them (leaves undefined — NOT 0) for draft/scheduled/failed/canceled rows so the
  // UI renders BLANK not 0% (mirrors the Task-2 server contract / Pitfall 4). Always
  // guard `opened !== undefined` before rendering a rate.
  opened?: number;
  clicked?: number;
  delivered?: number;
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

// The controlled filter state for the campaign LIST page. Multi-select facets are
// OR-within (any of the picked values matches) and AND-across (a row must satisfy
// every non-empty facet) — the ordination-report filter behavior. An empty array =
// that facet is off; absent dateFrom/dateTo = no date bound.
export interface CampaignListFilter {
  search?: string;
  statuses: string[];
  campusIds: string[];
  // Phase 16 — Sender facet: match rows whose `sender` is any of these (empty = no
  // sender filter).
  senders: string[];
  // Phase 16 — Date-range facet (ISO date bounds, inclusive). Absent = no bound on
  // that side.
  dateFrom?: string;
  dateTo?: string;
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
// One resolved deliverable recipient, surfaced so the Audience tab can show the
// exact list of people a campaign will reach (any audience type).
export interface AudienceRecipient {
  personId: string;
  name: string;
  email: string;
  campusName: string;
}

export interface AudiencePreviewResult {
  deliverableCount: number;
  skippedNoEmailCount: number;
  suppressedCount: number;
  // The full deliverable roster (name + email + campus). Optional for back-compat
  // with an older Api that returned counts only.
  recipients?: AudienceRecipient[];
}

// ---- Tracking / reporting (Plan 13-04) -----------------------------------

// Headline engagement counts for a campaign + a ranked per-link click table
// (GET /campaigns/:id/stats — the 13-03 compute-on-read endpoint). Every count
// is recomputed from the per-recipient stamps + idempotent campaignEvents on
// each call, so a redelivered SNS event can never move a number. `total` is the
// frozen recipient count; `sent` is how many were dispatched. `unsubscribed` is
// 0 this phase (no unsubscribe ingestion yet) — the UI renders it gracefully.
export interface CampaignStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
  total: number;
  // Ranked (desc by count) per-link click table for the Stats tab.
  linkClicks: { link: string; count: number }[];
}

// One recipient row for the drill-down list (GET /campaigns/:id/recipients).
// `personId` is the deep-link key: when present the name links to the B1Admin
// person record (/people/:personId in a new tab); when absent (an ad-hoc
// address) the name renders as plain text. The three stamps drive the
// Opened/Clicked columns; `lastActivity` is the most-recent engagement time.
export interface RecipientRow {
  id: string;
  personId?: string;
  name: string;
  email: string;
  status: string;
  openedAt?: string;
  clickedAt?: string;
  bouncedAt?: string;
  lastActivity?: string;
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
