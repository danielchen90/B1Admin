import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type PersonInterface } from "@churchapps/helpers";
import { Loading, PageHeader } from "@churchapps/apphelper";
import { Box, Grid, Stack, Button, CircularProgress, Snackbar, Alert } from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { ExportButton } from "../../components/ui";
import { useCampuses } from "../../hooks/useCampuses";
import { useOrdinationTypes } from "../../hooks/useOrdinationTypes";
import { type PersonOrdinationInterface } from "../../people/components/PersonOrdinationInterface";
import { composeReport, filterReport, getAccessibleCampuses, groupReport, STATUS_ORDER } from "./reportHelpers";
import { type ReportFilterSpec } from "./reportTypes";
import { ReportFilterPanel } from "./ReportFilterPanel";
import { ReportTable } from "./ReportTable";
import { CSV_HEADERS, toCsvRows } from "./reportCsv";
import { downloadReportPdf } from "./reportPdfApi";

// The leadership-report route target (/ordinations/reports). 100% client-side — it fetches the
// same campus-scoped GETs the 7.1 print station uses (ALL statuses, no active-only filter),
// composes atomic rows, then filters + groups + sorts them for the on-screen nested table and
// the CSV export. The "Download PDF" button (Plan 08-03) hangs off the same toolbar.

const DEFAULT_SPEC: ReportFilterSpec = {
  campusIds: [], // filled to all accessible once, below (didInitCampuses)
  ordinationTypeIds: [], // [] = all types
  statuses: [...STATUS_ORDER], // all statuses selected by default
  expiringWithinDays: null,
  search: "",
  groupBy1: "location",
  groupBy2: "none",
  sortBy: "lastName",
  sortDir: "asc"
};

export const LeadershipReportPage: React.FC = () => {
  // All-status credentials (no active-only filter) — the campus scope is applied server-side.
  const ordQuery = useQuery<PersonOrdinationInterface[]>({ queryKey: ["/personOrdinations", "MembershipApi"], placeholderData: [] });
  const ordinations = useMemo(() => ordQuery.data ?? [], [ordQuery.data]);

  const personIds = useMemo(() => Array.from(new Set(ordinations.map((o) => o.personId ?? "").filter(Boolean))), [ordinations]);
  // GET /people/ids — GUARDED: an empty ids param 500s server-side (Pitfall 7).
  const peopleQuery = useQuery<PersonInterface[]>({
    queryKey: ["/people/ids?ids=" + personIds.join(","), "MembershipApi"],
    enabled: personIds.length > 0,
    placeholderData: []
  });

  const types = useOrdinationTypes(); // sortOrder-ordered
  const campuses = useCampuses();

  const [spec, setSpec] = useState<ReportFilterSpec>(DEFAULT_SPEC);

  const rows = useMemo(() => composeReport(ordinations, peopleQuery.data ?? [], types, campuses), [ordinations, peopleQuery.data, types, campuses]);
  const accessibleCampuses = useMemo(() => getAccessibleCampuses(ordinations, campuses), [ordinations, campuses]);

  // Pre-check every accessible campus exactly once (a later Clear-all must not re-fill).
  const didInitCampuses = useRef(false);
  useEffect(() => {
    if (didInitCampuses.current) return;
    if (accessibleCampuses.length === 0) return;
    didInitCampuses.current = true;
    setSpec((prev) => ({ ...prev, campusIds: accessibleCampuses.map((c) => c.id).filter((id): id is string => !!id) }));
  }, [accessibleCampuses]);

  const filtered = useMemo(() => filterReport(rows, spec), [rows, spec]);
  const groups = useMemo(() => groupReport(filtered, spec), [filtered, spec]);
  const csvData = useMemo(() => toCsvRows(groups, spec), [groups, spec]);

  const loading = ordQuery.isLoading || (personIds.length > 0 && peopleQuery.isLoading);

  // Download PDF — POST the CURRENT spec to the 08-01 server endpoint (RPT-06 scope is re-resolved
  // server-side; spec.campusIds is only a display filter). Busy state disables the button; any
  // error surfaces via the snackbar.
  const [downloading, setDownloading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const handleDownloadPdf = async () => {
    setDownloading(true);
    setPdfError(null);
    try {
      await downloadReportPdf(spec);
    } catch (e: any) {
      setPdfError(e?.message ? String(e.message) : "Failed to download the report PDF.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <PageHeader title="Leadership Report" subtitle="All credential holders across your campuses — filter, group, and export." />

      <Box sx={{ p: 3 }}>
        <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mb: 2 }}>
          <ExportButton data={csvData} filename="leadership-report.csv" text="Export CSV" customHeaders={CSV_HEADERS} />
          {/* Posts the CURRENT ReportFilterSpec to POST /reports/leadership/pdf (08-01) and
              downloads the returned PDF bytes. Disabled while awaiting the render. */}
          <Button
            variant="outlined"
            size="small"
            startIcon={downloading ? <CircularProgress size={16} /> : <PictureAsPdfIcon />}
            disabled={downloading}
            onClick={handleDownloadPdf}
          >
            {downloading ? "Preparing…" : "Download PDF"}
          </Button>
        </Stack>

        {loading ? (
          <Loading />
        ) : (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReportFilterPanel spec={spec} onChange={setSpec} accessibleCampuses={accessibleCampuses} ordinationTypes={types} />
            </Grid>
            <Grid size={{ xs: 12, md: 9 }}>
              <ReportTable groups={groups} />
            </Grid>
          </Grid>
        )}
      </Box>

      <Snackbar
        open={pdfError !== null}
        autoHideDuration={8000}
        onClose={() => setPdfError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" onClose={() => setPdfError(null)} variant="filled">
          {pdfError}
        </Alert>
      </Snackbar>
    </>
  );
};
