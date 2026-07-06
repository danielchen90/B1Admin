// fonts.ts — the curated font whitelist (RESEARCH §Fonts).
//
// PHASE 6 CONTRACT — the renderer MUST resolve these same four families
// (self-hosted woff2 or container-installed Noto + Archivo Narrow); the editor uses
// webfontloader/Google for preview parity. The whitelist is the COUPLING POINT with
// Phase 6: layout JSON stores a stable KEY (sans/serif/condensed/mono), NOT raw CSS,
// so the editor preview and the headless-Chromium render resolve identical metrics.
// Do NOT add a family here without adding it to the Phase 6 font set. Weights are
// constrained to 400/700 (the only bundled weights). Honors the locked
// curated-whitelist + no-custom-font-upload decision; self-hosting the woff2 binaries
// is a Phase 6 packaging concern documented here.

// webfontloader has no bundled @types; the JS module is already installed.

import WebFont from "webfontloader";

export interface FontDef {
  key: string;
  label: string;
  cssFamily: string;
}

export const FONT_WHITELIST: FontDef[] = [
  { key: "sans", label: "Sans (Noto Sans)", cssFamily: "'Noto Sans', sans-serif" },
  { key: "serif", label: "Serif (Noto Serif)", cssFamily: "'Noto Serif', serif" },
  { key: "condensed", label: "Condensed (Archivo Narrow)", cssFamily: "'Archivo Narrow', sans-serif" },
  { key: "mono", label: "Mono (Noto Sans Mono)", cssFamily: "'Noto Sans Mono', monospace" }
];

// Map a whitelist key to its CSS family (fallback to sans for an unknown key).
export const fontCss = (familyKey: string): string =>
  FONT_WHITELIST.find((f) => f.key === familyKey)?.cssFamily ?? FONT_WHITELIST[0].cssFamily;

// Load the four families (400/700) so editor preview metrics are deterministic.
export const loadEditorFonts = (): void => {
  WebFont.load({
    google: {
      families: [
        "Noto Sans:400,700",
        "Noto Serif:400,700",
        "Archivo Narrow:400,700",
        "Noto Sans Mono:400,700"
      ]
    }
  });
};
