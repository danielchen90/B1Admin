// CertificatesPage.tsx — the "Ordination Certificates" print area (Quick-5).
//
// A SEPARATE, lean print flow that reuses ONLY the render ENGINE — NOT the CR80 card
// lifecycle. There is NO Badgy calibration, NO printBatches, NO /licenseCards/confirm
// audit row, NO PrintLicenseDialog. Flow:
//   1. pick a person (PersonAdd) → load their /personOrdinations
//   2. pick an ordination + a LETTER-format template (filtered by parsing layoutJson)
//   3. Generate → renderCard({ personOrdinationId, templateId, calibration: zeros })
//      hits the EXISTING /licenseCards/render endpoint (which reads widthMm/heightMm
//      from layoutJson — Quick-5 Task 1 made @page follow), streaming a Letter PDF.
//   4. show the PDF object URL in an <iframe> with Download / Print buttons.
//
// PATH note: all reads use the BARE MembershipApi path (base already ends in
// /membership). Campus-scope 401/404 behavior is inherited from the render endpoint
// (same guards cards use) and is correct — surfaced inline via parseApiError.

import React from "react";
import { ApiHelper, PageHeader, PersonHelper } from "@churchapps/apphelper";
import type { PersonInterface } from "@churchapps/helpers";
import { Alert, Box, Button, Card, Collapse, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { PictureAsPdf as PdfIcon } from "@mui/icons-material";
import { PageBreadcrumbs } from "../../components/ui";
import { PersonAdd } from "../../components/PersonAdd";
import { parseApiError } from "../../helpers/OrdinationHelper";
import type { PersonOrdinationInterface } from "../../people/components/PersonOrdinationInterface";
import { useLicenseTemplates } from "../../hooks/useLicenseTemplates";
import { useOrdinationTypes } from "../../hooks/useOrdinationTypes";
import type { LicenseTemplateInterface, LicenseTemplateLayout } from "../LicenseTemplateInterface";
import { renderCard } from "../render/licenseRenderApi";
import { DEFAULT_CALIBRATION } from "../render/calibrationStorage";

// True when a template row's layoutJson declares a letter (certificate) format.
const isLetterTemplate = (row: LicenseTemplateInterface): boolean => {
  if (!row.layoutJson) return false;
  try {
    const layout = JSON.parse(row.layoutJson) as LicenseTemplateLayout;
    return (layout.canvas.format ?? "card").startsWith("letter");
  } catch {
    return false;
  }
};

export const CertificatesPage: React.FC = () => {
  const templates = useLicenseTemplates();
  const ordinationTypes = useOrdinationTypes();
  const typeMap = React.useMemo(() => Object.fromEntries(ordinationTypes.map((t) => [t.id, t.name])), [ordinationTypes]);

  const [person, setPerson] = React.useState<PersonInterface | null>(null);
  const [ordinations, setOrdinations] = React.useState<PersonOrdinationInterface[]>([]);
  const [ordinationId, setOrdinationId] = React.useState<string>("");
  const [templateId, setTemplateId] = React.useState<string>("");

  const [error, setError] = React.useState<string | null>(null);
  const [generating, setGenerating] = React.useState<boolean>(false);
  const [pdfUrl, setPdfUrl] = React.useState<string>("");

  // Only letter-format templates can print an 8.5x11 certificate.
  const letterTemplates = React.useMemo(() => templates.filter(isLetterTemplate), [templates]);

  // Revoke the previous object URL whenever it changes / on unmount (no blob leak).
  React.useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  const resetPdf = () => {
    setPdfUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return ""; });
  };

  const handlePickPerson = async (picked: PersonInterface) => {
    setError(null);
    resetPdf();
    setPerson(picked);
    setOrdinations([]);
    setOrdinationId("");
    try {
      const ords = await ApiHelper.get("/personOrdinations?personId=" + picked.id, "MembershipApi");
      const list: PersonOrdinationInterface[] = Array.isArray(ords) ? ords : [];
      setOrdinations(list);
      const preferred = list.find((o) => o.status === "active") || list[0];
      if (preferred?.id) setOrdinationId(preferred.id);
      if (list.length === 0) setError("That person has no ordination on record.");
    } catch (e: any) {
      setError(e?.message || "Could not load that person's ordinations.");
    }
  };

  const ordinationLabel = (o: PersonOrdinationInterface): string => {
    const typeName = o.ordinationTypeId ? typeMap[o.ordinationTypeId] || "Ordination" : "Ordination";
    const cred = o.credentialNumber ? " · " + o.credentialNumber : "";
    const status = o.status ? " (" + o.status + ")" : "";
    return typeName + cred + status;
  };

  const handleGenerate = async () => {
    if (!ordinationId || !templateId) return;
    setGenerating(true);
    setError(null);
    resetPdf();
    try {
      // Reuse the EXISTING card render endpoint verbatim; certificates need no per-printer
      // calibration, so pass zeros. NO /confirm — certificates write no card-audit row.
      const result = await renderCard({ personOrdinationId: ordinationId, templateId, calibration: DEFAULT_CALIBRATION });
      setPdfUrl(result.url);
    } catch (e: any) {
      const code = parseApiError(e);
      if (code === "unauthorized") setError("You don't have access to print this certificate (campus scope).");
      else if (code === "not_found") setError("That ordination or template is out of scope, or no longer exists.");
      else setError(e?.message || "Certificate generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => { if (pdfUrl) window.open(pdfUrl, "_blank", "noopener,noreferrer"); };

  return (
    <>
      <PageBreadcrumbs items={[{ label: "Ordinations", path: "/ordinations" }, { label: "Ordination Certificates" }]} />
      <PageHeader title="Ordination Certificates" subtitle="Pick a person and ordination, choose a certificate template, and print an 8.5×11 certificate." />

      <Box sx={{ p: 3 }}>
        <Collapse in={!!error}>
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>
        </Collapse>

        <Card sx={{ borderRadius: 2, border: "1px solid", borderColor: "grey.200", p: 3, mb: 3 }}>
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>1. Person</Typography>
              {person ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2">{[person.name?.first, person.name?.last].filter(Boolean).join(" ") || "(selected)"}</Typography>
                  <Button size="small" onClick={() => { setPerson(null); setOrdinations([]); setOrdinationId(""); resetPdf(); }}>Change</Button>
                </Stack>
              ) : (
                <Box sx={{ maxWidth: 420 }}>
                  <PersonAdd getPhotoUrl={PersonHelper.getPhotoUrl} addFunction={handlePickPerson} actionLabel="Select" />
                </Box>
              )}
            </Box>

            {person && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>2. Ordination</Typography>
                <TextField
                  select
                  size="small"
                  fullWidth
                  sx={{ maxWidth: 420 }}
                  value={ordinationId}
                  onChange={(e) => { setOrdinationId(e.target.value); resetPdf(); }}
                  disabled={ordinations.length === 0}>
                  {ordinations.map((o) => (
                    <MenuItem key={o.id} value={o.id}>{ordinationLabel(o)}</MenuItem>
                  ))}
                </TextField>
              </Box>
            )}

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>3. Certificate template</Typography>
              <TextField
                select
                size="small"
                fullWidth
                sx={{ maxWidth: 420 }}
                value={templateId}
                onChange={(e) => { setTemplateId(e.target.value); resetPdf(); }}
                SelectProps={{ displayEmpty: true }}
                helperText={letterTemplates.length === 0 ? "No certificate (8.5×11) templates yet — create one in License Templates." : undefined}>
                <MenuItem value="" disabled>Select a certificate template…</MenuItem>
                {letterTemplates.map((t) => (
                  <MenuItem key={t.id} value={t.id}>{t.name || "(untitled)"}</MenuItem>
                ))}
              </TextField>
            </Box>

            <Box>
              <Button variant="contained" startIcon={<PdfIcon />} disabled={!ordinationId || !templateId || generating} onClick={handleGenerate}>
                {generating ? "Generating…" : "Generate Certificate"}
              </Button>
            </Box>
          </Stack>
        </Card>

        {pdfUrl && (
          <Card sx={{ borderRadius: 2, border: "1px solid", borderColor: "grey.200", p: 2 }}>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <Button variant="outlined" size="small" component="a" href={pdfUrl} download="certificate.pdf">Download</Button>
              <Button variant="outlined" size="small" onClick={handlePrint}>Print</Button>
            </Stack>
            <Box sx={{ width: "100%", height: "70vh", border: "1px solid", borderColor: "grey.300" }}>
              <iframe title="Certificate preview" src={pdfUrl} style={{ width: "100%", height: "100%", border: "none" }} />
            </Box>
          </Card>
        )}
      </Box>
    </>
  );
};

export default CertificatesPage;
