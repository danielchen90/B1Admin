// fonts.ts — the curated font whitelist (RESEARCH §Fonts).
//
// PHASE 6 CONTRACT — the renderer MUST resolve every family listed here
// (self-hosted woff2, see forks/Api renderFonts.ts FONT_FACES); the editor uses
// webfontloader/Google for preview parity. The whitelist is the COUPLING POINT with
// Phase 6: layout JSON stores a stable KEY (sans/serif/condensed/mono/cinzel/pinyon),
// NOT raw CSS, so the editor preview and the headless-Chromium render resolve identical
// metrics. Do NOT add a family here without (1) adding its woff2 to the Api FONT_FACES
// set and (2) adding its key→cssFamily to LicenseRenderHelper FONT_CSS. Weights are
// 400/700 where available (script/display faces may ship regular-only — bold then
// resolves to regular via font-synthesis:none, not a faux-bold). Honors the locked
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
  { key: "mono", label: "Mono (Noto Sans Mono)", cssFamily: "'Noto Sans Mono', monospace" },
  // Certificate fonts (OFL, self-hosted server-side in renderFonts.ts).
  // Cinzel = a Trajan-style Roman capital; Pinyon Script = an Edwardian-style formal
  // script (regular-only — bold is suppressed via font-synthesis, see CanvasElement).
  { key: "cinzel", label: "Trajan Style (Cinzel)", cssFamily: "'Cinzel', serif" },
  { key: "pinyon", label: "Edwardian Script (Pinyon)", cssFamily: "'Pinyon Script', cursive" }
];

// Map a whitelist key to its CSS family (fallback to sans for an unknown key).
export const fontCss = (familyKey: string): string =>
  FONT_WHITELIST.find((f) => f.key === familyKey)?.cssFamily ?? FONT_WHITELIST[0].cssFamily;

// Load the whitelisted families so editor preview metrics are deterministic. Cinzel
// carries 400/700 (variable); Pinyon Script is regular-only (no 700 variant exists).
export const loadEditorFonts = (): void => {
  WebFont.load({
    google: {
      families: [
        "Noto Sans:400,700",
        "Noto Serif:400,700",
        "Archivo Narrow:400,700",
        "Noto Sans Mono:400,700",
        "Cinzel:400,700",
        "Pinyon Script:400"
      ]
    }
  });
};
