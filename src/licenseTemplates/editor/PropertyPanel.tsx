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
import Resizer from "react-image-file-resizer";
import { Box, Button, Divider, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { HexColorPicker } from "react-colorful";
import { ImageEditor } from "@churchapps/apphelper";
import type { LayoutElement, TextStyle } from "../LicenseTemplateInterface";
import { FONT_WHITELIST } from "../helpers/fonts";
import { BINDING_CATALOG } from "../helpers/bindings";
import { resolveSrc } from "./Canvas";

interface Props {
  el: LayoutElement | null;
  onChange: (id: string, patch: Record<string, any>) => void;
  onBackgroundChange: (src: string | undefined, fit: "cover" | "contain") => void;
  background?: { src: string; fit: "cover" | "contain" };
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

export const PropertyPanel: React.FC<Props> = ({ el, onChange, onBackgroundChange, background, canvas }) => {
  // Which ImageEditor (if any) is open: the selected image element, or the bg slot.
  const [editing, setEditing] = useState<null | "image" | "background">(null);

  const num = (v: string) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
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
          <TextField select label="Fit" size="small" value={background.fit} onChange={(e) => onBackgroundChange(background.src, e.target.value as "cover" | "contain")}>
            <MenuItem value="cover">Cover</MenuItem>
            <MenuItem value="contain">Contain</MenuItem>
          </TextField>
          <Button variant="text" color="error" size="small" onClick={() => onBackgroundChange(undefined, "cover")}>Remove background</Button>
        </>
      )}
    </>
  );

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
                  <TextField label="Date format (dayjs)" size="small" fullWidth value={el.dateFormat ?? "MMM D, YYYY"} onChange={(e) => onChange(el.id, { dateFormat: e.target.value })} />
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
                <Button variant="outlined" size="small" onClick={() => setEditing("image")}>{el.src ? "Change image" : "Add image"}</Button>
                <TextField select label="Fit" size="small" value={el.fit} onChange={(e) => onChange(el.id, { fit: e.target.value })}>
                  <MenuItem value="contain">Contain</MenuItem>
                  <MenuItem value="cover">Cover</MenuItem>
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

      {/* Logo upload — free-ish aspect locked to the placed box; capped to 600px. */}
      {editing === "image" && el?.type === "image" && (
        <ImageEditor
          photoUrl={resolveSrc(el.src)}
          aspectRatio={el.hMm > 0 ? el.wMm / el.hMm : 1}
          onUpdate={async (dataUrl) => {
            if (dataUrl) onChange(el.id, { src: await capPixels(dataUrl, "logo.png", 600) });
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      {/* Background upload — locked to the bleed-box aspect; target ≈ 1013×638px. */}
      {editing === "background" && (
        <ImageEditor
          photoUrl={background?.src ? resolveSrc(background.src) : ""}
          aspectRatio={canvas.heightMm > 0 ? canvas.widthMm / canvas.heightMm : 1.54}
          outputWidth={1013}
          outputHeight={638}
          onUpdate={async (dataUrl) => {
            if (dataUrl) onBackgroundChange(await capPixels(dataUrl, "background.png", 1013), background?.fit ?? "cover");
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      )}
    </Box>
  );
};
