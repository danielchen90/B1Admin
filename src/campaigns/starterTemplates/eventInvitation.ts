/**
 * BLD-08 starter template: Event / Invitation.
 *
 * Date/time/location-forward: a prominent event title, a greeting merge field, a
 * navy detail block (Date / Time / Location) framed by gold rules, and a gold RSVP
 * CTA button. No footer authored here — CampaignRenderHelper appends the compliant
 * footer at render time.
 */
import { HURO } from "./huroTokens";
import type { UnlayerDesign } from "./huroTokens";
import { buildDesign, huroHeaderRow, row, headingBlock, textBlock, buttonBlock, dividerBlock } from "./designBuilder";

// Huro palette, hard-coded literally (email clients ignore CSS vars): navy #0B1D3A,
// gold #D4A23A, ivory #F5F6F7 / paper #ffffff, body text #1F2A3D, muted #6B7280.

export const eventInvitation: UnlayerDesign = buildDesign([
  huroHeaderRow(),
  row(
    [
      textBlock(`YOU'RE INVITED`, { align: "center", color: HURO.gold, fontSize: "13px", padding: "26px 24px 2px" }),
      headingBlock("Event Title Goes Here", { level: "h1", color: HURO.navy, align: "center", padding: "2px 24px 6px" }),
      textBlock(`Hi {{firstName|Friend}}, we'd love for you to join us.`, { align: "center", padding: "2px 24px 8px", color: HURO.navyMuted }),

      dividerBlock({ color: HURO.gold, padding: "6px 60px" }),
      textBlock(
        `<strong style="color: ${HURO.navy};">Date</strong>&nbsp;&nbsp;Saturday, January 1<br/><strong style="color: ${HURO.navy};">Time</strong>&nbsp;&nbsp;10:00 AM<br/><strong style="color: ${HURO.navy};">Location</strong>&nbsp;&nbsp;{{campusName|Main Campus}}`,
        { align: "center", padding: "8px 24px", fontSize: "16px" }
      ),
      dividerBlock({ color: HURO.gold, padding: "6px 60px" }),

      buttonBlock("RSVP Now", "https://huro.church", { bg: HURO.gold, color: HURO.navy, align: "center", padding: "16px 24px 30px" }),
    ],
    { bg: HURO.paper }
  ),
]);

export default eventInvitation;
