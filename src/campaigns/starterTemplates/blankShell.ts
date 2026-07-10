/**
 * BLD-08 starter template: Blank Branded Shell.
 *
 * The shared Huro scaffold — the navy header bar (white "HURO" wordmark) followed by
 * an empty, ready-to-fill body region on ivory paper. This is the "start from scratch
 * but on-brand" option: the user drags blocks into the empty body. No footer authored
 * here — CampaignRenderHelper appends the compliant footer at render time.
 */
import { HURO } from "./huroTokens";
import type { UnlayerDesign } from "./huroTokens";
import { buildDesign, huroHeaderRow, row, textBlock } from "./designBuilder";

// Huro palette, hard-coded literally (email clients ignore CSS vars): navy #0B1D3A,
// gold #D4A23A, ivory #F5F6F7 / paper #ffffff, body text #1F2A3D, muted #6B7280.

export const blankShell: UnlayerDesign = buildDesign([
  huroHeaderRow(),
  // Empty body region: a single muted prompt the user replaces / deletes as they build.
  row(
    [
      textBlock(`<em>Drag blocks here to start building your email.</em>`, {
        align: "center",
        color: HURO.textMuted,
        padding: "48px 24px",
      }),
    ],
    { bg: HURO.paper }
  ),
]);

export default blankShell;
