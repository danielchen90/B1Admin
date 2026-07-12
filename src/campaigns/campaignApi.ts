// Shared typed client for the campaign endpoints (Plan 12-04).
//
// A thin wrapper over ApiHelper against the "MessagingApi" app. CRITICAL path
// note: MessagingApi's base URL already ends in "/messaging"
// (CommonEnvironmentHelper.MessagingApi = base + "/messaging"), so we issue BARE
// "/campaigns/*" paths — a "/messaging" prefix here would double to a 404 (see
// EmailSettingsForm.tsx + the STATE.md doubled-prefix lesson). The app-name key
// is "MessagingApi", NOT "messaging".
//
// ApiHelper THROWS on any non-2xx (the thrown Error's message is the raw
// { error, code } body); callers use apiError.ts to parse it. This module does
// NOT swallow those — it lets them propagate so pages can react to the machine
// code. Nothing here hardcodes an absolute host; the app registration resolves it.

import { ApiHelper } from "@churchapps/apphelper";
import {
  type AudienceDescriptor,
  type AudiencePreviewResult,
  type CampaignInterface,
  type CampaignStats,
  type PreviewResult,
  type RecipientRow,
  type TemplateInterface,
} from "./emailTypes";

const APP = "MessagingApi";

// ---- Campaigns ------------------------------------------------------------

// GET /campaigns — all campaigns (draft + sent) visible to the caller's scope.
export function listCampaigns(): Promise<CampaignInterface[]> {
  return ApiHelper.get("/campaigns", APP);
}

// GET /campaigns/:id — one campaign incl. blockJson for the editor.
export function getCampaign(id: string): Promise<CampaignInterface> {
  return ApiHelper.get(`/campaigns/${id}`, APP);
}

// POST /campaigns — create a new draft. Returns the created campaign (with id/version).
export function createDraft(body: Partial<CampaignInterface>): Promise<CampaignInterface> {
  return ApiHelper.post("/campaigns", body, APP);
}

// POST /campaigns/:id — update a draft. `body.expectedVersion` drives the OCC
// guard server-side (a stale version → 409 conflict).
export function updateDraft(
  id: string,
  body: Partial<CampaignInterface> & { expectedVersion?: number }
): Promise<CampaignInterface> {
  return ApiHelper.post(`/campaigns/${id}`, body, APP);
}

// POST /campaigns/:id/preview — render the campaign for one frozen recipient.
export function previewCampaign(id: string, recipientIndex: number): Promise<PreviewResult> {
  return ApiHelper.post(`/campaigns/${id}/preview`, { recipientIndex }, APP);
}

// POST /campaigns/:id/audience/preview — resolve the audience descriptor LIVE
// (pre-freeze) and return the deliverable / skipped / suppressed counts. Drives
// the same RecipientResolver freeze uses (CampaignAudienceController), so the
// count shown on the Audience tab can never drift from the eventual send. The
// descriptor is POSTed as the body (the endpoint reads req.body directly), not
// the campaign's stored copy — so an unsaved edit previews immediately.
export function previewAudience(
  id: string,
  descriptor: AudienceDescriptor
): Promise<AudiencePreviewResult> {
  return ApiHelper.post(`/campaigns/${id}/audience/preview`, descriptor, APP);
}

// POST /campaigns/:id/audience/freeze — freeze the resolved audience into
// immutable campaignRecipients rows and flip the campaign draft→scheduled (setting
// recipientCount). CRITICAL: the freeze endpoint reads req.body.descriptor +
// req.body.expectedVersion (NOT the bare descriptor previewAudience posts), so we
// wrap them: { descriptor, expectedVersion }. `expectedVersion` drives the OCC
// guard (a stale version → 409 conflict / not_draft). BARE MessagingApi path.
export function freezeAudience(
  id: string,
  descriptor: AudienceDescriptor,
  expectedVersion?: number
): Promise<{ frozen: number; skippedNoEmail: number; suppressed: number }> {
  return ApiHelper.post(`/campaigns/${id}/audience/freeze`, { descriptor, expectedVersion }, APP);
}

