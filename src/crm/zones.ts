// Time zones and countries for the CRM and the event planner (from the browser's Intl data).

export const TIMEZONES: string[] = (() => {
  try { return (Intl as any).supportedValuesOf("timeZone") as string[]; } catch {
    return [
      "UTC", "America/New_York", "America/Chicago", "America/Los_Angeles", "Europe/London", "Africa/Lagos", "Africa/Nairobi", "Asia/Karachi", "Asia/Kolkata", "Asia/Manila"
    ];
  }
})();

const CODES = "AF AX AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BA BW BV BR IO VG BN BG BF BI KH CM CA CV BQ KY CF TD CL CN CX CC CO KM CD CG CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF KP MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS KR SS ES LK BL SH KN LC MF PM VC SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UM VI UG UA AE GB US UY UZ VU VA VE VN WF EH YE ZM ZW".split(" ");

const names = (() => { try { return new Intl.DisplayNames(["en"], { type: "region" }); } catch { return null; } })();
export const countryName = (code?: string | null) => (code ? names?.of(code) || code : "");
export const countryOptions = CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name));

/** "UTC+3" style offset of a zone at a given instant. */
export function offsetLabel(tz: string, at = new Date()): string {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(at).find((p) => p.type === "timeZoneName");
    return (part?.value || "").replace("GMT", "UTC") || "UTC";
  } catch { return ""; }
}

/** Local wall time of an instant in a zone, e.g. "Sat 7:00 PM". */
export function wallTime(tz: string, at: Date, opts: Intl.DateTimeFormatOptions = { weekday: "short", hour: "numeric", minute: "2-digit" }): string {
  try { return at.toLocaleString("en-US", { timeZone: tz, ...opts }); } catch { return ""; }
}

/** The hour (0-23) of an instant in a zone. */
export function localHour(tz: string, at: Date): number {
  try { return Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(at)); } catch { return -1; }
}

/** Convert a wall-clock date + time in `tz` to a UTC instant. */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time || "00:00").split(":").map(Number);
  let guess = Date.UTC(y, m - 1, d, hh, mm);
  // Two passes settle DST edges: shift by the zone's offset at the guess.
  for (let i = 0; i < 2; i++) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(guess));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
    guess += Date.UTC(y, m - 1, d, hh, mm) - asUtc;
  }
  return new Date(guess);
}

/** Main time zones of the countries the ministry works in (fallback when the CRM has few zones). */
export const MAJOR_ZONES: { tz: string; label: string }[] = [
  { tz: "America/Los_Angeles", label: "Los Angeles" },
  { tz: "America/Chicago", label: "Chicago" },
  { tz: "America/New_York", label: "New York" },
  { tz: "America/Jamaica", label: "Jamaica" },
  { tz: "America/Port-au-Prince", label: "Haiti" },
  { tz: "America/Sao_Paulo", label: "Brazil" },
  { tz: "Europe/London", label: "London" },
  { tz: "Africa/Lagos", label: "Nigeria" },
  { tz: "Africa/Accra", label: "Ghana" },
  { tz: "Africa/Johannesburg", label: "South Africa" },
  { tz: "Africa/Nairobi", label: "Kenya / Uganda" },
  { tz: "Asia/Jerusalem", label: "Israel" },
  { tz: "Asia/Karachi", label: "Pakistan" },
  { tz: "Asia/Kolkata", label: "India" },
  { tz: "Asia/Manila", label: "Philippines" },
  { tz: "Australia/Sydney", label: "Sydney" }
];
