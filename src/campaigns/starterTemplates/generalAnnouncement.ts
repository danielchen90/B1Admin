/**
 * BLD-08 starter template: General Announcement.
 *
 * Branded navy header + heading + a greeting with a merge field + body copy + a
 * single gold CTA button. The `{{firstName|Friend}}` token is a LITERAL string
 * (Unlayer stores merge `value` verbatim); the server's MergeFieldHelper resolves
 * it at render time. No footer is authored here — CampaignRenderHelper (12-01)
 * appends the compliant footer at render time (single-footer doctrine).
 */
import { HURO } from "./huroTokens";
import type { UnlayerDesign } from "./huroTokens";
import { buildDesign, huroHeaderRow, row, headingBlock, textBlock, buttonBlock } from "./designBuilder";

// Huro palette, hard-coded literally (email clients ignore CSS vars): navy #0B1D3A,
// gold #D4A23A, ivory #F5F6F7 / paper #ffffff, body text #1F2A3D, muted #6B7280.

export const generalAnnouncement: UnlayerDesign = buildDesign([
  huroHeaderRow(),
  row(
    [
      headingBlock("A Word From Our Church", { level: "h1", color: HURO.navy, padding: "28px 24px 4px" }),
      textBlock(`Hi {{firstName|Friend}},`, { padding: "6px 24px 2px", fontSize: "16px", color: HURO.navyMuted }),
      textBlock(
        `We wanted to share an important update with you. Replace this text with your announcement — service changes, a new season of ministry, a community milestone, or anything the church family should know about.`,
        { padding: "6px 24px 8px" }
      ),
      buttonBlock("Read More", "https://huro.church", { bg: HURO.gold, color: HURO.navy, padding: "10px 24px 30px" }),
    ],
    { bg: HURO.paper }
  ),
]);

export default generalAnnouncement;