// POST /campaigns/:id/test-send — deliver a single test to `to`, rendered as the
// recipient at `recipientIndex` so merge fields resolve realistically. The 12-03
// backend returns { sent, to, renderedFromRecipient } and writes ZERO recipient
// rows / counters (stats-safe). It gates on VerifiedDomainGate first — an
// unverified sending domain / missing settings throws a 422 the caller parses
// (DOMAIN_UNVERIFIED / NO_EMAIL_SETTINGS) via apiError.
export function testSendCampaign(
  id: string,
  args: { to: string; recipientIndex: number }
): Promise<{ sent: true; to: string; renderedFromRecipient?: string }> {
  return ApiHelper.post(`/campaigns/${id}/test-send`, args, APP);
}

// POST /campaigns/:id/upload-image — upload an editor image, returns its hosted
// URL. The 12-03 endpoint mirrors content/FileController.saveFile: a JSON body
// carrying the file name + base64 payload (NOT multipart FormData), matching the
// existing B1Admin base64-upload convention (see site/AppearanceEdit.tsx). We read
// the File as a base64 string here so callers (the Unlayer image callback in
// 12-05) can hand us the raw File.
export async function uploadCampaignImage(id: string, file: File): Promise<{ url: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  // Strip the "data:<mime>;base64," prefix — the server wants the bare base64.
  const base64 = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
  const body = { fileName: file.name, fileType: file.type, base64 };
  return ApiHelper.post(`/campaigns/${id}/upload-image`, body, APP);
}

// ---- Tracking / reporting (Plan 13-04) -----------------------------------

// GET /campaigns/:id/stats — headline engagement counts + ranked per-link click
// table (13-03 compute-on-read endpoint). Gated on Campaigns/View, church-scoped.
// BARE path (MessagingApi base already ends in /messaging — a /messaging prefix
// double-404s). Counts are recomputed from stamps each call (redelivery-safe).
export function getCampaignStats(id: string): Promise<CampaignStats> {
  return ApiHelper.get(`/campaigns/${id}/stats`, APP);
}

// GET /campaigns/:id/recipients?status= — per-recipient drill-down rows for the
// clicked stat card (13-03). `status` pre-filters to a literal status (sent /
// delivered / bounced / complained) or an engagement pseudo-status
// (opened / clicked / unsubscribed); omitted → all recipients. BARE MessagingApi
// path (see getCampaignStats). The status is URL-encoded to be safe.
export async function getCampaignRecipients(id: string, status?: string): Promise<RecipientRow[]> {
  // The endpoint wraps the rows as { recipients: [...] } (unlike /stats which is a
  // bare object) — unwrap so callers get the plain RecipientRow[] the type promises.
  const res = await ApiHelper.get(
    `/campaigns/${id}/recipients${status ? `?status=${encodeURIComponent(status)}` : ""}`,
    APP
  );
  return (res?.recipients ?? res ?? []) as RecipientRow[];
}

// ---- Reusable templates (BLD-02) -----------------------------------------

// POST /campaigns/templates — save a builder design as a reusable template
// (12-03 Task 4). Returns the saved template's id/name.
export function saveAsTemplate(body: {
  name: string;
  subject?: string;
  category?: string;
  blockJson: string;
  renderedHtml?: string;
}): Promise<{ id: string; name: string }> {
  return ApiHelper.post("/campaigns/templates", body, APP);
}

// GET /campaigns/templates — saved builder designs + legacy HTML-only templates.
// The list OMITS blockJson (heavy); each row carries `hasBlockJson`.
export function listTemplates(): Promise<TemplateInterface[]> {
  return ApiHelper.get("/campaigns/templates", APP);
}

// GET /campaigns/templates/:id — one template incl. blockJson for editor.loadDesign.
export function getTemplate(id: string): Promise<TemplateInterface> {
  return ApiHelper.get(`/campaigns/templates/${id}`, APP);
}
