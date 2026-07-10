/**
 * BLD-08 starter-template registry.
 *
 * The four Huro navy/gold starter templates the 12-05 editor's template picker maps
 * over: it renders a card per entry and, on select, calls
 * `editor.loadDesign(template.design)`. Each `design` is a valid Unlayer design-JSON
 * object (the shape `editor.saveDesign()` produces / `editor.loadDesign()` consumes).
 *
 * The blank branded shell is listed FIRST as "Start blank (branded)" — the on-brand
 * scratch option — followed by the three content templates.
 */
import type { UnlayerDesign } from "./huroTokens";
import { blankShell } from "./blankShell";
import { generalAnnouncement } from "./generalAnnouncement";
import { newsletter } from "./newsletter";
import { eventInvitation } from "./eventInvitation";

export interface StarterTemplate {
  id: string;
  name: string;
  description: string;
  design: UnlayerDesign;
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "blank-shell",
    name: "Start Blank (Branded)",
    description: "The Huro navy header on an empty body — start from scratch, on-brand.",
    design: blankShell,
  },
  {
    id: "general-announcement",
    name: "General Announcement",
    description: "A branded header, a heading, a personalized greeting, and a gold call-to-action.",
    design: generalAnnouncement,
  },
  {
    id: "newsletter",
    name: "Newsletter",
    description: "A multi-section layout with headings, body copy, image slots, and gold dividers.",
    design: newsletter,
  },
  {
    id: "event-invitation",
    name: "Event / Invitation",
    description: "Date, time, and location up front with a gold RSVP button.",
    design: eventInvitation,
  },
];

export default STARTER_TEMPLATES;

export { blankShell, generalAnnouncement, newsletter, eventInvitation };
export type { UnlayerDesign } from "./huroTokens";
