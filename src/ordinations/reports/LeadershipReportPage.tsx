import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Permissions, UserHelper, type PersonInterface } from "@churchapps/helpers";
import { Loading, PageHeader, PersonHelper } from "@churchapps/apphelper";
import { Box, Grid, Stack, Button, CircularProgress, Snackbar, Alert, Dialog, DialogTitle, DialogContent } from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import EmailIcon from "@mui/icons-material/Email";
import { ExportButton, PageBreadcrumbs } from "../../components/ui";
import { useCampuses } from "../../hooks/useCampuses";
import { useOrdinationTypes } from "../../hooks/useOrdinationTypes";
import { type PersonOrdinationInterface } from "../../people/components/PersonOrdinationInterface";
import { composeReport, filterReport, getAccessibleCampuses, groupReport, STATUS_ORDER } from "./reportHelpers";
import { type ReportFilterSpec, type ReportRow } from "./reportTypes";
import { ReportFilterPanel } from "./ReportFilterPanel";
import { ReportTable } from "./ReportTable";
import { CSV_HEADERS, toCsvRows } from "./reportCsv";
import { downloadReportPdf } from "./reportPdfApi";
import { GrantLicensesDialog } from "./GrantLicensesDialog";
import { grantLicenses, updatePayment } from "./reportPaymentApi";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import PrintIcon from "@mui/icons-material/Print";
import SettingsIcon from "@mui/icons-material/Settings";
import { canManageOrdinationTypes, canWriteOrdinations } from "../../helpers/OrdinationHelper";
import { createBatch } from "../printStation/printBatchApi";
import { emailThesePeople } from "../../campaigns/emailThesePeople";
import { PersonAdd } from "../../components/PersonAdd";
import { OrdinationIssueDialog } from "../../people/components/OrdinationIssueDialog";
import { PrintTemplateDialog } from "./PrintTemplateDialog";

