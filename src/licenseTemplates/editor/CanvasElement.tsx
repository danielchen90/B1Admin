// CanvasElement.tsx — the draggable/resizable element renderer (RESEARCH Pattern 1).
//
// One <Rnd> per element. CRITICAL: `scale={zoom}` matches the Canvas card's
// `transform: scale(zoom)`, so drag/resize pixel deltas are corrected at non-100% zoom
// (avoids the classic "drag drifts under zoom" bug — RESEARCH Pitfall 2; do NOT hand-roll).
//
// mm is authoritative. px is derived ONLY for react-rnd's position/size via the single
// PX_PER_MM bridge (mmToPx), and dragged/resized px are converted straight back to mm
// (pxToMm) into stored state — never round-tripped mm→px→mm beyond these conversions.
// Explicit z-order comes from el.z. bounds="parent" is a SOFT bound (the card only):
// the safe-area is a non-blocking guide, NOT a placement bound (locked decision).

import React from "react";
import { Rnd } from "react-rnd";
import { CommonEnvironmentHelper } from "@churchapps/apphelper";
import type { LayoutElement, ElementBase, TextStyle } from "../LicenseTemplateInterface";
import { mmToPx, pxToMm, ptToPx } from "../helpers/coords";
import { resolveBinding } from "../helpers/bindings";
import { fontCss } from "../helpers/fonts";

// FileStorage key -> URL (data-URLs / absolute URLs pass through). Mirrors Canvas.resolveSrc.
const resolveSrc = (src: string): string => {
  if (!src) return "";
  if (src.startsWith("data:") || src.indexOf("://") > -1) return src;
  return CommonEnvironmentHelper.ContentRoot + src;
};

// TextStyle -> CSS. Font size is pt in the JSON; ptToPx is PREVIEW-only.
const textCss = (font: TextStyle): React.CSSProperties => ({
  fontFamily: fontCss(font.family),
  fontSize: ptToPx(font.sizePt),
  fontWeight: font.weight,
  // Never fake a weight the family lacks — a 700 request on a regular-only face
  // (e.g. Pinyon Script) falls back to the real regular glyphs, matching the server PDF.
  fontSynthesis: "none",
  color: font.color,
  textAlign: font.align,
  lineHeight: font.lineHeight ?? 1.2,
  width: "100%",
  height: "100%",
  overflow: "hidden",
  whiteSpace: "pre-wrap"
});

const placeholderCss = (color: string): React.CSSProperties => ({
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: `1px dashed ${color}`,
  color,
  fontSize: 11,
  boxSizing: "border-box"
});

const renderByType = (el: LayoutElement, previewData: Record<string, string>): React.ReactNode => {
  switch (el.type) {
    case "boundText": {
      const resolved = resolveBinding(el.binding, previewData, el.dateFormat) || el.fallback || `[${el.binding}]`;
      const text = `${el.prefix ?? ""}${resolved}${el.suffix ?? ""}`;
      return <div style={textCss(el.font)}>{text}</div>;
    }
    case "staticText":
      return <div style={textCss(el.font)}>{el.text}</div>;
    case "image":
      return el.src ? (
        <img src={resolveSrc(el.src)} alt="" style={{ width: "100%", height: "100%", objectFit: el.fit, display: "block" }} />
      ) : (
        <div style={placeholderCss("#999")}>Add image</div>
      );
    case "photo": {
      const radius = el.shape === "circle" ? "50%" : el.shape === "rounded" ? 8 : 0;
      // The person's stored picture. Phase 6 applies the saved crop transform; the editor
      // previews the source picture (real-person preview only — sample mode shows the box).
      const photoUrl = previewData["person.photoUrl"];
      return photoUrl ? (
        <img
          src={resolveSrc(photoUrl)}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: el.fit, display: "block", borderRadius: radius }}
        />
      ) : (
        <div style={{ ...placeholderCss("#1976d2"), borderRadius: radius }}>Person Picture</div>
      );
    }
  }
};

interface Props {
  el: LayoutElement;
  zoom: number;
  selected: boolean;
  previewData: Record<string, string>;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Partial<ElementBase>) => void;
}

export const CanvasElement: React.FC<Props> = ({ el, zoom, selected, previewData, onSelect, onChange }) => {
  return (
    <Rnd
      scale={zoom}
      position={{ x: mmToPx(el.xMm), y: mmToPx(el.yMm) }}
      size={{ width: mmToPx(el.wMm), height: mmToPx(el.hMm) }}
      bounds="parent"
      style={{ zIndex: el.z, outline: selected ? "2px solid #1976d2" : "none", boxSizing: "border-box" }}
      onMouseDown={() => onSelect(el.id)}
      onDragStop={(_e, d) => onChange(el.id, { xMm: pxToMm(d.x), yMm: pxToMm(d.y) })}
      onResizeStop={(_e, _dir, ref, _delta, pos) =>
        onChange(el.id, {
          wMm: pxToMm(ref.offsetWidth),
          hMm: pxToMm(ref.offsetHeight),
          xMm: pxToMm(pos.x),
          yMm: pxToMm(pos.y)
        })
      }
    >
      {renderByType(el, previewData)}
    </Rnd>
  );
};
