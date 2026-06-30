import { UserHelper, Permissions } from "@churchapps/apphelper";

// Shared ordination primitives consumed by every Wave 2/3 surface. One source of
// truth for error classification, write-gating, and the status state machine so
// the 409/422 UX and permission checks cannot diverge across screens.

// Pitfall 1 (make-or-break): ApiHelper DISCARDS the HTTP status code and throws
// `new Error(rawResponseBody)`. The body for our handled errors is JSON like
// {"error":"version_conflict"}; a 401 throws Error("Unauthorized") which is NOT
// JSON. parseApiError extracts the singular `error` code, returning "" for any
// non-JSON message (callers then fall back to e.message for display).
export const parseApiError = (e: any): string => {
  try {
    return JSON.parse(e?.message)?.error ?? "";
  } catch {
    return "";
  }
};

// Pitfall 3: the CLIENT-side org-wide marker KEEPS api:"MembershipApi" because
// UserHelper.checkAccess calls ApiHelper.getConfig(api) first, but uses a BARE
// contentType (no api prefix) to match the unprefixed church-JWT permission keys.
// There is no Permissions.membershipApi.campus.admin, so it is defined here.
export const CAMPUS_ORGWIDE_MARKER = { api: "MembershipApi", contentType: "Campus", action: "Admin" } as const;

// Campus Admin + Leadership Admin can write credentials (People__Edit capability).
export const canWriteOrdinations = (): boolean => UserHelper.checkAccess(Permissions.membershipApi.people.edit);

// Leadership Admin only — managing the church-wide vocabulary requires the dual
// gate that mirrors the server (02-03): write capability AND the org-wide marker.
export const canManageOrdinationTypes = (): boolean => canWriteOrdinations() && UserHelper.checkAccess(CAMPUS_ORGWIDE_MARKER);

export const ORDINATION_STATUSES = ["pending", "active", "suspended", "revoked", "emeritus"] as const;

// Pitfall 4: legal lifecycle transitions. revoked is TERMINAL — re-credentialing
// is a NEW issue (a new row permitted by the ORD-04 NULL-distinct index), never a
// transition back out of revoked. Mirrors the server OrdinationStatusHelper map.
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ["active", "revoked"],
  active: ["suspended", "revoked", "emeritus"],
  suspended: ["active", "revoked", "emeritus"],
  emeritus: ["active", "revoked"],
  revoked: []
};

export const allowedNextStatuses = (current: string): string[] => ALLOWED_TRANSITIONS[current] ?? [];
