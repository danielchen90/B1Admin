import { ApiHelper } from "@churchapps/apphelper";

// The ministry-wide CRM API (/membership/crm, Api CrmController). Types mirror the server DTOs.

export interface CrmProfile {
  personId?: string;
  country?: string | null;
  countryCode?: string | null;
  region?: string | null;
  city?: string | null;
  timezone?: string | null;
  languages?: string | null;
  ministryRole?: string | null;
  organization?: string | null;
  contactConsent: "yes" | "no" | "unknown";
  consentSource?: string | null;
  consentAt?: string | null;
  summary?: string | null;
  summaryUpdatedAt?: string | null;
  mbidCreatedAt?: string | null;
  mbidRemovedAt?: string | null;
  lastActiveAt?: string | null;
}

export interface CrmFact { id: string; kind: "prayer" | "need" | "interest" | "fact" | "followup"; text: string; status: "open" | "done"; createdAt: string }
export interface CrmNote { id: string; kind: string; body: string | null; addedByName?: string | null; createdAt: string; imageCount?: number }
export interface CrmActivity { id: string; site: string; type: string; title: string; detail?: string | null; url?: string | null; occurredAt: string }
export interface CrmTag { id: string; name: string; people?: number }

export interface CrmPersonView {
  person: { id: string; displayName: string; firstName: string; lastName: string; email?: string; mobilePhone?: string; membershipStatus?: string; campusId?: string; source?: string | null; hasMbid: boolean; dateAdded?: string };
  profile: CrmProfile;
  tags: CrmTag[];
  facts: CrmFact[];
  notes: CrmNote[];
  activities: CrmActivity[];
}

export interface Extraction {
  transcript: string | null;
  noteSummary: string;
  person: {
    firstName: string | null; lastName: string | null; emails: string[]; phones: string[]; countryCode: string | null; city: string | null; region: string | null;
    timezone: string | null; languages: string[]; ministryRole: string | null; organization: string | null; contactConsent: "yes" | "no" | "unknown";
  };
  facts: { kind: CrmFact["kind"]; text: string }[];
  tags: string[];
}

export interface CaptureImage { mediaType: string; data: string; preview: string }

const API = "MembershipApi";

/** ApiHelper throws Error(body); our API answers { error: code }. */
export function crmError(e: any): string {
  const raw = String(e?.message || e || "");
  try { return JSON.parse(raw).error || raw; } catch { return raw; }
}

export const ERROR_TEXT: Record<string, string> = {
  ai_not_configured: "The AI is not set up on the server yet (ANTHROPIC_API_KEY).",
  ai_refused: "The AI declined to read this. Try removing anything unrelated.",
  ai_bad_output: "The AI answer could not be read. Please try again.",
  empty: "Add some text or a screenshot first.",
  org_wide_only: "Only staff who can see every campus can use this.",
  no_identity: "No name, email or phone was found, so a new person cannot be made from this."
};
export const errorText = (e: any) => ERROR_TEXT[crmError(e)] || crmError(e) || "Something went wrong.";

export const crmApi = {
  stats: () => ApiHelper.get("/crm/stats", API),
  people: (q: Record<string, string | number | undefined>) => {
    const qs = Object.entries(q).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
    return ApiHelper.get("/crm/people" + (qs ? "?" + qs : ""), API) as Promise<{ rows: any[]; total: number }>;
  },
  person: (id: string) => ApiHelper.get(`/crm/people/${id}`, API) as Promise<CrmPersonView>,
  saveProfile: (id: string, body: Partial<CrmProfile>) => ApiHelper.post(`/crm/people/${id}/profile`, body, API),
  addNote: (id: string, text: string) => ApiHelper.post(`/crm/people/${id}/notes`, { text }, API),
  deleteNote: (noteId: string) => ApiHelper.delete(`/crm/notes/${noteId}`, API),
  addFact: (id: string, kind: string, text: string) => ApiHelper.post(`/crm/people/${id}/facts`, { kind, text }, API),
  setFact: (factId: string, status: "open" | "done") => ApiHelper.post(`/crm/facts/${factId}`, { status }, API),
  deleteFact: (factId: string) => ApiHelper.delete(`/crm/facts/${factId}`, API),
  tags: () => ApiHelper.get("/crm/tags", API) as Promise<CrmTag[]>,
  tag: (id: string, name: string) => ApiHelper.post(`/crm/people/${id}/tags`, { name }, API) as Promise<CrmTag[]>,
  untag: (id: string, tagId: string) => ApiHelper.delete(`/crm/people/${id}/tags/${tagId}`, API),
  preview: (body: { text?: string; images?: { mediaType: string; data: string }[]; personId?: string | null }) =>
    ApiHelper.post("/crm/capture/preview", body, API) as Promise<{ extraction: Extraction; candidates: any[] }>,
  save: (body: { personId?: string | null; text?: string; extraction: Extraction; imageCount?: number }) =>
    ApiHelper.post("/crm/capture/save", body, API) as Promise<{ personId: string; created: boolean; changes: string[]; facts: number }>,
  summary: (id: string) => ApiHelper.post(`/crm/people/${id}/summary`, {}, API) as Promise<{ summary: string }>,
  ask: (question: string, history: { role: "user" | "assistant"; content: string }[]) =>
    ApiHelper.post("/crm/ask", { question, history }, API) as Promise<{ answer: string; people: { id: string; name: string }[] }>,
  syncRun: (what: "all" | "keycloak" | "activity") => ApiHelper.post(`/crm/sync/run?what=${what}`, {}, API)
};

export const FACT_LABEL: Record<string, string> = { prayer: "Prayer request", need: "Need", interest: "Interest", fact: "Note", followup: "Follow up" };
export const SITE_LABEL: Record<string, string> = { gtc: "Training Center", library: "Faith Library", church: "Global Church", theater: "Bible Theater", askmary: "Ask Mary", event: "Events" };

export const fmtDate = (d?: string | null) => {
  if (!d) return "";
  const date = new Date(d);
  return isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { dateStyle: "medium" } as any);
};

/** Screenshots: read, shrink to at most 1600 px on the long side (JPEG), return base64 for the API. */
export async function readImage(file: File): Promise<CaptureImage | null> {
  if (!file.type.startsWith("image/")) return null;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    return { mediaType: "image/jpeg", data: dataUrl.split(",")[1], preview: dataUrl };
  } finally {
    URL.revokeObjectURL(url);
  }
}
