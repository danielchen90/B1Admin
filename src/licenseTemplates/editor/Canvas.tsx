// Canvas.tsx — the CR80 bleed-box wrapper (RESEARCH Pattern 2: presentational/controlled).
//
// The card wrapper is sized in NATIVE CSS mm so it matches Chromium's @page mm units
// in the Phase 6 renderer (fewer conversion seams). A single CSS `transform: scale(zoom)`
// zooms the whole card; the same `zoom` is fed to each CanvasElement's <Rnd scale> so
// drag/resize deltas stay correct (RESEARCH Pitfall 2). mm is authoritative everywhere;
// px is derived only inside CanvasElement via the single PX_PER_MM bridge.
//
// Origin (0,0) = TOP-LEFT of the bleed box. The named background slot fills 0,0 →
// widthMm,heightMm (to bleed, NOT respecting the safe area). Guides are non-interactive
// overlays drawn ABOVE elements: a trim line (the card edge, inset by bleed), a dashed
// safe-area rectangle (inset by bleed+safe), and a center crosshair. There is NO bleed
// guide line (locked decision: bleed exists in the model, not as a drawn guide).
//
// Canvas is intentionally dumb: ALL state lives in the editor (05-05), which injects the
// CanvasElement list as `children`.

import React from "react";
import { Box } from "@mui/material";
import { CommonEnvironmentHelper } from "@churchapps/apphelper";
import type { LicenseTemplateLayout } from "../LicenseTemplateInterface";

// Resolve a FileStorage key to a displayable URL: data-URLs and absolute URLs pass
// through; a stored key is prefixed with the content root (the same resolution
// PersonHelper.getPhotoUrl uses).
export const resolveSrc = (src: string): string => {
  if (!src) return "";
  if (src.startsWith("data:") || src.indexOf("://") > -1) return src;
  return CommonEnvironmentHelper.ContentRoot + src;
};

interface Props {
  layout: LicenseTemplateLayout;
  zoom: number;
  selectedId: string | null;
  previewData: Record<string, string>;
  onSelect: (id: string | null) => void;
  children?: React.ReactNode;
}

export const Canvas: React.FC<Props> = ({ layout, zoom, onSelect, children }) => {
  const { widthMm, heightMm, bleedMm, safeMm } = layout.canvas;
  const bg = layout.background;

  const cardStyle: React.CSSProperties = {
    transform: `scale(${zoom})`,
    transformOrigin: "top left",
    width: `${widthMm}mm`,
    height: `${heightMm}mm`,
    position: "relative",
    background: "#fff",
    boxShadow: "0 1px 6px rgba(0,0,0,0.3)"
  };

  // Guide insets expressed in the wrapper's own mm space.
  const trimInset = `${bleedMm}mm`; // trim line = card edge
  const safeInset = `${bleedMm + safeMm}mm`; // safe-area inset from trim

  return (
    <Box sx={{ overflow: "auto", p: 2, display: "flex", justifyContent: "center" }}>
      {/* A spacer sized to the SCALED card so the scroll container fits the zoom. */}
      <div style={{ width: `calc(${widthMm}mm * ${zoom})`, height: `calc(${heightMm}mm * ${zoom})` }}>
        <div
          style={cardStyle}
          onMouseDown={(e) => {
            // Click on empty canvas (not a child) clears the selection.
            if (e.target === e.currentTarget) onSelect(null);
          }}
        >
          {/* Background slot — BEHIND everything, fills 0,0 → widthMm,heightMm (to bleed).
              Wrapped in a card-sized clip so a scale>1 zoom crops to the card edge,
              exactly as the server's overflow:hidden .card does (preview == PDF). */}
          {bg?.src && (
            <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
              <img
                src={resolveSrc(bg.src)}
                alt=""
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: `${widthMm}mm`,
                  height: `${heightMm}mm`,
                  objectFit: bg.fit,
                  transform: `scale(${bg.scale ?? 1})`,
                  transformOrigin: "center"
                }}
              />
            </div>
          )}

          {/* Elements injected by the editor (05-05) — between background and guides. */}
          {children}

          {/* Guide overlay — ABOVE elements, never interactive. */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {/* Trim line: the CR80 card edge, inset by bleed on all sides. */}
            <div
              style={{
                position: "absolute",
                left: trimInset,
                top: trimInset,
                right: trimInset,
                bottom: trimInset,
                border: "1px solid rgba(0,0,0,0.45)"
              }}
            />
            {/* Safe-area: dashed rectangle inset by bleed + safe. */}
            <div
              style={{
                position: "absolute",
                left: safeInset,
                top: safeInset,
                right: safeInset,
                bottom: safeInset,
                border: "1px dashed rgba(25,118,210,0.7)"
              }}
            />
            {/* Center crosshair: a vertical + horizontal hairline through the center. */}
            <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, borderLeft: "1px solid rgba(229,57,53,0.4)" }} />
            <div style={{ position: "absolute", top: "50%", left: 0, right: 0, borderTop: "1px solid rgba(229,57,53,0.4)" }} />
          </div>
        </div>
      </div>
    </Box>
  );
};
