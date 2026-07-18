// PropertyPanel.tsx — precise mm geometry + text styling + image/background upload
// (RESEARCH §Property Panel). The panel is fully CONTROLLED: it reads the selected
// element (or the named background slot when nothing is selected) and writes every
// edit back through onChange / onBackgroundChange — it NEVER mutates layout directly.
//
// Geometry is the precise-placement counterpart to dragging on the canvas: typed mm
// values write into the exact same authoritative mm state. Text styling is constrained
// to the curated whitelist + bundled weights (400/700) so editor preview and the
// Phase 6 render resolve identical metrics. Logo + background images are uploaded via
// apphelper's ImageEditor (mirrors AppearanceEdit) and capped in pixel size with
// react-image-file-resizer before the data URL is handed up — the controller (05-02)
// stores it to FileStorage and swaps in a key ref on save.

import React, { useState } from "react";
import ResizerModule from "react-image-file-resizer";
// Vite/esbuild CJS interop quirk: this package ships as { __esModule, default: { imageFileResizer } },
// so the default import can resolve to the outer object. Unwrap defensively to the layer that
// actually carries imageFileResizer (works whether Vite hands back the inner or outer object).
const Resizer: any = (ResizerModule as any)?.imageFileResizer ? ResizerModule : (ResizerModule as any)?.default;
import { Box, Button, Divider, MenuItem, Slider, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { HexColorPicker } from "react-colorful";
import { ImageEditor } from "@churchapps/apphelper";
import type { LayoutElement, TextStyle } from "../LicenseTemplateInterface";
import { FONT_WHITELIST } from "../helpers/fonts";
import { BINDING_CATALOG } from "../helpers/bindings";
import { resolveSrc } from "./Canvas";

interface Props {
  el: LayoutElement | null;
  onChange: (id: string, patch: Record<string, any>) => void;
  onBackgroundChange: (src: string | undefined, fit: "cover" | "contain", scale?: number) => void;
  background?: { src: string; fit: "cover" | "contain"; scale?: number };
  canvas: { widthMm: number; heightMm: number };
}

// data-URL -> File (mirrors AppearanceEdit) so react-image-file-resizer can cap it.
async function dataUrlToFile(dataUrl: string, fileName: string): Promise<File> {
  const [header, base64 = ""] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);base64/)?.[1] ?? "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], fileName, { type: mime });
}

// Cap the longest edge to maxEdge (aspect preserved) — keeps embedded data URLs small
// before they travel to the controller, which writes the single stored FileStorage ref.
async function capPixels(dataUrl: string, fileName: string, maxEdge: number): Promise<string> {
  const file = await dataUrlToFile(dataUrl, fileName);
  return new Promise<string>((resolve, reject) => {
    try {
      Resizer.imageFileResizer(file, maxEdge, maxEdge, "PNG", 100, 0, (uri) => resolve(String(uri)), "base64");
    } catch (err) {
      reject(err);
    }
  });
}

// Cap a raw File's longest edge (aspect preserved, NO crop) → base64 data URL. Unlike
// the ImageEditor cropper — which forces a fixed 400×300 output and would distort a
// non-4:3 picture — this keeps the WHOLE image, so a template can hold a full,
// uncropped image; the element's `fit` (contain/cover) then decides how it sits.
async function capImageFile(file: File, maxEdge: number): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    try {
      Resizer.imageFileResizer(file, maxEdge, maxEdge, "PNG", 100, 0, (uri: string) => resolve(String(uri)), "base64");
    } catch (err) {
      reject(err);
    }
  });
}

// Natural width/height ratio of a data-URL image (null if it can't be read).
function imageAspect(dataUrl: string): Promise<number | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : null);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

