// TemplateEditor.tsx — the editing surface orchestrator (RESEARCH §Editor Shell).
//
// This is the SINGLE SOURCE OF TRUTH for the in-memory LicenseTemplateLayout. The
// Canvas + CanvasElement (05-04) are dumb/controlled and receive layout + zoom + the
// mutation callbacks defined here. mm geometry + pt font size are authoritative; px is
// only ever derived inside CanvasElement via the one PX_PER_MM bridge.
//
// Add paths (TPL-01):
//   - PRIMARY: pick a binding from the BindingList → drops a pre-configured boundText.
//   - SEPARATE toolbar controls add static text, a logo image, a photo placeholder, and
//     open the (named) background slot for upload.
// The PropertyPanel edits exact mm geometry + text styling + image/background upload.
// The LayersPanel reorders explicit z-order (background stays at the back — it is a
// NAMED slot, not a reorderable element).
//
// Save/load-by-id wiring to the API is DEFERRED to 05-06; this component opens a brand
// new template (newLayout()) or an optional initialLayout, fully usable in-memory with
// sample-data preview.

import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Slider, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { PageHeader, UniqueIdHelper } from "@churchapps/apphelper";
import type { LayoutElement, LicenseTemplateLayout } from "../LicenseTemplateInterface";
import { newLayout } from "../helpers/coords";
import { BINDING_CATALOG, SAMPLE_BINDINGS } from "../helpers/bindings";
import { loadEditorFonts } from "../helpers/fonts";
import { Canvas } from "./Canvas";
import { CanvasElement } from "./CanvasElement";
import { PropertyPanel } from "./PropertyPanel";
import { BindingList } from "./BindingList";
import { LayersPanel } from "./LayersPanel";

interface Props {
  initialLayout?: LicenseTemplateLayout; // 05-06 supplies a loaded template; default = new
}

// Default text styling for newly-added text elements (whitelist key + bundled weight).
const DEFAULT_TEXT_STYLE = { family: "sans", sizePt: 10, weight: 400 as const, color: "#000000", align: "left" as const };

