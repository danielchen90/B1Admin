// KEEP IN SYNC WITH PHASE 6 RENDERER — this is the declarative layout contract.
//
// LicenseTemplateLayout is the EXACT object Phase 6's headless-Chromium renderer
// consumes. It is intentionally framework-free (plain data, no React/MUI imports)
// so the editor (Phase 5) and the renderer (Phase 6) share it verbatim.
//
// Print-authoritative units ONLY:
//   - geometry is millimetres (mm)
//   - font size is points (pt)
//   - there is NO px anywhere in this JSON (px is screen-/DPI-coupled and is
//     derived in the editor only, via the single PX_PER_MM bridge in coords.ts).
// Origin (0,0) = TOP-LEFT of the FULL BLEED box; every coordinate is positive,
// so the background fills 0,0 → widthMm,heightMm (edge-to-edge / to bleed) and
// Phase 6 renders with no negative coordinates.

// Page format the template is authored at. Absent => "card" (every pre-existing
// row stays a CR80 card). "letter-portrait"/"letter-landscape" are US-Letter
// certificates (8.5x11). Stored INSIDE layoutJson (which flows verbatim through
// save/load/render), so NO DB column is needed — see coords.ts FORMATS.
export type TemplateFormat = "card" | "letter-portrait" | "letter-landscape";

export interface LicenseTemplateLayout {
  schemaVersion: 1; // bump ONLY on a breaking schema change (guards Phase 6)
  canvas: {
    // format-driven trim (mm). card = CR80 85.6x53.98; letter = 215.9x279.4.
    // Widened from the literal CR80 types to `number` so Letter fits.
    trimWidthMm: number; // CR80 trim = 85.6 (PROJECT.md); Letter = 215.9/279.4
    trimHeightMm: number; // CR80 trim = 53.98; Letter = 279.4/215.9
    format?: TemplateFormat; // absent => "card" (back-compat)
    bleedMm: number; // default 2 — a calibration value, NOT assumed correct
    safeMm: number; // safe-area inset from trim, default 3
    // Derived from trim + bleed, but stored for renderer clarity:
    widthMm: number; // trimWidthMm + 2*bleedMm (full canvas)
    heightMm: number; // trimHeightMm + 2*bleedMm
  };
  // Named background slot (NOT an element) — fills 0,0 → widthMm,heightMm to bleed.
  // Structural placement guarantees "fills to bleed" vs "respects safe-area".
  // `scale` is a centered zoom multiplier applied ON TOP of `fit` (absent => 1.0);
  // it clips to the card on both the editor preview and the server render.
  background?: { src: string; fit: "cover" | "contain"; scale?: number }; // FileStorage key/url
  // Render in array order = back → front; `z` mirrors index for explicit reorder.
  elements: LayoutElement[];
}

export type LayoutElement =
  | BoundTextElement
  | StaticTextElement
  | ImageElement
  | PhotoPlaceholderElement;

export interface ElementBase {
  id: string;
  z: number;
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
}

export interface TextStyle {
  family: string; // a KEY from the curated whitelist (NOT arbitrary CSS)
  sizePt: number; // points (print-native); editor converts pt → px for preview
  weight: 400 | 700; // whitelist-constrained
  color: string; // #RRGGBB
  align: "left" | "center" | "right";
  lineHeight?: number; // optional multiplier
}

export interface BoundTextElement extends ElementBase {
  type: "boundText";
  binding: string; // a key from the binding catalog, e.g. "person.lastName"
  prefix?: string;
  suffix?: string;
  dateFormat?: string; // dayjs token, for date bindings
  fallback?: string; // shown when the resolved value is null/missing
  font: TextStyle;
}

export interface StaticTextElement extends ElementBase {
  type: "staticText";
  text: string;
  font: TextStyle;
}

export interface ImageElement extends ElementBase {
  type: "image"; // logo (respects safe area by convention, not enforced)
  src: string; // FileStorage key/url
  fit: "contain" | "cover";
}

export interface PhotoPlaceholderElement extends ElementBase {
  type: "photo"; // bound member-photo region (Phase 4 crop transform fills it)
  fit: "cover" | "contain";
  shape?: "rect" | "rounded" | "circle";
}

// ---------------------------------------------------------------------------
// Row shape for the templates list/editor (mirrors OrdinationTypeInterface).
// `layoutJson` is the SERIALIZED LicenseTemplateLayout above. The list page
// (05-06) and pickers read this row; the editor (05-05) parses layoutJson into
// a LicenseTemplateLayout and re-serializes on save.
// ---------------------------------------------------------------------------
export interface LicenseTemplateInterface {
  id?: string;
  churchId?: string;
  name?: string;
  ordinationTypeId?: string | null; // optional type association (null = any/all)
  isDefault?: boolean;
  active?: boolean;
  layoutJson?: string; // JSON.stringify(LicenseTemplateLayout)
  currentVersion?: number; // content/audit version (bumps every save)
  version?: number; // optimistic-concurrency guard (updateWithVersion)
  removed?: boolean;
}
