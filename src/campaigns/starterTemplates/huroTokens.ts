/**
 * Huro brand tokens for starter templates (BLD-08).
 *
 * These hex values are hard-coded LITERALLY into every Unlayer design-JSON object
 * because email clients ignore CSS custom properties — a `var(--navy)` would render
 * as nothing in Gmail/Outlook. See 12-RESEARCH "Huro Brand Tokens".
 *
 * Do NOT reference these from inside the design JSON via interpolation expecting a
 * runtime lookup at send time; the point is that the literal hex is baked into the
 * exported HTML. They live here only so the four template authors stay in sync.
 */
export const HURO = {
  navy: "#0B1D3A", // headers, headings, primary buttons
  navyMuted: "#1F2A3D", // body text
  gold: "#D4A23A", // buttons, rules, accents
  goldHover: "#C6942F",
  paper: "#ffffff", // email paper / content bg
  ivory: "#F5F6F7", // default/section bg, footer bg
  subtle: "#FAFBFC",
  textMuted: "#6B7280", // muted / secondary text
  white: "#ffffff",
} as const;

/**
 * Email-safe font stacks. Sora/Inter are the brand fonts; every stack ends in an
 * email-safe fallback (Arial/Georgia) because most clients will not load webfonts.
 */
export const HURO_FONT = {
  heading: "'Sora', 'Inter', Arial, Helvetica, sans-serif",
  body: "'Inter', Arial, Helvetica, sans-serif",
} as const;

/**
 * The shape `editor.saveDesign()` produces and `editor.loadDesign()` consumes.
 * Kept intentionally loose (`values` / row shapes are Unlayer-internal and vary by
 * tool version) — the load contract only requires `counters` + `body.rows` + a
 * `body.values` container.
 */
export interface UnlayerDesign {
  counters: Record<string, number>;
  body: {
    id?: string;
    rows: UnlayerRow[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    values: Record<string, any>;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schemaVersion?: any;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UnlayerRow = Record<string, any>;
