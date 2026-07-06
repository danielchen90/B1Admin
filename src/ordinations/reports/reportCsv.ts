// CSV mapping for the leadership report (RPT-05 CSV half). Flattens the (possibly nested)
// grouped rows into FLAT plain objects with STRING values only — ExportLink/react-csv recurses
// into nested objects and emits `person.name.first`-style columns otherwise (Pitfall 8). Dates
// are pre-formatted via DateHelper (empty string when null).
import { DateHelper } from "@churchapps/helpers";
import { type ReportGroup, type ReportRow, type ReportFilterSpec } from "./reportTypes";

export interface CsvRow {
  name: string;
  campus: string;
  ordination: string;
  status: string;
  credentialNumber: string;
  grantedDate: string;
  expirationDate: string;
}

// customHeaders in RPT-04 order — label is the CSV column header, key maps to CsvRow.
export const CSV_HEADERS: { label: string; key: string }[] = [
  { label: "Name", key: "name" },
  { label: "Campus", key: "campus" },
  { label: "Ordination", key: "ordination" },
  { label: "Status", key: "status" },
  { label: "Credential #", key: "credentialNumber" },
  { label: "Granted", key: "grantedDate" },
  { label: "Expires", key: "expirationDate" }
];

// Format a date-only "YYYY-MM-DD" as a LOCAL calendar day (Pitfall 4) then pretty-print.
function formatDate(value: string | null): string {
  if (!value) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  return isNaN(d.getTime()) ? "" : DateHelper.prettyDate(d);
}

function rowToCsv(row: ReportRow): CsvRow {
  return {
    name: row.displayName || `${row.firstName} ${row.lastName}`.trim(),
    campus: row.campusName,
    ordination: row.ordinationsCell ?? row.callingName,
    status: row.status,
    credentialNumber: row.credentialNumber ?? "",
    grantedDate: formatDate(row.grantedDate),
    expirationDate: formatDate(row.expirationDate)
  };
}

// Flatten the grouped (and nested) rows into a single flat CsvRow[] in on-screen order.
export function toCsvRows(groups: ReportGroup[], _spec: ReportFilterSpec): CsvRow[] {
  const out: CsvRow[] = [];
  const walk = (list: ReportGroup[]) => {
    list.forEach((group) => {
      group.rows.forEach((row) => out.push(rowToCsv(row)));
      if (group.subGroups) walk(group.subGroups);
    });
  };
  walk(groups);
  return out;
}