export const TemplateEditor: React.FC<Props> = ({ initialLayout }) => {
  const [layout, setLayout] = useState<LicenseTemplateLayout>(() => initialLayout ?? newLayout());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(3); // fit-to-screen default (manual zoom, no snapping)
  const [previewData] = useState<Record<string, string>>(SAMPLE_BINDINGS); // real-person preview lands in 05-06
  const [previewMode, setPreviewMode] = useState<"sample">("sample");

  // Load the curated families once so preview metrics match the Phase 6 render.
  useEffect(() => { loadEditorFonts(); }, []);

  // ----- element mutation helpers (passed to children) -------------------------------
  const addElement = (partial: Omit<LayoutElement, "id" | "z">) => {
    const id = UniqueIdHelper.shortId();
    setLayout((prev) => {
      const z = prev.elements.reduce((m, e) => Math.max(m, e.z), 0) + 1;
      return { ...prev, elements: [...prev.elements, { ...partial, id, z } as LayoutElement] };
    });
    setSelectedId(id);
  };

  const updateElement = (id: string, patch: Record<string, any>) =>
    setLayout((prev) => ({
      ...prev,
      elements: prev.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as LayoutElement) : e)),
    }));

  const removeElement = (id: string) => {
    setLayout((prev) => ({ ...prev, elements: prev.elements.filter((e) => e.id !== id) }));
    setSelectedId((cur) => (cur === id ? null : cur));
  };

  const selectElement = (id: string | null) => setSelectedId(id);

  const setBackground = (src: string | undefined, fit: "cover" | "contain") =>
    setLayout((prev) => ({ ...prev, background: src ? { src, fit } : undefined }));

  // z-order ops for the LayersPanel. reorder rewrites each element's z to its index in
  // the supplied back→front ordering; bringToFront bumps one element above the rest.
  const reorder = (orderedIds: string[]) =>
    setLayout((prev) => ({ ...prev, elements: prev.elements.map((e) => ({ ...e, z: orderedIds.indexOf(e.id) })) }));

  const bringToFront = (id: string) =>
    setLayout((prev) => {
      const maxZ = prev.elements.reduce((m, e) => Math.max(m, e.z), 0);
      return { ...prev, elements: prev.elements.map((e) => (e.id === id ? { ...e, z: maxZ + 1 } : e)) };
    });

  // ----- toolbar add controls (distinct from the binding list) -----------------------
  const addStaticText = () =>
    addElement({ type: "staticText", text: "Text", xMm: 10, yMm: 10, wMm: 30, hMm: 8, font: { ...DEFAULT_TEXT_STYLE } });

  const addLogo = () => addElement({ type: "image", src: "", fit: "contain", xMm: 10, yMm: 10, wMm: 25, hMm: 15 });

  const addPhoto = () =>
    addElement({ type: "photo", fit: "cover", shape: "rounded", xMm: 10, yMm: 10, wMm: 20, hMm: 26 });

  // Clearing the selection surfaces the background controls in the PropertyPanel.
  const editBackground = () => setSelectedId(null);

  const addBinding = (binding: string) => {
    const def = BINDING_CATALOG.find((b) => b.key === binding);
    addElement({
      type: "boundText",
      binding,
      xMm: 10,
      yMm: 10,
      wMm: 30,
      hMm: 8,
      font: { ...DEFAULT_TEXT_STYLE },
      ...(def?.isDate ? { dateFormat: "MMM D, YYYY" } : {}),
    });
  };

  const selectedEl = useMemo(() => layout.elements.find((e) => e.id === selectedId) ?? null, [layout.elements, selectedId]);
  const sortedElements = useMemo(() => [...layout.elements].sort((a, b) => a.z - b.z), [layout.elements]);

  return (
    <>
      <PageHeader title="License Template Editor" subtitle="Design a CR80 ministerial-license card: bound fields, logo, background, photo, and fonts." />

      {/* Toolbar: add controls, zoom, preview mode. */}
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
        <Button size="small" variant="outlined" onClick={addStaticText}>Add static text</Button>
        <Button size="small" variant="outlined" onClick={addLogo}>Add logo</Button>
        <Button size="small" variant="outlined" onClick={editBackground}>Background</Button>
        <Button size="small" variant="outlined" onClick={addPhoto}>Add photo placeholder</Button>
        <Button size="small" color="error" variant="outlined" disabled={!selectedId} onClick={() => selectedId && removeElement(selectedId)}>Delete selected</Button>

        <Box sx={{ flexGrow: 1 }} />

        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 220 }}>
          <Typography variant="caption">Zoom</Typography>
          <Slider size="small" min={1} max={8} step={0.5} value={zoom} onChange={(_e, v) => setZoom(v as number)} sx={{ width: 140 }} />
          <Typography variant="caption">{zoom.toFixed(1)}×</Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary">{layout.canvas.widthMm.toFixed(1)} × {layout.canvas.heightMm.toFixed(1)} mm</Typography>

        <ToggleButtonGroup size="small" exclusive value={previewMode} onChange={(_e, v) => v && setPreviewMode(v)}>
          <ToggleButton value="sample">Sample data</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/* Three-pane body: binding list + layers | canvas | property panel. */}
      <Box sx={{ display: "flex", alignItems: "stretch", height: "calc(100vh - 200px)" }}>
        <Box sx={{ width: 250, flexShrink: 0, overflow: "auto", borderRight: "1px solid", borderColor: "divider" }}>
          <BindingList onAdd={addBinding} />
          <LayersPanel elements={layout.elements} selectedId={selectedId} onSelect={selectElement} onReorder={reorder} onBringToFront={bringToFront} />
        </Box>

        <Box sx={{ flexGrow: 1, overflow: "auto", backgroundColor: "grey.100" }}>
          <Canvas layout={layout} zoom={zoom} selectedId={selectedId} previewData={previewData} onSelect={selectElement}>
            {sortedElements.map((el) => (
              <CanvasElement key={el.id} el={el} zoom={zoom} selected={el.id === selectedId} previewData={previewData} onSelect={selectElement} onChange={updateElement} />
            ))}
          </Canvas>
        </Box>

        <Box sx={{ width: 320, flexShrink: 0, overflow: "auto", borderLeft: "1px solid", borderColor: "divider" }}>
          <PropertyPanel
            el={selectedEl}
            onChange={updateElement}
            onBackgroundChange={setBackground}
            background={layout.background}
            canvas={{ widthMm: layout.canvas.widthMm, heightMm: layout.canvas.heightMm }}
          />
        </Box>
      </Box>
    </>
  );
};

export default TemplateEditor;
