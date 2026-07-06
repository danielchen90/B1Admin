// coords.ts — THE single source of truth for the unit bridge (RESEARCH Pattern 1/2).
//
// mm (geometry) and pt (font size) are the only print-authoritative units and the
// only units stored in the layout JSON. px is DERIVED here, in the editor, through
// exactly one constant so typed-in-mm values and dragged-in-px values cannot drift.

import type { LicenseTemplateLayout } from "../LicenseTemplateInterface";

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

// Full canvas size (trim + bleed on every edge), origin = bleed-box top-left.
export const canvasSize = (bleedMm: number) => ({
  widthMm: CR80.trimWidthMm + 2 * bleedMm,
  heightMm: CR80.trimHeightMm + 2 * bleedMm
});

// Factory: a brand-new template opens with valid geometry (schemaVersion 1,
// canvas derived from the default bleed/safe, no background, no elements).
export const newLayout = (): LicenseTemplateLayout => {
  const { widthMm, heightMm } = canvasSize(DEFAULT_BLEED_MM);
  return {
    schemaVersion: 1,
    canvas: {
      trimWidthMm: CR80.trimWidthMm,
      trimHeightMm: CR80.trimHeightMm,
      bleedMm: DEFAULT_BLEED_MM,
      safeMm: DEFAULT_SAFE_MM,
      widthMm,
      heightMm
    },
    elements: []
  };
};
