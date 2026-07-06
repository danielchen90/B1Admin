import React from "react";
import { PageHeader } from "@churchapps/apphelper";
import {
  Alert, Box, Button, Card, CircularProgress, Collapse, Divider,
  IconButton, InputAdornment, Stack, TextField, Typography
} from "@mui/material";
import {
  KeyboardArrowUp as UpIcon, KeyboardArrowDown as DownIcon,
  Print as PrintIcon, RestartAlt as ResetIcon, Save as SaveIcon, Straighten as RulerIcon
} from "@mui/icons-material";
import { DEFAULT_CALIBRATION, getCalibration, setCalibration, type Calibration } from "../calibrationStorage";
import { renderTestCard, type TestCardResult } from "../licenseRenderApi";
import { PageBreadcrumbs } from "../../../components/ui";

// PrintCalibrationPage — the per-WORKSTATION print-calibration screen (PRT-05).
//
// LOCKED behaviors:
//  - THE PROOF IS THE PDF: the iframe shows the exact bytes /testCard returned for the
//    CURRENT calibration, rendered through the SAME server pipeline as real cards — so
//    what the operator measures on the printed alignment card is what real cards do.
//  - Per-WORKSTATION, NOT per-template: the correction is a property of THIS device's
//    printer + card-feed offset, so it persists to localStorage (calibrationStorage) and
//    is baked into every /render + /testCard call from this browser (06-05 reads it).
//  - PRECISE + TYPEABLE + REPEATABLE adjustment: numeric mm inputs for X/Y offset and
//    scale, PLUS fixed-step arrow nudge (0.1mm for offsets) so an operator can dial in an
//    exact correction read off the card's ruler ticks / crosshair.

// Fixed nudge steps (locked): offsets step by a physical 0.1mm; scale by a fine 0.005.
const OFFSET_STEP = 0.1;
const SCALE_STEP = 0.005;
const RENDER_DEBOUNCE_MS = 400;

// Round to kill floating-point drift from repeated ±0.1 / ±0.005 nudges (e.g. 0.30000004).
const round3 = (n: number): number => Math.round(n * 1000) / 1000;

const sameCalibration = (a: Calibration, b: Calibration): boolean =>
  a.offsetXmm === b.offsetXmm && a.offsetYmm === b.offsetYmm && a.scale === b.scale;

