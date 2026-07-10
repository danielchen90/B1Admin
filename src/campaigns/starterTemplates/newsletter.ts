/**
 * BLD-08 starter template: Newsletter.
 *
 * Navy header + a greeting merge field + three stacked content sections (each a
 * heading + body + image placeholder), separated by gold dividers. This is the
 * multi-section layout for a periodic church newsletter. No footer authored here —
 * CampaignRenderHelper appends the compliant footer at render time.
 */
import { HURO } from "./huroTokens";
import type { UnlayerDesign } from "./huroTokens";
import { buildDesign, huroHeaderRow, row, headingBlock, textBlock, imageBlock, dividerBlock } from "./designBuilder";

// Huro palette, hard-coded literally (email clients ignore CSS vars): navy #0B1D3A,
// gold #D4A23A, ivory #F5F6F7 / paper #ffffff, body text #1F2A3D, muted #6B7280.

export const newsletter: UnlayerDesign = buildDesign([
  huroHeaderRow(),
  row(
    [
      headingBlock("This Month at Church", { level: "h1", color: HURO.navy, padding: "28px 24px 2px" }),
      textBlock(`Hi {{firstName|Friend}}, here's what's happening across {{campusName|our church}}.`, { padding: "4px 24px 8px", color: HURO.textMuted, fontSize: "14px" }),

      dividerBlock({ color: HURO.gold, padding: "6px 24px" }),
      headingBlock("Section One", { level: "h2", color: HURO.navy, padding: "10px 24px 2px" }),
      imageBlock({ alt: "Section one image", padding: "6px 24px" }),
      textBlock(`Replace this with the first story — a ministry highlight, a testimony, or a recap of a recent gathering.`, { padding: "2px 24px 10px" }),

      dividerBlock({ color: HURO.gold, padding: "6px 24px" }),
      headingBlock("Section Two", { level: "h2", color: HURO.navy, padding: "10px 24px 2px" }),
      imageBlock({ alt: "Section two image", padding: "6px 24px" }),
      textBlock(`Replace this with the second story — an upcoming event, a serving opportunity, or a giving update.`, { padding: "2px 24px 10px" }),

      dividerBlock({ color: HURO.gold, padding: "6px 24px" }),
      headingBlock("Section Three", { level: "h2", color: HURO.navy, padding: "10px 24px 2px" }),
      textBlock(`Replace this with the third story — a prayer focus, a staff introduction, or a closing encouragement.`, { padding: "2px 24px 24px" }),
    ],
    { bg: HURO.paper }
  ),
]);

export default newsletter;