// Grant-license default dates, computed in LOCAL time to avoid a UTC off-by-one (Pitfall 4):
// granted = the Friday of NEXT week; expiration = one year later minus a day.
const fmtLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const nextWeekFriday = () => { const t = new Date(); const daysToFri = (5 - t.getDay() + 7) % 7; const thisFri = new Date(t.getFullYear(), t.getMonth(), t.getDate() + daysToFri); return new Date(thisFri.getFullYear(), thisFri.getMonth(), thisFri.getDate() + 7); };
const plusYearMinusDay = (d: Date) => new Date(d.getFullYear() + 1, d.getMonth(), d.getDate() - 1);

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
  sortDir: "asc",
  paymentStatus: "all"
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

  // Distinct credential ids passing ALL filters — the bulk-grant target set.
  const visibleIds = useMemo(() => Array.from(new Set(filtered.map((r) => r.id).filter(Boolean))), [filtered]);
  // Distinct personIds passing ALL filters — the print-batch target (the server expands each
  // person into one card per active credential). Print Licenses jumps to the batch view.
  //
  // ORDER MATTERS: the batch prints in the exact order these ids are sent (the server renders
  // and assembles pages index-aligned to the input). So derive the order from the on-screen
  // `groups` (campus group order = master, name sort = secondary within each group), NOT the
  // unsorted `filtered` list — this makes the printed page order match what the operator sees
  // and sorts on screen. groups[].personIds are already name-sorted within each group (nested
  // top-level groups aggregate their subGroups' personIds in order); the Set de-dupe keeps a
  // multi-campus person at their first (master-order) occurrence.
  const visiblePersonIds = useMemo(() => Array.from(new Set(groups.flatMap((g) => g.personIds).filter(Boolean))), [groups]);

  const navigate = useNavigate();
  const canWrite = canWriteOrdinations();
  const canManageTypes = canManageOrdinationTypes();
  // "Email these people" is gated on the same nav perm the Email area uses.
  const canEmail = UserHelper.checkAccess(Permissions.membershipApi.people.view);
  const [printing, setPrinting] = useState(false);
  const [emailing, setEmailing] = useState(false);

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

  // Success/error snackbars for the payment toggles + bulk grant (errors reuse pdfError).
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Toggle Paid/Exempt — persist with the row's version, then refetch to pull the bumped
  // version + new flags. A version_conflict (or any failure) surfaces via pdfError + refetch.
  const handleToggle = async (row: ReportRow, changes: { paid?: boolean; exempt?: boolean }) => {
    try {
      await updatePayment(row.id, row.version, changes);
      await ordQuery.refetch();
    } catch (e: any) {
      setPdfError(e?.message ? String(e.message) : "Failed to update payment.");
      await ordQuery.refetch();
    }
  };

  // Add Ordination — pick any person (search box), then issue a credential (type +
  // dates) via the shared OrdinationIssueDialog. Mirrors the leadership-hub flow so a
  // first credential can be created straight from the report. On success, refetch so
  // the new holder appears in the roster.
  const [addPerson, setAddPerson] = useState<PersonInterface | null>(null);
  const [personSearchOpen, setPersonSearchOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const handleAddPerson = (person: PersonInterface) => {
    setAddPerson(person);
    setPersonSearchOpen(false);
    setIssueOpen(true);
  };
  const handleIssued = async () => {
    setIssueOpen(false);
    await ordQuery.refetch();
    setSuccessMsg("Credential issued" + (addPerson?.name?.display ? ` for ${addPerson.name.display}` : "") + ".");
  };

  // Bulk grant — POST every visible id, refetch, and summarize granted/skipped.
  const [grantOpen, setGrantOpen] = useState(false);
  const grantDefaults = useMemo(() => {
    const fri = nextWeekFriday();
    return { granted: fmtLocal(fri), expiration: fmtLocal(plusYearMinusDay(fri)) };
  }, [grantOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  const handleGrant = async (granted: string, expiration: string) => {
    const result = await grantLicenses(visibleIds, granted, expiration);
    await ordQuery.refetch();
    setSuccessMsg(`Granted ${result.granted} license(s); ${result.skipped.length} skipped.`);
    setGrantOpen(false);
  };

  // Print Licenses — FIRST ask which template to use (a license, a certificate, or auto),
  // THEN build a print batch from the currently-visible people and jump to the batch view
  // (progress → download/print → reprint/void). Whatever is filtered on screen is exactly
  // what's sent; the server skips people with no active credential / template / photo.
  const [printTemplateOpen, setPrintTemplateOpen] = useState(false);
  const handlePrintLicenses = () => {
    if (visiblePersonIds.length === 0 || printing) return;
    setPrintTemplateOpen(true);
  };
  const handleConfirmPrint = async (templateId?: string) => {
    setPrintTemplateOpen(false);
    if (visiblePersonIds.length === 0 || printing) return;
    setPrinting(true);
    setPdfError(null);
    try {
      // Restrict the printed cards to the credential types the report is filtered to, so a
      // person holding several credentials prints ONLY the filtered type(s) — not a duplicate
      // card for every credential. Empty ordinationTypeIds => all credentials (unchanged).
      const result = await createBatch({ personIds: visiblePersonIds, ordinationTypeIds: spec.ordinationTypeIds, filterJson: JSON.stringify(spec), templateId });
      navigate("/ordinations/print-station/" + result.batchId);
    } catch (e: any) {
      setPdfError(e?.message ? String(e.message) : "Failed to start the print batch.");
      setPrinting(false);
    }
  };

  // Email these people — carry the currently-visible people (the SAME explicit
  // set Print Licenses uses) into a new draft campaign and open the editor on the
  // Audience tab. The report has already resolved the filtered people, so an
  // explicit { personIds } carry (12-02) is the honest descriptor; the single
  // selected campus (when exactly one) sets the "Sending as" scope. Mirrors
  // handlePrintLicenses (resolve → create downstream record → navigate).
  const handleEmailThese = async () => {
    if (visiblePersonIds.length === 0 || emailing) return;
    setEmailing(true);
    setPdfError(null);
    try {
      const campusId = spec.campusIds.length === 1 ? spec.campusIds[0] : undefined;
      await emailThesePeople({ personIds: visiblePersonIds, campusId, name: "Leadership Email" }, navigate);
    } catch (e: any) {
      setPdfError(e?.message ? String(e.message) : "Failed to start a campaign for these people.");
      setEmailing(false);
    }
  };

  return (
    <>
      <PageBreadcrumbs items={[{ label: "Ordinations", path: "/ordinations/hub" }, { label: "Leadership Report" }]} />
      <PageHeader title="Leadership Report" subtitle="All credential holders across your campuses — filter, group, and export." />

      <Box sx={{ p: 3 }}>
        <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mb: 2 }} flexWrap="wrap" rowGap={1}>
          {/* Demoted ordination-type management — a header entry (also a left-nav sub-item). */}
          {canManageTypes && (
            <Button variant="text" size="small" startIcon={<SettingsIcon />} component={RouterLink} to="/settings/ordination-types">
              Manage Types
            </Button>
          )}
          {/* Credential any person straight from the report: search a person, then pick a type. */}
          {canWrite && (
            <Button
              variant="contained"
              size="small"
              startIcon={<PersonAddIcon />}
              onClick={() => setPersonSearchOpen(true)}
              data-testid="report-add-ordination-button"
            >
              Add Ordination
            </Button>
          )}
          {/* Batch-print the currently-visible people → jump to the print-station batch view. */}
          {canWrite && (
            <Button
              variant="outlined"
              size="small"
              startIcon={printing ? <CircularProgress size={16} /> : <PrintIcon />}
              disabled={printing || visiblePersonIds.length === 0}
              onClick={handlePrintLicenses}
            >
              {printing ? "Preparing…" : "Print Licenses"}
            </Button>
          )}
          {/* Carry the currently-visible people into a new draft campaign + editor. */}
          {canEmail && (
            <Button
              variant="outlined"
              size="small"
              startIcon={emailing ? <CircularProgress size={16} /> : <EmailIcon />}
              disabled={emailing || visiblePersonIds.length === 0}
              onClick={handleEmailThese}
            >
              {emailing ? "Preparing…" : "Email these people"}
            </Button>
          )}
          <ExportButton data={csvData} filename="leadership-report.csv" text="Export CSV" customHeaders={CSV_HEADERS} />
          {/* Bulk-grants an active license to every currently-visible credential. */}
          {canWrite && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<WorkspacePremiumIcon />}
              disabled={visibleIds.length === 0}
              onClick={() => setGrantOpen(true)}
            >
              Grant Licenses
            </Button>
          )}
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
              <ReportTable
                groups={groups}
                onTogglePaid={(row, next) => handleToggle(row, { paid: next })}
                onToggleExempt={(row, next) => handleToggle(row, { exempt: next })}
              />
            </Grid>
          </Grid>
        )}
      </Box>

      {/* Step 1: choose the person to credential. */}
      {canWrite && (
        <Dialog open={personSearchOpen} onClose={() => setPersonSearchOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>Add Ordination — Select Person</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1 }}>
              <PersonAdd
                getPhotoUrl={PersonHelper.getPhotoUrl}
                addFunction={handleAddPerson}
                actionLabel="Select"
                showCreatePersonOnNotFound
              />
            </Box>
          </DialogContent>
        </Dialog>
      )}

      {/* Step 2: pick the ordination type + details and issue the credential. */}
      {canWrite && addPerson && (
        <OrdinationIssueDialog
          open={issueOpen}
          personId={addPerson.id}
          onClose={() => setIssueOpen(false)}
          onIssued={handleIssued}
        />
      )}

      {/* Step 1 of Print Licenses: choose the template for the whole batch. */}
      {canWrite && (
        <PrintTemplateDialog
          open={printTemplateOpen}
          count={visiblePersonIds.length}
          onClose={() => setPrintTemplateOpen(false)}
          onConfirm={handleConfirmPrint}
        />
      )}

      <GrantLicensesDialog
        open={grantOpen}
        count={visibleIds.length}
        defaultGranted={grantDefaults.granted}
        defaultExpiration={grantDefaults.expiration}
        onClose={() => setGrantOpen(false)}
        onConfirm={handleGrant}
      />

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

      <Snackbar
        open={successMsg !== null}
        autoHideDuration={6000}
        onClose={() => setSuccessMsg(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" onClose={() => setSuccessMsg(null)} variant="filled">
          {successMsg}
        </Alert>
      </Snackbar>
    </>
  );
};
