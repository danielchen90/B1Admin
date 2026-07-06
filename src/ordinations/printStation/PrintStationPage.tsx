import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@churchapps/apphelper";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogContentText, DialogTitle, Divider, FormControl,
  Grid, IconButton, InputLabel, LinearProgress, MenuItem, Select, Stack,
  TextField, Tooltip, Typography
} from "@mui/material";
import {
  Autorenew as RegenerateIcon, Download as DownloadIcon, History as HistoryIcon,
  Print as PrintIcon, Replay as ReprintIcon, Block as VoidIcon,
  Warning as WarningIcon, PictureAsPdf as PdfIcon
} from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import * as pdfjs from "pdfjs-dist";
// Vite resolves this to the worker asset URL (vite/client declares the `*?url` module).
import PdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import * as printBatchApi from "./printBatchApi";
import { type BatchCard, type SkippedPerson } from "./printBatchApi";
import { BatchSelectionPanel } from "./BatchSelectionPanel";
import { canWriteOrdinations, parseApiError } from "../../helpers/OrdinationHelper";

// The pdfjs worker must be pointed at a real URL before getDocument() runs, else it falls
// back to a fake in-thread worker (slow / warns). Set once at module load.
pdfjs.GlobalWorkerOptions.workerSrc = PdfWorkerUrl;

// PrintStationPage — the LOCKED single-active-batch print view (PRT-02 + PRT-04). A normal
// gated B1Admin route under the Ordination hub (NOT a standalone kiosk app). When a
// :batchId is present it focuses that ONE batch: polled render progress, a per-card
// THUMBNAILS GRID pre-print preview (one rasterized card per BatchCard, each with a status
// chip + person/credential/campus label), a "N skipped: reason" panel, a Download/Print
// that opens the OS print dialog and bulk-marks the batch printed with a confirm-to-void
// prompt, and per-card reprint/void. With no :batchId it shows the recent-batches picker +
// the BatchSelectionPanel "build a batch" entry — both paths resolve to the SAME persisted
// batch.

// The preset void reasons (attributable + audited). "Other" reveals a free-text field.
const VOID_REASONS = ["Printer jam", "Misprint/alignment", "Wrong data", "Damaged", "Other"] as const;

// Poll cadence while a batch is still rendering; stop polling once ready | failed.
const RENDER_POLL_MS = 1500;
// If renderedCount hasn't advanced for this long while still "rendering", offer Regenerate
// (Pitfall 2 — a render worker can die and leave the batch stuck part-way).
const STALE_RENDER_MS = 30000;
// Thumbnail rasterization scale — small enough for a grid, sharp enough to eyeball a photo.
const THUMB_SCALE = 0.5;

type ChipColor = "default" | "info" | "success" | "warning" | "error";

const STATUS_CHIP: Record<string, { label: string; color: ChipColor }> = {
  draft: { label: "Draft", color: "default" },
  queued: { label: "Queued", color: "info" },
  printed: { label: "Printed", color: "success" },
  reissued: { label: "Reissued", color: "warning" },
  void: { label: "Void", color: "error" }
};

const statusChip = (status: string) => {
  const c = STATUS_CHIP[status] || { label: status, color: "default" as ChipColor };
  return <Chip size="small" color={c.color} label={c.label} />;
};

