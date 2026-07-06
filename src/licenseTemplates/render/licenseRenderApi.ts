import { ApiHelper } from "@churchapps/apphelper";
import { type Calibration } from "./calibrationStorage";

// Client for the 06-04 license-card render/confirm/testCard API.
//
// WHY hand-rolled fetch (Pitfall — Don't Hand-Roll... except here): ApiHelper parses
// EVERY response body as JSON and exposes NO blob / postFile method, but /render and
// /testCard STREAM raw application/pdf bytes. So those two go through fetch() using
// ApiHelper.getConfig("MembershipApi") for the base URL + JWT, and read the exact bytes
// via res.blob() → an object URL the dialog iframes as the proof. /confirm returns JSON,
// so it routes through ApiHelper.post normally.
//
// PATH: MembershipApi's base already ends in /membership, so every sub-path here is the
// BARE "/licenseCards/..." — prefixing "/membership" would double to a 404 (this
// project's recurring doubled-prefix lesson, proven in Phase 3 and carried through 05-*).

const membershipConfig = (): { url: string; jwt: string } => {
  const cfg = ApiHelper.getConfig("MembershipApi");
  const url = (cfg?.url || "").replace(/\/+$/, "");
  return { url, jwt: cfg?.jwt || "" };
};

// Turn a non-2xx PDF-endpoint response into a throwable Error whose message is the
// server's JSON error envelope when present (so parseApiError can classify it), else a
// synthesized envelope for the empty-body 401/404 the controller returns, else a
// status-coded fallback. Callers surface e.message / the parsed code inline.
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
    else body = "Render failed (HTTP " + res.status + ")";
  }
  throw new Error(body);
};

export interface RenderResult {
  blob: Blob;
  url: string; // object URL — the caller MUST URL.revokeObjectURL(url) when done
  renderId: string; // X-Render-Id — the archived-blob handle /confirm audits against
  templateVersion: number; // X-Template-Version — captured into the audit row
  campusId: string; // X-Campus-Id — the credential's campus (scope echo)
}

// Render ONE CR80 PDF for a campus-authorized credential. Returns the exact archived
// bytes as a Blob + object URL (the proof the dialog shows AND later downloads/prints —
// never re-rendered) plus the renderId/templateVersion /confirm needs, read from headers.
export const renderCard = async (params: {
  personOrdinationId: string;
  templateId: string;
  calibration: Calibration;
}): Promise<RenderResult> => {
  const cfg = membershipConfig();
  const res = await fetch(cfg.url + "/licenseCards/render", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + cfg.jwt },
    body: JSON.stringify(params)
  });
  if (!res.ok) return throwForResponse(res);
  const renderId = res.headers.get("X-Render-Id") || "";
  const templateVersion = Number(res.headers.get("X-Template-Version") || "1");
  const campusId = res.headers.get("X-Campus-Id") || "";
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  return { blob, url, renderId, templateVersion, campusId };
};

export interface TestCardResult {
  blob: Blob;
  url: string; // object URL — caller MUST revoke when done
}

// Render the per-workstation calibration alignment card (PRT-05). No archival / no audit
// server-side — it is a printer-calibration aid. Consumed by 06-06.
export const renderTestCard = async (calibration: Calibration): Promise<TestCardResult> => {
  const cfg = membershipConfig();
  const res = await fetch(cfg.url + "/licenseCards/testCard", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + cfg.jwt },
    body: JSON.stringify({ calibration })
  });
  if (!res.ok) return throwForResponse(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  return { blob, url };
};

// Write the PRT-03 print-audit row against the ALREADY-archived blob (renderId). Returns
// JSON, so ApiHelper.post is fine. Audit fires on CONFIRM only — never on preview.
export const confirmCard = (params: {
  renderId: string;
  personOrdinationId: string;
  templateId: string;
  templateVersion: number;
}): Promise<any> => ApiHelper.post("/licenseCards/confirm", params, "MembershipApi");
