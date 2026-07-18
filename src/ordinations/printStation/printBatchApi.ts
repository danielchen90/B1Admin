import { ApiHelper } from "@churchapps/apphelper";

// Client for the 07-04 PrintBatchController (batch render/poll/list/pdf/markPrinted/
// regenerate) + the 07-03 per-card lifecycle endpoints (void/reprint/markPrinted).
//
// WHY hand-rolled fetch for the PDF paths: ApiHelper parses EVERY response body as JSON
// and exposes NO blob method, but /printBatches/:id/pdf and /licenseCards/:id/reprint
// STREAM raw application/pdf bytes. Those go through fetch() using
// ApiHelper.getConfig("MembershipApi") for the base URL + JWT, reading the exact bytes via
// res.blob() → an object URL the print-station UI (07-06) iframes / feeds to pdfjs. Every
// JSON endpoint (create/poll/list-cards/recent/markPrinted/regenerate/void/markPrinted)
// routes through ApiHelper normally.
//
// PATH: MembershipApi's base already ends in /membership, so every sub-path here is the
// BARE "/printBatches/..." / "/licenseCards/..." — prefixing "/membership" would double to
// a 404 (this project's recurring doubled-prefix lesson, proven across Phase 3 and 05-*/06-*).

const membershipConfig = (): { url: string; jwt: string } => {
  const cfg = ApiHelper.getConfig("MembershipApi");
  const url = (cfg?.url || "").replace(/\/+$/, "");
  return { url, jwt: cfg?.jwt || "" };
};

// Turn a non-2xx PDF-endpoint response into a throwable Error whose message is the
// server's JSON error envelope when present (so parseApiError can classify e.g. a 422
// { error: "reason_required" }), else a synthesized envelope for the empty-body 401/404
// the controller returns, else a status-coded fallback. Callers surface e.message inline.
const throwForResponse = async (res: Response): Promise<never> => {
  let body = "";
  try {
    body = (await res.text()) || "";
  } catch {
    /* body unreadable — fall through to a synthesized message */
  }
  if (!body) {
    if (res.status === 401) body = JSON.stringify({ error: "unauthorized" });
    else if (res.status === 404) body = JSON.stringify({ error: "not_found" });
    else if (res.status === 409) body = JSON.stringify({ error: "not_ready" });
    else body = "Request failed (HTTP " + res.status + ")";
  }
  throw new Error(body);
};

// The print-batch row, aligned with the 07-01 PrintBatch model. status walks
// building → rendering → ready | failed; renderedCount/cardCount drive the poll progress
// bar; pdfRef is the archived assembled-PDF FileStorage key; skippedJson lists people that
// could not be rendered (no active credential / no template / no cropped photo / etc.).
export interface PrintBatch {
  id: string;
  status: "building" | "rendering" | "ready" | "failed" | string;
  cardCount: number;
  renderedCount: number;
  skippedJson?: string;
  pdfRef?: string;
  name?: string;
  createdAt?: string;
}

// One enriched per-card row from GET /printBatches/:id/cards — the per-card status list
// AND the SOLE source of the cardId that 07-06's per-card reprint/void act on. Shape
// mirrors the 07-04 /:id/cards enrichment.
export interface BatchCard {
  cardId: string;
  personId: string;
  personName: string;
  credentialType?: string;
  credentialNumber?: string;
  campusId?: string;
  campusName?: string;
  status: string;
  printedAt?: string;
  voidReason?: string;
}

// A person that could not be turned into a card, surfaced up front so the operator knows
// who was left out (e.g. "no active credential", "outside your campus scope").
export interface SkippedPerson {
  personId: string;
  reason: string;
}

export interface CreateBatchResult {
  batchId: string;
  cardCount: number;
  skipped: SkippedPerson[];
}

// A downloaded PDF as raw bytes + an object URL. Callers MUST URL.revokeObjectURL(url)
// when done (07-06 revokes on re-download / unmount).
export interface PdfResult {
  blob: Blob;
  url: string;
}