const parseSkipped = (skippedJson?: string): SkippedPerson[] => {
  if (!skippedJson) return [];
  try {
    const parsed = JSON.parse(skippedJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const PrintStationPage: React.FC = () => {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const canWrite = canWriteOrdinations();

  // --- Poll the batch (progress bar + status machine) -----------------------------------
  const batchQuery = useQuery<printBatchApi.PrintBatch>({
    queryKey: ["/printBatches/" + batchId, "MembershipApi"],
    queryFn: () => printBatchApi.getBatch(batchId as string),
    enabled: !!batchId,
    refetchInterval: (q) => (q.state.data?.status === "rendering" || q.state.data?.status === "building" ? RENDER_POLL_MS : false)
  });
  const batch = batchQuery.data;
  const isRendering = batch?.status === "rendering" || batch?.status === "building";
  const isReady = batch?.status === "ready";
  const isFailed = batch?.status === "failed";

  // --- Per-card list — THE source of every cardId (07-04 /:id/cards) ---------------------
  const cardsQuery = useQuery<BatchCard[]>({
    queryKey: ["/printBatches/" + batchId + "/cards", "MembershipApi"],
    queryFn: () => printBatchApi.listBatchCards(batchId as string),
    enabled: !!batchId && !isRendering
  });
  const cards = cardsQuery.data;

  // --- Recent-batches picker (kiosk "load a prior batch") -------------------------------
  const recentQuery = useQuery<printBatchApi.PrintBatch[]>({
    queryKey: ["/printBatches", "MembershipApi"],
    queryFn: () => printBatchApi.listRecentBatches()
  });

  // --- Stale-render detection -----------------------------------------------------------
  const [isStale, setIsStale] = React.useState(false);
  const staleRef = React.useRef<{ count: number; at: number }>({ count: -1, at: Date.now() });
  React.useEffect(() => {
    if (!isRendering || !batch) { setIsStale(false); return; }
    const rendered = batch.renderedCount ?? 0;
    if (rendered !== staleRef.current.count) {
      staleRef.current = { count: rendered, at: Date.now() };
      setIsStale(false);
      return;
    }
    const handle = setTimeout(() => setIsStale(true), STALE_RENDER_MS);
    return () => clearTimeout(handle);
  }, [isRendering, batch]);

  // --- Assembled PDF (object URL for iframe + OS print) + rasterized thumbnails ----------
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);
  const [thumbnails, setThumbnails] = React.useState<string[]>([]);
  const [thumbError, setThumbError] = React.useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = React.useState(false);
  const pdfUrlRef = React.useRef<string | null>(null);
  // Guard against re-downloading + re-rasterizing on every render — only redo when the
  // batch identity or ready-state changes.
  const rasterKeyRef = React.useRef<string>("");

  React.useEffect(() => {
    if (!batchId || !isReady) return;
    const key = batchId + ":ready";
    if (rasterKeyRef.current === key) return;
    rasterKeyRef.current = key;
    let active = true;
    setLoadingPdf(true);
    setThumbError(null);
    (async () => {
      try {
        const { blob, url } = await printBatchApi.downloadBatchPdf(batchId);
        if (!active) { URL.revokeObjectURL(url); return; }
        if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
        pdfUrlRef.current = url;
        setPdfUrl(url);
        // Rasterize each page (one page == one card, in listBatchCards order) to a thumbnail.
        // NOTE: destroy() lives on the loading TASK, not the resolved PDFDocumentProxy
        // (pdfjs v6) — keep the task ref so we can release the worker after rasterizing.
        const loadingTask = pdfjs.getDocument({ data: await blob.arrayBuffer() });
        const doc = await loadingTask.promise;
        const imgs: string[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          if (!active) break;
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: THUMB_SCALE });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
          imgs.push(canvas.toDataURL("image/png"));
        }
        await loadingTask.destroy();
        if (active) setThumbnails(imgs);
      } catch (e) {
        if (active) setThumbError(e instanceof Error ? e.message : "Unable to render the card previews.");
      } finally {
        if (active) setLoadingPdf(false);
      }
    })();
    return () => { active = false; };
  }, [batchId, isReady]);

  // Revoke the assembled-PDF object URL on unmount.
  React.useEffect(() => () => { if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current); }, []);

  // --- Download / Print → OS dialog → bulk mark printed → confirm-to-void ---------------
  const [confirmPrintOpen, setConfirmPrintOpen] = React.useState(false);
  const [marking, setMarking] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const handleDownloadPrint = async () => {
    if (!batchId || !pdfUrl) return;
    setActionError(null);
    // Open the exact bytes so the browser/OS print dialog drives the Badgy (LOCKED — no
    // direct-to-printer driver). This also serves as the download.
    const w = window.open(pdfUrl, "_blank");
    w?.focus();
    // ONE bulk mark-printed (NOT a ~150-card loop — the 07-04 bulk endpoint).
    setMarking(true);
    try {
      await printBatchApi.markBatchPrinted(batchId);
      await cardsQuery.refetch();
      setConfirmPrintOpen(true);
    } catch (e) {
      const code = parseApiError(e);
      setActionError(code || (e instanceof Error ? e.message : "Unable to mark the batch printed."));
    } finally {
      setMarking(false);
    }
  };

  // --- Per-card reprint -----------------------------------------------------------------
  const [busyCardId, setBusyCardId] = React.useState<string | null>(null);

  const handleReprint = async (card: BatchCard) => {
    setActionError(null);
    setBusyCardId(card.cardId);
    try {
      const { url } = await printBatchApi.reprintCard(card.cardId);
      const w = window.open(url, "_blank");
      w?.focus();
      // Revoke shortly after so the new tab has grabbed the bytes.
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      await cardsQuery.refetch();
    } catch (e) {
      const code = parseApiError(e);
      setActionError(code || (e instanceof Error ? e.message : "Unable to reprint the card."));
    } finally {
      setBusyCardId(null);
    }
  };

  // --- Per-card void (reason required) --------------------------------------------------
  const [voidCardTarget, setVoidCardTarget] = React.useState<BatchCard | null>(null);
  const [voidPreset, setVoidPreset] = React.useState<string>(VOID_REASONS[0]);
  const [voidOther, setVoidOther] = React.useState("");
  const [voiding, setVoiding] = React.useState(false);

  const openVoid = (card: BatchCard) => {
    setVoidCardTarget(card);
    setVoidPreset(VOID_REASONS[0]);
    setVoidOther("");
    setActionError(null);
  };

  const submitVoid = async () => {
    if (!voidCardTarget) return;
    const reason = voidPreset === "Other" ? voidOther.trim() : voidPreset;
    if (!reason) { setActionError("A void reason is required."); return; }
    setVoiding(true);
    try {
      await printBatchApi.voidCard(voidCardTarget.cardId, reason);
      await cardsQuery.refetch();
      setVoidCardTarget(null);
    } catch (e) {
      const code = parseApiError(e);
      // reason_required is the server's 422 code; surface it plainly.
      setActionError(code === "reason_required" ? "A void reason is required." : code || (e instanceof Error ? e.message : "Unable to void the card."));
    } finally {
      setVoiding(false);
    }
  };

  // --- Regenerate (stuck/stale render, or reload a historical batch's PDF) --------------
  const [regenerating, setRegenerating] = React.useState(false);
  const handleRegenerate = async () => {
    if (!batchId) return;
    setActionError(null);
    setRegenerating(true);
    try {
      await printBatchApi.regenerateBatch(batchId);
      rasterKeyRef.current = ""; // force re-download + re-rasterize once ready again
      setThumbnails([]);
      setPdfUrl(null);
      await batchQuery.refetch();
    } catch (e) {
      const code = parseApiError(e);
      setActionError(code || (e instanceof Error ? e.message : "Unable to regenerate the batch."));
    } finally {
      setRegenerating(false);
    }
  };

  const recentPicker = (
    <FormControl size="small" sx={{ minWidth: 240 }}>
      <InputLabel id="recent-batches-label">Load a recent batch</InputLabel>
      <Select
        labelId="recent-batches-label"
        label="Load a recent batch"
        value={batchId || ""}
        startAdornment={<HistoryIcon sx={{ mr: 1, color: "text.secondary" }} fontSize="small" />}
        onChange={(e) => { if (e.target.value) navigate("/ordinations/print-station/" + e.target.value); }}
      >
        {(recentQuery.data || []).map((b) => (
          <MenuItem key={b.id} value={b.id}>
            {(b.name || "Batch " + b.id.slice(0, 6))} — {b.cardCount} card{b.cardCount === 1 ? "" : "s"} ({b.status})
          </MenuItem>
        ))}
        {(recentQuery.data || []).length === 0 && <MenuItem disabled value="">No recent batches</MenuItem>}
      </Select>
    </FormControl>
  );

  // --- No batch selected: the "build or load a batch" entry -----------------------------
  if (!batchId) {
    return (
      <>
        <Box sx={{ px: 3, pt: 3 }}>
          <Stack direction="row" justifyContent="flex-end">{recentPicker}</Stack>
        </Box>
        <BatchSelectionPanel />
      </>
    );
  }

  const skipped = parseSkipped(batch?.skippedJson);
  const progressPct = batch && batch.cardCount > 0 ? Math.round((batch.renderedCount / batch.cardCount) * 100) : 0;

  return (
    <>
      <PageHeader title={batch?.name || "Print Station"} subtitle="Review the cards, print the batch, and correct any jams." />

      <Box sx={{ p: 3 }}>
        <Stack spacing={3}>
          {/* Top controls: recent picker + primary Download/Print action */}
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ md: "center" }}>
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
              {recentPicker}
              <Button variant="text" onClick={() => navigate("/ordinations/print-station")} startIcon={<PrintIcon />}>
                Build a new batch
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              {canWrite && (
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<DownloadIcon />}
                  disabled={!isReady || !pdfUrl || marking || loadingPdf}
                  onClick={handleDownloadPrint}
                >
                  {marking ? "Marking…" : "Download / Print"}
                </Button>
              )}
              {canWrite && isReady && (
                <Tooltip title="Rebuild the assembled PDF from the stored per-card snapshots (byte-identical).">
                  <span>
                    <Button variant="outlined" startIcon={<RegenerateIcon />} disabled={regenerating} onClick={handleRegenerate}>
                      {regenerating ? "Regenerating…" : "Regenerate"}
                    </Button>
                  </span>
                </Tooltip>
              )}
            </Stack>
          </Stack>

          {actionError && <Alert severity="error" onClose={() => setActionError(null)}>{actionError}</Alert>}

          {/* Progress / status */}
          <Card sx={{ p: 2.5 }}>
            {batchQuery.isLoading && <Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={20} /><Typography>Loading batch…</Typography></Stack>}
            {isRendering && batch && (
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6">Rendering {batch.renderedCount}/{batch.cardCount}…</Typography>
                  <Chip size="small" color="info" label={progressPct + "%"} />
                </Stack>
                <LinearProgress variant="determinate" value={progressPct} />
                {isStale && (
                  <Alert
                    severity="warning"
                    icon={<WarningIcon />}
                    action={canWrite ? <Button color="inherit" size="small" onClick={handleRegenerate} disabled={regenerating}>Regenerate</Button> : undefined}
                  >
                    Rendering appears stuck — no progress for a while. You can regenerate the batch.
                  </Alert>
                )}
              </Stack>
            )}
            {isReady && batch && (
              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="h6">Ready — {batch.cardCount} card{batch.cardCount === 1 ? "" : "s"}</Typography>
                {loadingPdf && <Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={18} /><Typography variant="body2">Building previews…</Typography></Stack>}
              </Stack>
            )}
            {isFailed && <Alert severity="error">This batch failed to render.{skipped.length > 0 ? "" : " Try regenerating it."}{canWrite && <Button size="small" sx={{ ml: 1 }} onClick={handleRegenerate} disabled={regenerating}>Regenerate</Button>}</Alert>}
          </Card>

          {/* "N skipped: reason" panel */}
          {skipped.length > 0 && (
            <Alert severity="warning" icon={<WarningIcon />}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{skipped.length} skipped</Typography>
              <Stack component="ul" sx={{ m: 0, pl: 2 }} spacing={0.25}>
                {skipped.map((s, i) => (
                  <li key={s.personId + i}><Typography variant="body2">{s.personId}: {s.reason}</Typography></li>
                ))}
              </Stack>
            </Alert>
          )}

          {thumbError && <Alert severity="error">{thumbError}</Alert>}

          {/* Per-card THUMBNAILS GRID pre-print preview */}
          {isReady && (
            <Box>
              <Typography variant="h6" sx={{ mb: 1.5 }}>Card preview ({cards?.length ?? 0})</Typography>
              {cardsQuery.isLoading && <Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={18} /><Typography>Loading cards…</Typography></Stack>}
              <Grid container spacing={2}>
                {(cards || []).map((card, i) => (
                  <Grid key={card.cardId} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                    <Card sx={{ p: 1.5, height: "100%", display: "flex", flexDirection: "column" }}>
                      <Box sx={{ position: "relative", mb: 1, borderRadius: 1, overflow: "hidden", border: "1px solid", borderColor: "grey.200", backgroundColor: "grey.100", minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {thumbnails[i] ? (
                          <img src={thumbnails[i]} alt={"Card for " + card.personName} style={{ width: "100%", display: "block" }} />
                        ) : (
                          <Stack alignItems="center" justifyContent="center" sx={{ py: 3 }}>
                            {loadingPdf ? <CircularProgress size={22} /> : <PdfIcon color="disabled" />}
                          </Stack>
                        )}
                        <Box sx={{ position: "absolute", top: 4, right: 4 }}>{statusChip(card.status)}</Box>
                      </Box>
                      <Typography variant="subtitle2" noWrap>{card.personName}</Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {[card.credentialType, card.credentialNumber].filter(Boolean).join(" · ")}
                      </Typography>
                      {card.campusName && <Typography variant="caption" color="text.secondary" noWrap>{card.campusName}</Typography>}
                      {card.status === "void" && card.voidReason && (
                        <Typography variant="caption" color="error" noWrap>Void: {card.voidReason}</Typography>
                      )}
                      {canWrite && (
                        <>
                          <Divider sx={{ my: 1 }} />
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="Reprint this card (reissued)">
                              <span>
                                <IconButton size="small" disabled={busyCardId === card.cardId} onClick={() => handleReprint(card)}>
                                  {busyCardId === card.cardId ? <CircularProgress size={16} /> : <ReprintIcon fontSize="small" />}
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Void this card (reason required)">
                              <span>
                                <IconButton size="small" color="error" disabled={card.status === "void"} onClick={() => openVoid(card)}>
                                  <VoidIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Stack>
                        </>
                      )}
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {/* Optional full-PDF view IN ADDITION to the grid */}
          {isReady && pdfUrl && (
            <Card sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 1.5 }}>Full assembled PDF</Typography>
              <Box sx={{ width: "100%", height: 500, border: "1px solid", borderColor: "grey.300", borderRadius: 1, overflow: "hidden" }}>
                <iframe title="Assembled batch PDF" src={pdfUrl} style={{ width: "100%", height: "100%", border: "none" }} />
              </Box>
            </Card>
          )}
        </Stack>
      </Box>

      {/* "Did they print OK?" confirm → void jams */}
      <Dialog open={confirmPrintOpen} onClose={() => setConfirmPrintOpen(false)}>
        <DialogTitle>Did they print OK?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            All cards were marked printed. If any card jammed or misprinted, choose "Some jammed" and
            void the bad ones from the grid — the credential itself is never touched.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmPrintOpen(false)}>Some jammed</Button>
          <Button variant="contained" onClick={() => setConfirmPrintOpen(false)}>Yes, all good</Button>
        </DialogActions>
      </Dialog>

      {/* Per-card void dialog (preset reasons + free text for Other) */}
      <Dialog open={!!voidCardTarget} onClose={() => (voiding ? null : setVoidCardTarget(null))} fullWidth maxWidth="xs">
        <DialogTitle>Void card{voidCardTarget ? " — " + voidCardTarget.personName : ""}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Voiding marks this card as spoiled for audit. It does NOT revoke the minister's credential.
          </DialogContentText>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel id="void-reason-label">Reason</InputLabel>
            <Select labelId="void-reason-label" label="Reason" value={voidPreset} onChange={(e) => setVoidPreset(e.target.value)}>
              {VOID_REASONS.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </Select>
          </FormControl>
          {voidPreset === "Other" && (
            <TextField
              fullWidth size="small" label="Describe the reason" value={voidOther}
              onChange={(e) => setVoidOther(e.target.value)} multiline minRows={2} autoFocus
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVoidCardTarget(null)} disabled={voiding}>Cancel</Button>
          <Button color="error" variant="contained" onClick={submitVoid} disabled={voiding || (voidPreset === "Other" && !voidOther.trim())}>
            {voiding ? "Voiding…" : "Void card"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PrintStationPage;
