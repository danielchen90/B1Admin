import React from "react";
import { Link as RouterLink } from "react-router-dom";
import { UserHelper, type PersonInterface } from "@churchapps/apphelper";
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControl, InputLabel, Link, MenuItem, Select, Stack, Typography
} from "@mui/material";
import { Download as DownloadIcon, Print as PrintIcon, Warning as WarningIcon } from "@mui/icons-material";
import { parseApiError } from "../../helpers/OrdinationHelper";
import { useLicenseTemplates } from "../../hooks/useLicenseTemplates";
import { type LicenseTemplateInterface, type LicenseTemplateLayout } from "../LicenseTemplateInterface";
import { type PersonOrdinationInterface } from "../../people/components/PersonOrdinationInterface";
import { type OrdinationTypeInterface } from "../../settings/components/OrdinationTypeInterface";
import { type CampusInterface } from "../../settings/components/CampusInterface";
import { BINDING_CATALOG, formatCampusAddress, resolveBinding } from "../helpers/bindings";
import { getCalibration } from "./calibrationStorage";
import { confirmCard, renderCard, type RenderResult } from "./licenseRenderApi";

interface Props {
  open: boolean;
  person?: PersonInterface;
  ordination: PersonOrdinationInterface;
  ordinationType?: OrdinationTypeInterface;
  campus?: CampusInterface;
  onClose: () => void;
}

const EM_DASH = "—";