// --- Batch surface (07-04 PrintBatchController) -----------------------------------------

// Create a batch from the RESOLVED personIds (NOT the raw filter — filterJson is stored
// only for provenance). Returns the batchId to navigate to, the card count, and the
// skipped list. JSON response, so ApiHelper.post is fine.
export const createBatch = (params: {
  personIds: string[];
  filterJson?: string;
  name?: string;
  // OPTIONAL template override: force every card in the batch onto this one template
  // (e.g. a certificate). Absent => the server auto-picks a template per ordination type.
  templateId?: string;
  // OPTIONAL credential-type restriction: print ONLY these ordination types (mirrors the
  // Callings filter). Absent/empty => one card per active credential (all types).
  ordinationTypeIds?: string[];
}): Promise<CreateBatchResult> => ApiHelper.post("/printBatches", params, "MembershipApi");

// Light DB-backed poll target (07-06 polls this via React Query refetchInterval until
// status is ready | failed). Returns the batch row only.
export const getBatch = (batchId: string): Promise<PrintBatch> => ApiHelper.get("/printBatches/" + batchId, "MembershipApi");

// The per-card status list — AND the cardId source the per-card reprint/void depend on.
export const listBatchCards = (batchId: string): Promise<BatchCard[]> => ApiHelper.get("/printBatches/" + batchId + "/cards", "MembershipApi");

// Recent batches for the kiosk recent-picker (newest-first, server-ordered).
export const listRecentBatches = (): Promise<PrintBatch[]> => ApiHelper.get("/printBatches", "MembershipApi");

// Download the assembled multi-card PDF as raw bytes + object URL. Raw fetch because
// ApiHelper has no blob method; BARE path. 07-06 iframes this AND feeds the blob to pdfjs
// for the thumbnails grid.
export const downloadBatchPdf = async (batchId: string): Promise<PdfResult> => {
  const cfg = membershipConfig();
  const res = await fetch(cfg.url + "/printBatches/" + batchId + "/pdf", { headers: { Authorization: "Bearer " + cfg.jwt } });
  if (!res.ok) return throwForResponse(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  return { blob, url };
};

// ONE bulk call marking every non-void card in the batch printed — the download-confirm
// "Did they print OK?" path (NOT a per-card loop over ~150 cards). JSON response.
export const markBatchPrinted = (batchId: string): Promise<{ printed: number }> => ApiHelper.post("/printBatches/" + batchId + "/markPrinted", {}, "MembershipApi");

// Rebuild the assembled PDF from the STORED per-card snapshots (byte-identical historical
// reproduction at the frozen template versions). JSON response.
export const regenerateBatch = (batchId: string): Promise<{ batchId: string }> => ApiHelper.post("/printBatches/" + batchId + "/regenerate", {}, "MembershipApi");

// --- Per-card lifecycle (07-03 LicenseCardController) -----------------------------------
// Single-card corrections only — the batch flow uses markBatchPrinted, not these loops.

// Void a single card with a required reason (server 422 { error: "reason_required" } on
// empty). NEVER touches the underlying credential (card status is independent). JSON.
export const voidCard = (cardId: string, reason: string): Promise<any> => ApiHelper.post("/licenseCards/" + cardId + "/void", { reason }, "MembershipApi");

// Single-card correction mark-printed (the batch flow uses markBatchPrinted instead). JSON.
export const markPrinted = (cardId: string): Promise<any> => ApiHelper.post("/licenseCards/" + cardId + "/markPrinted", {}, "MembershipApi");

// Reissue a single card — renders a FRESH single-card PDF from the frozen snapshot and
// streams the printable bytes for the OS-print flow. Raw fetch → Blob; BARE path.
export const reprintCard = async (cardId: string): Promise<PdfResult> => {
  const cfg = membershipConfig();
  const res = await fetch(cfg.url + "/licenseCards/" + cardId + "/reprint", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + cfg.jwt },
    body: JSON.stringify({})
  });
  if (!res.ok) return throwForResponse(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  return { blob, url };
};