export const PropertyPanel: React.FC<Props> = ({ el, onChange, onBackgroundChange, background, canvas }) => {
  // Whether the background ImageEditor (crop-to-bleed) is open. Image ELEMENTS no longer
  // use the cropper — they take a full, uncropped image via a direct file upload.
  const [editing, setEditing] = useState<null | "background">(null);

  const num = (v: string) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  // Add/replace an image element's picture with a FULL, uncropped image, then fit the
  // element box to the image's aspect so `contain` shows all of it with no letterbox.
  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>, target: LayoutElement) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    const src = await capImageFile(file, 600);
    const patch: Record<string, any> = { src };
    const aspect = await imageAspect(src);
    if (aspect && target.wMm > 0) patch.hMm = Math.round((target.wMm / aspect) * 10) / 10;
    onChange(target.id, patch);
  };

  // ----- shared geometry block (every element has ElementBase mm fields) -------------
  const geometry = (e: LayoutElement) => (
    <>
      <Typography variant="subtitle2" sx={{ mt: 1 }}>Position &amp; size (mm)</Typography>
      <Stack direction="row" spacing={1}>
        <TextField label="X" size="small" type="number" inputProps={{ step: 0.1 }} value={e.xMm} onChange={(ev) => onChange(e.id, { xMm: num(ev.target.value) })} />
        <TextField label="Y" size="small" type="number" inputProps={{ step: 0.1 }} value={e.yMm} onChange={(ev) => onChange(e.id, { yMm: num(ev.target.value) })} />
      </Stack>
      <Stack direction="row" spacing={1}>
        <TextField label="W" size="small" type="number" inputProps={{ step: 0.1 }} value={e.wMm} onChange={(ev) => onChange(e.id, { wMm: num(ev.target.value) })} />
        <TextField label="H" size="small" type="number" inputProps={{ step: 0.1 }} value={e.hMm} onChange={(ev) => onChange(e.id, { hMm: num(ev.target.value) })} />
      </Stack>
    </>
  );

  // ----- shared text-style block (boundText + staticText) ----------------------------
  const textStyle = (id: string, font: TextStyle) => {
    const set = (patch: Partial<TextStyle>) => onChange(id, { font: { ...font, ...patch } });
    return (
      <>
        <Typography variant="subtitle2" sx={{ mt: 1 }}>Text style</Typography>
        <TextField select label="Font" size="small" fullWidth value={font.family} onChange={(e) => set({ family: e.target.value })}>
          {FONT_WHITELIST.map((f) => (
            <MenuItem key={f.key} value={f.key}>{f.label}</MenuItem>
          ))}
        </TextField>
        <Stack direction="row" spacing={1}>
          <TextField label="Size (pt)" size="small" type="number" inputProps={{ step: 0.5, min: 1 }} value={font.sizePt} onChange={(e) => set({ sizePt: num(e.target.value) })} />
          <TextField select label="Weight" size="small" sx={{ minWidth: 110 }} value={font.weight} onChange={(e) => set({ weight: Number(e.target.value) === 700 ? 700 : 400 })}>
            <MenuItem value={400}>Regular</MenuItem>
            <MenuItem value={700}>Bold</MenuItem>
          </TextField>
        </Stack>
        <ToggleButtonGroup size="small" exclusive value={font.align} onChange={(_e, v) => v && set({ align: v })}>
          <ToggleButton value="left">Left</ToggleButton>
          <ToggleButton value="center">Center</ToggleButton>
          <ToggleButton value="right">Right</ToggleButton>
        </ToggleButtonGroup>
        <Box>
          <Typography variant="caption">Color</Typography>
          <HexColorPicker color={font.color} onChange={(color) => set({ color })} style={{ width: "100%", height: 120 }} />
          <TextField size="small" fullWidth value={font.color} onChange={(e) => set({ color: e.target.value })} sx={{ mt: 1 }} />
        </Box>
      </>
    );
  };

  // ----- background controls (shown when nothing is selected) -------------------------
  const backgroundControls = () => (
    <>
      <Typography variant="subtitle1">Background</Typography>
      <Typography variant="caption" color="text.secondary">Fills the full card to bleed (no safe-area constraint).</Typography>
      <Button variant="outlined" size="small" onClick={() => setEditing("background")}>{background?.src ? "Change background" : "Add background"}</Button>
      {background?.src && (
        <>
          <TextField select label="Fit" size="small" value={background.fit} onChange={(e) => onBackgroundChange(background.src, e.target.value as "cover" | "contain", background.scale)}>
            <MenuItem value="cover">Cover</MenuItem>
            <MenuItem value="contain">Contain</MenuItem>
          </TextField>
          <Box>
            <Typography variant="caption">Zoom ({Math.round((background.scale ?? 1) * 100)}%)</Typography>
            <Slider
              size="small"
              min={0.25}
              max={3}
              step={0.05}
              value={background.scale ?? 1}
              valueLabelDisplay="auto"
              valueLabelFormat={(v) => `${Math.round(v * 100)}%`}
              marks={[{ value: 1, label: "100%" }]}
              onChange={(_e, v) => onBackgroundChange(background.src, background.fit, Array.isArray(v) ? v[0] : v)}
            />
          </Box>
          <Button variant="text" color="error" size="small" onClick={() => onBackgroundChange(undefined, "cover")}>Remove background</Button>
        </>
      )}
    </>
  );

  // Background capture resolution — FORMAT-AWARE. The old fixed 1013×638 was dimensioned
  // for a CR80 card (~300 DPI over ~89.6×57.98mm) and CRUSHED a Letter certificate
  // background to ~638px on its long edge. Instead derive the crop output from the actual
  // canvas at 300 DPI: a CR80 stays ~1058×685, a Letter portrait becomes ~2550×3300
  // (a true 8.5×11 at 300 DPI). Well within the API's 50mb body limit.
  const PX_PER_MM_300DPI = 300 / 25.4; // 11.811 px/mm
  const bgAspect = canvas.heightMm > 0 ? canvas.widthMm / canvas.heightMm : 1.54;
  const bgOutW = Math.max(1, Math.round(canvas.widthMm * PX_PER_MM_300DPI));
  const bgOutH = Math.max(1, Math.round(canvas.heightMm * PX_PER_MM_300DPI));
  const bgMaxEdge = Math.max(bgOutW, bgOutH);

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        {!el && backgroundControls()}

        {el && (
          <>
            <Typography variant="subtitle1" sx={{ textTransform: "capitalize" }}>{el.type} properties</Typography>
            {geometry(el)}

            {el.type === "boundText" && (
              <>
                <Divider />
                <TextField label="Binding" size="small" fullWidth value={el.binding} InputProps={{ readOnly: true }} />
                <Stack direction="row" spacing={1}>
                  <TextField label="Prefix" size="small" value={el.prefix ?? ""} onChange={(e) => onChange(el.id, { prefix: e.target.value })} />
                  <TextField label="Suffix" size="small" value={el.suffix ?? ""} onChange={(e) => onChange(el.id, { suffix: e.target.value })} />
                </Stack>
                <TextField label="Fallback" size="small" fullWidth value={el.fallback ?? ""} onChange={(e) => onChange(el.id, { fallback: e.target.value })} />
                {BINDING_CATALOG.find((b) => b.key === el.binding)?.isDate && (
                  <>
                    {/* "[FORMAL]" is a reserved sentinel (bindings.ts) that both the editor
                        preview and the server PDF render via the shared formatFormalDate. */}
                    <TextField
                      select
                      label="Date style"
                      size="small"
                      fullWidth
                      value={el.dateFormat === "[FORMAL]" ? "[FORMAL]" : "custom"}
                      onChange={(e) =>
                        onChange(el.id, { dateFormat: e.target.value === "[FORMAL]" ? "[FORMAL]" : "MMM D, YYYY" })
                      }>
                      <MenuItem value="custom">Custom (dayjs pattern)</MenuItem>
                      <MenuItem value="[FORMAL]">Formal English (January 15th, 2024)</MenuItem>
                    </TextField>
                    {el.dateFormat !== "[FORMAL]" && (
                      <TextField label="Date format (dayjs)" size="small" fullWidth value={el.dateFormat ?? "MMM D, YYYY"} onChange={(e) => onChange(el.id, { dateFormat: e.target.value })} />
                    )}
                  </>
                )}
                {textStyle(el.id, el.font)}
              </>
            )}

            {el.type === "staticText" && (
              <>
                <Divider />
                <TextField label="Text" size="small" fullWidth multiline value={el.text} onChange={(e) => onChange(el.id, { text: e.target.value })} />
                {textStyle(el.id, el.font)}
              </>
            )}

            {el.type === "image" && (
              <>
                <Divider />
                <Button variant="outlined" size="small" component="label">
                  {el.src ? "Change image" : "Add image"}
                  <input type="file" accept="image/*" hidden onChange={(e) => handleImageFile(e, el)} />
                </Button>
                <Typography variant="caption" color="text.secondary">Full image, uncropped. Fit controls how it sits in its box.</Typography>
                <TextField select label="Fit" size="small" value={el.fit} onChange={(e) => onChange(el.id, { fit: e.target.value })}>
                  <MenuItem value="contain">Contain (whole image)</MenuItem>
                  <MenuItem value="cover">Cover (fill &amp; crop)</MenuItem>
                </TextField>
              </>
            )}

            {el.type === "photo" && (
              <>
                <Divider />
                <TextField select label="Fit" size="small" value={el.fit} onChange={(e) => onChange(el.id, { fit: e.target.value })}>
                  <MenuItem value="cover">Cover</MenuItem>
                  <MenuItem value="contain">Contain</MenuItem>
                </TextField>
                <TextField select label="Shape" size="small" value={el.shape ?? "rect"} onChange={(e) => onChange(el.id, { shape: e.target.value })}>
                  <MenuItem value="rect">Rectangle</MenuItem>
                  <MenuItem value="rounded">Rounded</MenuItem>
                  <MenuItem value="circle">Circle</MenuItem>
                </TextField>
              </>
            )}
          </>
        )}
      </Stack>

      {/* Background upload — locked to the bleed-box aspect; capture res is format-aware
          (bgOutW×bgOutH ≈ the canvas at 300 DPI) so Letter certificates stay sharp. */}
      {editing === "background" && (
        <ImageEditor
          photoUrl={background?.src ? resolveSrc(background.src) : ""}
          aspectRatio={bgAspect}
          outputWidth={bgOutW}
          outputHeight={bgOutH}
          onUpdate={async (dataUrl) => {
            if (dataUrl) onBackgroundChange(await capPixels(dataUrl, "background.png", bgMaxEdge), background?.fit ?? "cover", background?.scale);
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      )}
    </Box>
  );
};
