import { ApiHelper } from "@churchapps/apphelper";
import { type ReportFilterSpec } from "./reportTypes";

// Client for the 08-01 leadership-report PDF endpoint (POST /reports/leadership/pdf).
//
// WHY hand-rolled fetch: ApiHelper parses EVERY response body as JSON and exposes NO blob /
// postFile method, but /reports/leadership/pdf STREAMS raw application/pdf bytes. So this goes
// through fetch() using ApiHelper.getConfig("MembershipApi") for the base URL + JWT, reads the
// exact bytes via res.blob(), and triggers a browser download from an object URL. (Same reason
// licenseRenderApi.ts hand-rolls its /render + /testCard calls.)
//
// PATH: MembershipApi's base already ends in /membership, so the sub-path here is the BARE
// "/reports/leadership/pdf" — prefixing "/membership" would double to a 404 (this project's
// recurring doubled-prefix lesson, proven in Phase 3 and carried through 05-*/06-*).

const membershipConfig = (): { url: string; jwt: string } => {
  const cfg = ApiHelper.getConfig("MembershipApi");
  const url = (cfg?.url || "").replace(/\/+$/, "");
  return { url, jwt: cfg?.jwt || "" };
};

// POST the CURRENT ReportFilterSpec to the server PDF endpoint, read the returned application/pdf
// bytes as a Blob, and trigger a browser download of "leadership-report.pdf". The endpoint
// re-resolves campus scope server-side (RPT-06) — the spec's campusIds are only a display filter.
export const downloadReportPdf = async (spec: ReportFilterSpec): Promise<void> => {
  const cfg = membershipConfig();
  const res = await fetch(cfg.url + "/reports/leadership/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + cfg.jwt },
    body: JSON.stringify(spec)
  });
  if (!res.ok) throw new Error((await res.text()) || "Report PDF failed (HTTP " + res.status + ")");

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = "leadership-report.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};