export const PrintCalibrationPage: React.FC = () => {
  // Seed from this workstation's persisted calibration (default {0,0,1} when uncalibrated).
  const [calibration, setCalibrationState] = React.useState<Calibration>(() => getCalibration());
  // The last value persisted to localStorage — drives the "unsaved changes" state.
  const [saved, setSaved] = React.useState<Calibration>(calibration);

  const [result, setResult] = React.useState<TestCardResult | null>(null);
  const [rendering, setRendering] = React.useState(false);
  const [renderError, setRenderError] = React.useState<string | null>(null);
  const [justSaved, setJustSaved] = React.useState(false);

  // Holds the CURRENT object URL so we revoke the previous one on each re-render + unmount
  // (object URLs leak until revoked). Mirrors PrintLicenseDialog's urlRef discipline.
  const urlRef = React.useRef<string | null>(null);
  React.useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  // Re-render the alignment card whenever the calibration changes — DEBOUNCED so a burst
  // of nudges / keystrokes issues a single render, not one per change.
  React.useEffect(() => {
    let active = true;
    setRendering(true);
    setRenderError(null);
    const handle = setTimeout(() => {
      renderTestCard(calibration)
        .then((r) => {
          if (!active) { URL.revokeObjectURL(r.url); return; }
          if (urlRef.current) URL.revokeObjectURL(urlRef.current);
          urlRef.current = r.url;
          setResult(r);
        })
        .catch((e) => {
          if (!active) return;
          setResult(null);
          setRenderError(e?.message || "Failed to render the calibration test card.");
        })
        .finally(() => { if (active) setRendering(false); });
    }, RENDER_DEBOUNCE_MS);
    return () => { active = false; clearTimeout(handle); };
  }, [calibration]);

  const patch = (p: Partial<Calibration>) => {
    setJustSaved(false);
    setCalibrationState((c) => ({ ...c, ...p }));
  };

  // Numeric-field change: accept an in-progress empty string as 0 so the field stays
  // editable, otherwise take the parsed number (ignore non-finite input).
  const onNumber = (key: keyof Calibration) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === "" || raw === "-") { patch({ [key]: 0 } as Partial<Calibration>); return; }
    const n = Number(raw);
    if (Number.isFinite(n)) patch({ [key]: round3(n) } as Partial<Calibration>);
  };

  const nudge = (key: keyof Calibration, delta: number) => () =>
    patch({ [key]: round3((calibration[key] as number) + delta) } as Partial<Calibration>);

  const handleSave = () => {
    setCalibration(calibration);
    setSaved(calibration);
    setJustSaved(true);
  };

  // Reset restores the default {0,0,1} AND persists it so a mis-calibrated station can be
  // returned to neutral in one action.
  const handleReset = () => {
    const def = { ...DEFAULT_CALIBRATION };
    setCalibration(def);
    setCalibrationState(def);
    setSaved(def);
    setJustSaved(true);
  };

  // Open the exact bytes so the browser's PDF viewer drives the OS print dialog — this is
  // the card the operator physically prints, measures, and reads the offset from.
  const handlePrint = () => {
    if (!result) return;
    const w = window.open(result.url, "_blank");
    w?.focus();
  };

  const dirty = !sameCalibration(calibration, saved);

  // A labelled mm offset control: numeric field + up/down 0.1mm nudge buttons.
  const offsetControl = (label: string, key: "offsetXmm" | "offsetYmm") => (
    <Stack direction="row" spacing={1} alignItems="center">
      <TextField
        label={label}
        type="number"
        size="small"
        value={calibration[key]}
        onChange={onNumber(key)}
        inputProps={{ step: OFFSET_STEP }}
        InputProps={{ endAdornment: <InputAdornment position="end">mm</InputAdornment> }}
        sx={{ width: 160 }}
        data-testid={`calibration-${key}-input`}
      />
      <Stack>
        <IconButton size="small" onClick={nudge(key, OFFSET_STEP)} aria-label={`${label} +0.1mm`} data-testid={`calibration-${key}-up`}>
          <UpIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={nudge(key, -OFFSET_STEP)} aria-label={`${label} -0.1mm`} data-testid={`calibration-${key}-down`}>
          <DownIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Stack>
  );

  return (
    <>
      <PageBreadcrumbs items={[{ label: "Settings", path: "/settings" }, { label: "License Templates", path: "/settings/license-templates" }, { label: "Print Calibration" }]} />
      <PageHeader title="Print Calibration" subtitle="Align this workstation's CR80 card printer." />
      <Box sx={{ p: 3 }}>
        <Stack spacing={3} direction={{ xs: "column", md: "row" }} alignItems="flex-start">
          {/* Controls */}
          <Card sx={{ p: 2.5, borderRadius: 2, border: "1px solid", borderColor: "grey.200", width: { xs: "100%", md: 360 }, flexShrink: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <RulerIcon sx={{ color: "primary.main", fontSize: 20 }} />
              <Typography variant="h6">Alignment</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Print the test card, measure how far the crosshair and corner marks land from
              the true card edges, then nudge the offsets by 0.1mm until they line up.
            </Typography>

            <Stack spacing={2}>
              {offsetControl("X offset", "offsetXmm")}
              {offsetControl("Y offset", "offsetYmm")}

              <Divider flexItem />

              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  label="Scale"
                  type="number"
                  size="small"
                  value={calibration.scale}
                  onChange={onNumber("scale")}
                  inputProps={{ step: SCALE_STEP, min: 0.5 }}
                  sx={{ width: 160 }}
                  data-testid="calibration-scale-input"
                />
                <Stack>
                  <IconButton size="small" onClick={nudge("scale", SCALE_STEP)} aria-label="Scale up" data-testid="calibration-scale-up">
                    <UpIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={nudge("scale", -SCALE_STEP)} aria-label="Scale down" data-testid="calibration-scale-down">
                    <DownIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>

              <Divider flexItem />

              <Stack direction="row" spacing={1}>
                <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={!dirty} data-testid="calibration-save">
                  Save
                </Button>
                <Button variant="outlined" startIcon={<ResetIcon />} onClick={handleReset} data-testid="calibration-reset">
                  Reset
                </Button>
              </Stack>

              <Collapse in={justSaved && !dirty}>
                <Alert severity="success" onClose={() => setJustSaved(false)}>
                  Calibration saved for this workstation.
                </Alert>
              </Collapse>
              <Collapse in={dirty}>
                <Alert severity="info">Unsaved changes — click Save to keep them on this workstation.</Alert>
              </Collapse>

              <Typography variant="caption" color="text.secondary">
                This correction applies to ALL license cards printed from this workstation /
                browser only. It is not shared with other machines or admins.
              </Typography>
            </Stack>
          </Card>

          {/* Proof — the exact PDF bytes that will print at the current calibration. */}
          <Card sx={{ p: 2, borderRadius: 2, border: "1px solid", borderColor: "grey.200", flexGrow: 1, width: "100%" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography variant="h6">Test card</Typography>
              <Button variant="outlined" size="small" startIcon={<PrintIcon />} onClick={handlePrint} disabled={!result || rendering} data-testid="calibration-print">
                Print test card
              </Button>
            </Stack>

            {renderError && <Alert severity="error" sx={{ mb: 1.5 }}>{renderError}</Alert>}

            <Box sx={{ position: "relative", width: "100%", height: 460, border: "1px solid", borderColor: "grey.300", borderRadius: 1, overflow: "hidden", backgroundColor: "grey.100" }}>
              {rendering && (
                <Stack alignItems="center" justifyContent="center" sx={{ position: "absolute", inset: 0, zIndex: 1 }}>
                  <CircularProgress size={28} />
                </Stack>
              )}
              {result && (
                <iframe
                  title="Calibration test card"
                  src={result.url}
                  style={{ width: "100%", height: "100%", border: "none" }}
                  data-testid="calibration-proof-iframe"
                />
              )}
            </Box>
          </Card>
        </Stack>
      </Box>
    </>
  );
};

export default PrintCalibrationPage;
