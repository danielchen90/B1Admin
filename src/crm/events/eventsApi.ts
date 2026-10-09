import { ApiHelper } from "@churchapps/apphelper";

// The CRM event planner API (/membership/crm/events, Api CrmEventController).

export interface EventTopic { title: string; detail: string }
export interface EventSpeaker { name: string; role: string }
export interface EventQuestion { id: string; label: string; type: "text" | "textarea" | "select" | "yesno"; options: string[]; required: boolean }
export interface EventPage { headline: string; intro: string; highlights: string[]; topics: EventTopic[]; whoShouldCome: string; faq: { q: string; a: string }[]; closing: string }
export interface EventEmail {
  id: string; kind: "confirmation" | "reminder" | "followup" | "invite" | "update"; offsetMinutes: number | null; subject: string; body: string; enabled: boolean;
  sendAt: string | null; sentAt: string | null; sentCount: number; audience: any; sends?: { sent: number; failed: number };
}
export interface CrmEvent {
  id: string; slug: string; kind: string; status: "draft" | "published" | "closed"; title: string; subtitle: string | null; message: string | null;
  topics: EventTopic[] | null; speakers: EventSpeaker[] | null; startsAt: string | null; endsAt: string | null; timezone: string; schedule: string | null;
  location: string | null; joinUrl: string | null; languages: string | null; capacity: number | null; registrationOpen: boolean;
  page: EventPage | null; questions: EventQuestion[] | null; flyerUrl: string | null; imageUrl: string | null; url: string; registrations: number;
  emails?: EventEmail[]; zones?: { registrants: { timezone: string; people: number }[]; crm: { timezone: string; people: number }[] };
}

const API = "MembershipApi";

export const KIND_LABEL: Record<string, string> = { study: "Bible study", conference: "Conference", fasttrack: "Fast track", service: "Service", other: "Event" };

export const eventsApi = {
  list: () => ApiHelper.get("/crm/events", API) as Promise<CrmEvent[]>,
  create: (title: string, kind: string) => ApiHelper.post("/crm/events", { title, kind }, API) as Promise<{ id: string }>,
  get: (id: string) => ApiHelper.get(`/crm/events/${id}`, API) as Promise<CrmEvent>,
  save: (id: string, body: Partial<CrmEvent> & { slug?: string }) => ApiHelper.post(`/crm/events/${id}`, body, API) as Promise<CrmEvent>,
  remove: (id: string) => ApiHelper.delete(`/crm/events/${id}`, API),
  draftPage: (id: string) => ApiHelper.post(`/crm/events/${id}/draft-page`, {}, API) as Promise<{ page: EventPage; questions: EventQuestion[] }>,
  flyer: (id: string, data: string, mediaType: string) => ApiHelper.post(`/crm/events/${id}/flyer`, { data, mediaType }, API) as Promise<CrmEvent>,
  registrations: (id: string) => ApiHelper.get(`/crm/events/${id}/registrations`, API) as Promise<any[]>,
  setRegistration: (id: string, regId: string, status: string) => ApiHelper.post(`/crm/events/${id}/registrations/${regId}`, { status }, API),
  addEmail: (id: string, body: Partial<EventEmail>) => ApiHelper.post(`/crm/events/${id}/emails`, body, API) as Promise<{ id: string }>,
  saveEmail: (id: string, emailId: string, body: Partial<EventEmail>) => ApiHelper.post(`/crm/events/${id}/emails/${emailId}`, body, API),
  removeEmail: (id: string, emailId: string) => ApiHelper.delete(`/crm/events/${id}/emails/${emailId}`, API),
  testEmail: (id: string, emailId: string, timezone: string) => ApiHelper.post(`/crm/events/${id}/emails/${emailId}/test`, { timezone }, API) as Promise<{ ok: boolean; to: string; result: string }>,
  audienceCount: (id: string, audience: any) => ApiHelper.post(`/crm/events/${id}/audience-count`, audience, API) as Promise<{ count: number; sample: string[] }>
};

export const ERROR_TEXT: Record<string, string> = {
  title_required: "Give the event a title.",
  needs_start: "Set the date and time before publishing.",
  ends_before_start: "The end is before the start.",
  bad_timezone: "That time zone is not recognised.",
  bad_file: "Upload a JPG, PNG, WebP or PDF.",
  too_large: "That file is over 15 MB."
};

export const browserZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York"; } catch { return "America/New_York"; } };