// PrintLicenseDialog — the operator-facing single-card print flow (PRT-01/03/07).
//
// LOCKED behaviors:
//  - THE PREVIEW IS THE PDF: the iframe shows the exact archived bytes /render returned;
//    Download/Print reuse the SAME object URL — never a re-render (fidelity guarantee).
//  - Explicit template pick from the ACTIVE applicable templates (type-bound + global).
//  - HARD BLOCK when no active template applies — cannot render without a layout; point
//    the operator to the editor. /render is NOT called in this state.
//  - WARN-BUT-ALLOW: missing photo / empty bound fields are surfaced but never disable
//    printing — the operator proceeds by judgment.
//  - AUDIT ON CONFIRM ONLY: /confirm (the licenseCards row) fires on Download/Print, never
//    on preview.
export const PrintLicenseDialog: React.FC<Props> = (props) => {
  const { open, person, ordination, ordinationType, campus, onClose } = props;
  const templates = useLicenseTemplates();

  const [selectedId, setSelectedId] = React.useState<string>("");
  const [rendering, setRendering] = React.useState(false);
  const [renderError, setRenderError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<RenderResult | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const [confirmError, setConfirmError] = React.useState<string | null>(null);

  // Ref holds the CURRENT object URL so we can revoke the previous one on each new render
  // and on unmount (object URLs leak until revoked).
  const urlRef = React.useRef<string | null>(null);
  React.useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  // Applicable ACTIVE templates: those bound to this credential's ordination type PLUS
  // global (null-type) actives. Default-first so the recommended layout pre-selects.
  const applicable = React.useMemo(() => {
    const list = templates.filter((t) =>
      t.active && (!t.ordinationTypeId || t.ordinationTypeId === ordination.ordinationTypeId));
    return [...list].sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
  }, [templates, ordination.ordinationTypeId]);

  const selected: LicenseTemplateInterface | undefined =
    applicable.find((t) => t.id === selectedId) || undefined;

  // When the dialog opens (or the applicable set / credential changes) preselect the
  // preferred template. Clears any stale render.
  React.useEffect(() => {
    if (!open) return;
    setConfirmError(null);
    setRenderError(null);
    const preferred = applicable[0]?.id || "";
    setSelectedId(preferred);
    if (!preferred) setResult(null);
  }, [open, applicable, ordination.id]);

  // Render (or re-render) whenever a template is selected while open. Streams the exact
  // PDF bytes → object URL for the iframe proof; revokes the previous URL.
  React.useEffect(() => {
    if (!open || !selectedId || !ordination.id) return;
    let active = true;
    setRendering(true);
    setRenderError(null);
    setConfirmError(null);
    renderCard({ personOrdinationId: ordination.id, templateId: selectedId, calibration: getCalibration() })
      .then((r) => {
        if (!active) { URL.revokeObjectURL(r.url); return; }
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = r.url;
        setResult(r);
      })
      .catch((e) => {
        if (!active) return;
        setResult(null);
        const code = parseApiError(e);
        setRenderError(code === "unauthorized" ? "You do not have permission to print this credential."
          : code === "not_found" ? "The credential or template could not be found."
            : (e?.message || "Failed to render the license."));
      })
      .finally(() => { if (active) setRendering(false); });
    return () => { active = false; };
  }, [open, selectedId, ordination.id]);

  // Flat binding data map (friendly keys) for the blank-field warnings. Mirrors the
  // server's buildPreviewData sources so the warnings match what will actually render.
  const dataMap = React.useMemo<Record<string, any>>(() => ({
    "person.fullName": person?.name?.display,
    "person.lastName": person?.name?.last,
    "person.firstName": person?.name?.first,
    "person.displayName": person?.name?.display,
    "person.middleName": person?.name?.middle,
    "ordinationType.name": ordinationType?.name,
    "ordinationType.code": ordinationType?.code,
    "campus.name": campus?.name,
    "campus.address": formatCampusAddress(campus),
    "campus.city": campus?.city,
    "campus.state": campus?.state,
    "credentialNumber": ordination?.credentialNumber,
    "ordination.grantedDate": ordination?.grantedDate,
    "ordination.expirationDate": ordination?.expirationDate,
    "ordination.status": ordination?.status,
    "church.name": UserHelper.currentUserChurch?.church?.name
  }), [person, ordinationType, campus, ordination]);

  // Parse the selected template's layout and list any bound fields it USES that resolve
  // to empty — so the operator double-checks before committing a blank CR80 card.
  const blankFields = React.useMemo<string[]>(() => {
    if (!selected?.layoutJson) return [];
    let layout: LicenseTemplateLayout;
    try {
      layout = JSON.parse(selected.layoutJson) as LicenseTemplateLayout;
    } catch {
      return [];
    }
    const labels: string[] = [];
    (layout.elements || []).forEach((el) => {
      if (el.type !== "boundText") return;
      const key = (el as any).binding as string;
      if (resolveBinding(key, dataMap) === "") {
        const label = BINDING_CATALOG.find((b) => b.key === key)?.label || key;
        if (!labels.includes(label)) labels.push(label);
      }
    });
    return labels;
  }, [selected, dataMap]);

  const usesPhoto = React.useMemo<boolean>(() => {
    if (!selected?.layoutJson) return false;
    try {
      const layout = JSON.parse(selected.layoutJson) as LicenseTemplateLayout;
      return (layout.elements || []).some((el) => el.type === "photo");
    } catch {
      return false;
    }
  }, [selected]);

  // Server inlines the photo only when person.photoUpdated is set (that is the signal a
  // stored source exists). Warn only when the template actually places a photo region.
  const missingPhoto = usesPhoto && !person?.photoUpdated;

  const personName = person?.name?.display || [person?.name?.first, person?.name?.last].filter(Boolean).join(" ") || EM_DASH;

  // Confirm → audit the archived blob, THEN download or print the SAME bytes.
  const confirmThen = async (action: (r: RenderResult) => void) => {
    if (!result || !selectedId || !ordination.id) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      await confirmCard({
        renderId: result.renderId,
        personOrdinationId: ordination.id,
        templateId: selectedId,
        templateVersion: result.templateVersion
      });
      action(result);
    } catch (e: any) {
      const code = parseApiError(e);
      setConfirmError(code === "unauthorized" ? "You do not have permission to print this credential."
        : (e?.message || "Failed to record the print."));
    } finally {
      setConfirming(false);
    }
  };

  const handleDownload = () => confirmThen((r) => {
    const a = document.createElement("a");
    a.href = r.url;
    a.download = "license-" + (ordination.credentialNumber || ordination.id) + ".pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  const handlePrint = () => confirmThen((r) => {
    // Open the exact bytes so the browser's PDF viewer drives the OS print dialog.
    const w = window.open(r.url, "_blank");
    w?.focus();
  });

  const noTemplate = applicable.length === 0;
  const busy = rendering || confirming;

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>Print License</DialogTitle>
      <DialogContent dividers>
        {noTemplate ? (
          // HARD BLOCK — no active applicable template exists; cannot render a card.
          <Alert severity="warning" icon={<WarningIcon />}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              No active license template applies to this credential, so there is nothing to print yet.
            </Typography>
            <Link component={RouterLink} to="/settings/license-templates">
              Create or activate a template in License Templates
            </Link>
          </Alert>
        ) : (
          <Stack spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="print-template-label">Template</InputLabel>
              <Select
                labelId="print-template-label"
                label="Template"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                disabled={busy}
                data-testid="print-template-select">
                {applicable.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.name || "(untitled)"}{t.isDefault ? " · Default" : ""}
                    {!t.ordinationTypeId ? " · Global" : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Data summary — operator double-checks the bound values before a blank card. */}
            <Box sx={{ p: 1.5, borderRadius: 1, backgroundColor: "var(--bg-sub)" }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Card data</Typography>
              <Typography variant="body2" color="text.secondary">Person: {personName}</Typography>
              <Typography variant="body2" color="text.secondary">Credential #: {ordination.credentialNumber || EM_DASH}</Typography>
              <Typography variant="body2" color="text.secondary">Ordination: {ordinationType?.name || EM_DASH}</Typography>
              <Typography variant="body2" color="text.secondary">Campus: {campus?.name || EM_DASH}</Typography>
              <Typography variant="body2" color="text.secondary">
                Template: {selected?.name || EM_DASH}{result ? " · v" + result.templateVersion : ""}
              </Typography>
            </Box>

            {/* Warn-but-allow: neither disables Print. */}
            {missingPhoto && (
              <Alert severity="warning">No license photo on file — the photo area will render blank.</Alert>
            )}
            {blankFields.length > 0 && (
              <Alert severity="warning">
                These bound fields are empty and will render blank: {blankFields.join(", ")}.
              </Alert>
            )}
            {renderError && <Alert severity="error">{renderError}</Alert>}
            {confirmError && <Alert severity="error">{confirmError}</Alert>}

            {/* THE PROOF — the exact PDF bytes that will print. */}
            <Box sx={{ position: "relative", width: "100%", height: 420, border: "1px solid", borderColor: "grey.300", borderRadius: 1, overflow: "hidden", backgroundColor: "grey.100" }}>
              {rendering && (
                <Stack alignItems="center" justifyContent="center" sx={{ position: "absolute", inset: 0, zIndex: 1 }}>
                  <CircularProgress size={28} />
                </Stack>
              )}
              {result && (
                <iframe
                  title="License proof"
                  src={result.url}
                  style={{ width: "100%", height: "100%", border: "none" }}
                  data-testid="print-proof-iframe"
                />
              )}
            </Box>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Close</Button>
        {!noTemplate && (
          <>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleDownload}
              disabled={!result || busy}
              data-testid="print-download-button">
              Download PDF
            </Button>
            <Button
              variant="contained"
              startIcon={<PrintIcon />}
              onClick={handlePrint}
              disabled={!result || busy}
              data-testid="print-confirm-button">
              Print
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};
