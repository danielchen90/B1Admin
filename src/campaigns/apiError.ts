// Shared helper for the campaigns send-spine components (Plan 11-03).
//
// ApiHelper throws on any non-2xx response (see @churchapps/helpers ApiHelper.
// throwApiError): the thrown Error's `message` is the RAW response body string
// (the Plan-02 controller returns `{ error, code }` JSON for 404/409/422). It is
// NOT parsed for us — a `{}`/`[]` body is dropped to statusText, otherwise the
// whole body string becomes the message. So to react to the machine `code`
// (DOMAIN_UNVERIFIED / NO_EMAIL_SETTINGS / BAD_STATUS / conflict) we parse the
// message back into JSON here.

export interface ApiErrorBody {
  error?: string;
  code?: string;
  message?: string;
}

// Best-effort extraction of the server's `{ error, code }` body from a thrown
// ApiHelper error. Falls back to the raw message when the body isn't JSON.
export function parseApiError(err: unknown): ApiErrorBody {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as ApiErrorBody;
  } catch {
    /* not JSON — fall through to the raw string */
  }
  return { error: raw };
}

// A human-readable message for an arbitrary thrown error, preferring the
// server's `error` field over the raw string.
export function apiErrorMessage(err: unknown, fallback = "Something went wrong."): string {
  const body = parseApiError(err);
  return body.error || body.message || fallback;
}
