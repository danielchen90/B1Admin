// coords.ts — THE single source of truth for the unit bridge (RESEARCH Pattern 1/2).
//
// mm (geometry) and pt (font size) are the only print-authoritative units and the
// only units stored in the layout JSON. px is DERIVED here, in the editor, through
// exactly one constant so typed-in-mm values and dragged-in-px values cannot drift.

import type { LicenseTemplateLayout, TemplateFormat } from "../LicenseTemplateInterface";

// CSS reference pixel: 96px per inch, 25.4mm per inch.
export const PX_PER_MM = 96 / 25.4; // 3.779527559…

export const mmToPx = (mm: number) => mm * PX_PER_MM;
export const pxToMm = (px: number) => px / PX_PER_MM;

// pt → px for PREVIEW ONLY (72pt per inch, 96px per inch). The JSON stores pt.
export const ptToPx = (pt: number) => (pt * 96) / 72;

// CR80 trim geometry (PROJECT.md). Authoritative card dimensions.
export const CR80 = { trimWidthMm: 85.6, trimHeightMm: 53.98 } as const;

// Calibration defaults — NOT assumed correct; bleed is a per-printer calibration.
export const DEFAULT_BLEED_MM = 2;
export const DEFAULT_SAFE_MM = 3;

// Per-format trim geometry + bleed/safe seeds. Cards keep the CR80 bleed/safe
// calibration; Letter certificates are single-sheet (NO bleed/trim registration —
// a printer prints the full page), so bleed=0 + a generous 10mm safe margin.
// US Letter = 8.5x11in = 215.9x279.4mm.
export const FORMATS: Record<
  TemplateFormat,
  { trimWidthMm: number; trimHeightMm: number; bleedMm: number; safeMm: number }
> = {
  card: { trimWidthMm: CR80.trimWidthMm, trimHeightMm: CR80.trimHeightMm, bleedMm: DEFAULT_BLEED_MM, safeMm: DEFAULT_SAFE_MM },
  "letter-portrait": { trimWidthMm: 215.9, trimHeightMm: 279.4, bleedMm: 0, safeMm: 10 },
  "letter-landscape": { trimWidthMm: 279.4, trimHeightMm: 215.9, bleedMm: 0, safeMm: 10 }
};

// Full canvas size (trim + bleed on every edge), origin = bleed-box top-left.
// Now trim-aware so Letter's larger mm numbers flow through the SAME math.
export const canvasSize = (trimWidthMm: number, trimHeightMm: number, bleedMm: number) => ({
  widthMm: trimWidthMm + 2 * bleedMm,
  heightMm: trimHeightMm + 2 * bleedMm
});

// Factory: a brand-new template opens with valid geometry (schemaVersion 1,
// canvas derived from the chosen FORMAT's trim/bleed/safe, no background, no
// elements). Default "card" so the existing new-template experience is unchanged.
export const newLayout = (format: TemplateFormat = "card"): LicenseTemplateLayout => {
  const f = FORMATS[format];
  const { widthMm, heightMm } = canvasSize(f.trimWidthMm, f.trimHeightMm, f.bleedMm);
  return {
    schemaVersion: 1,
    canvas: {
      trimWidthMm: f.trimWidthMm,
      trimHeightMm: f.trimHeightMm,
      format,
      bleedMm: f.bleedMm,
      safeMm: f.safeMm,
      widthMm,
      heightMm
    },
    elements: []
  };
};
