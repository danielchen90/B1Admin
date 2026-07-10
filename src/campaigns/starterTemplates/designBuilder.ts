/**
 * Tiny builders that emit valid Unlayer design-JSON fragments (rows / contents).
 *
 * This is NOT a full re-implementation of Unlayer's schema — it produces the
 * subset of the `{ counters, body: { rows, values } }` structure that
 * `editor.loadDesign()` accepts and re-hydrates. Field names (`cssClass`,
 * `containerPadding`, `textAlign`, `buttonColors`, `border`, `_meta`) mirror the
 * shapes `editor.saveDesign()` emits for text / button / image / divider / heading
 * blocks so a design authored here round-trips through the editor unchanged.
 *
 * All colors are passed in literally by the template authors (see huroTokens.ts) —
 * this builder never injects a color of its own, so the Huro palette is the single
 * source of truth.
 */
import { HURO, HURO_FONT } from "./huroTokens";
import type { UnlayerDesign, UnlayerRow } from "./huroTokens";

let uid = 0;
const nextId = (): string => `hs-${(uid += 1)}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Content = Record<string, any>;

const contentMeta = (type: string): Content["_meta"] => ({ htmlID: `u_content_${type}_${uid}`, htmlClassNames: "u_content_" + type });

/** A rich-text / paragraph block. `html` may contain literal `{{merge|fallback}}` tokens. */
export const textBlock = (html: string, opts: { color?: string; fontSize?: string; align?: string; padding?: string } = {}): Content => ({
  id: nextId(),
  type: "text",
  values: {
    containerPadding: opts.padding ?? "10px 24px",
    anchor: "",
    fontFamily: { label: "Inter", value: HURO_FONT.body },
    fontSize: opts.fontSize ?? "15px",
    textAlign: opts.align ?? "left",
    lineHeight: "150%",
    linkStyle: { inherit: false, linkColor: HURO.gold, linkHoverColor: HURO.goldHover, linkUnderline: true, linkHoverUnderline: true },
    _meta: contentMeta("text"),
    selectable: true,
    draggable: true,
    duplicatable: true,
    deletable: true,
    hideable: true,
    color: opts.color ?? HURO.navyMuted,
    text: `<p style="line-height: 150%;">${html}</p>`,
  },
});

/** A heading block (h1/h2). Sora with an email-safe fallback, navy by default. */
export const headingBlock = (text: string, opts: { level?: "h1" | "h2"; color?: string; align?: string; fontSize?: string; padding?: string } = {}): Content => ({
  id: nextId(),
  type: "heading",
  values: {
    containerPadding: opts.padding ?? "10px 24px",
    anchor: "",
    headingType: opts.level ?? "h2",
    fontFamily: { label: "Sora", value: HURO_FONT.heading },
    fontSize: opts.fontSize ?? (opts.level === "h1" ? "30px" : "22px"),
    textAlign: opts.align ?? "left",
    lineHeight: "120%",
    _meta: contentMeta("heading"),
    selectable: true,
    draggable: true,
    duplicatable: true,
    deletable: true,
    hideable: true,
    color: opts.color ?? HURO.navy,
    text,
  },
});

/** A CTA button. Gold fill + navy label by default (Huro primary CTA). */
export const buttonBlock = (label: string, href: string, opts: { bg?: string; color?: string; align?: string; padding?: string } = {}): Content => ({
  id: nextId(),
  type: "button",
  values: {
    containerPadding: opts.padding ?? "16px 24px",
    anchor: "",
    href: { name: "web", values: { href, target: "_blank" } },
    buttonColors: { color: opts.color ?? HURO.navy, backgroundColor: opts.bg ?? HURO.gold, hoverColor: opts.color ?? HURO.navy, hoverBackgroundColor: HURO.goldHover },
    size: { autoWidth: true, width: "100%" },
    fontFamily: { label: "Sora", value: HURO_FONT.heading },
    fontSize: "15px",
    textAlign: opts.align ?? "center",
    lineHeight: "120%",
    padding: "12px 28px",
    border: {},
    borderRadius: "6px",
    _meta: contentMeta("button"),
    selectable: true,
    draggable: true,
    duplicatable: true,
    deletable: true,
    hideable: true,
    text: `<span style="font-weight: 700; letter-spacing: 0.02em;">${label}</span>`,
  },
});

/** A horizontal divider — thin gold rule by default. */
export const dividerBlock = (opts: { color?: string; padding?: string; width?: string } = {}): Content => ({
  id: nextId(),
  type: "divider",
  values: {
    width: opts.width ?? "100%",
    border: { borderTopWidth: "2px", borderTopStyle: "solid", borderTopColor: opts.color ?? HURO.gold },
    textAlign: "center",
    containerPadding: opts.padding ?? "10px 24px",
    anchor: "",
    _meta: contentMeta("divider"),
    selectable: true,
    draggable: true,
    duplicatable: true,
    deletable: true,
    hideable: true,
  },
});

/** An image placeholder block (Unlayer shows a drop target when `url` is empty). */
export const imageBlock = (opts: { url?: string; alt?: string; padding?: string } = {}): Content => ({
  id: nextId(),
  type: "image",
  values: {
    containerPadding: opts.padding ?? "10px 24px",
    anchor: "",
    src: { url: opts.url ?? "", width: 600, height: 300, autoWidth: true, maxWidth: "100%" },
    textAlign: "center",
    altText: opts.alt ?? "",
    action: { name: "web", values: { href: "", target: "_blank" } },
    _meta: contentMeta("image"),
    selectable: true,
    draggable: true,
    duplicatable: true,
    deletable: true,
    hideable: true,
  },
});

/** Wrap one or more content blocks into a single-column row with a background. */
export const row = (contents: Content[], opts: { bg?: string; padding?: string } = {}): UnlayerRow => {
  const columnId = nextId();
  return {
    id: nextId(),
    cells: [1],
    columns: [
      {
        id: columnId,
        contents,
        values: {
          _meta: { htmlID: `u_column_${columnId}`, htmlClassNames: "u_column" },
          border: {},
          padding: "0px",
          backgroundColor: "",
        },
      },
    ],
    values: {
      displayCondition: null,
      columns: false,
      backgroundColor: opts.bg ?? "",
      columnsBackgroundColor: "",
      backgroundImage: { url: "", fullWidth: true, repeat: "no-repeat", size: "custom", position: "center" },
      padding: opts.padding ?? "0px",
      anchor: "",
      hideDesktop: false,
      _meta: { htmlID: `u_row_${uid}`, htmlClassNames: "u_row" },
      selectable: true,
      draggable: true,
      duplicatable: true,
      deletable: true,
      hideable: true,
    },
  };
};

/**
 * The shared Huro header bar: navy background, white "HURO" wordmark rendered as
 * text (email-safe — no webfont dependency, no image). Every starter template opens
 * with this exact row so brand identity is consistent across all four.
 */
export const huroHeaderRow = (): UnlayerRow =>
  row(
    [
      textBlock(
        `<span style="font-family: ${HURO_FONT.heading}; font-weight: 800; font-size: 26px; letter-spacing: 0.14em; color: ${HURO.white};">HURO</span>`,
        { align: "left", color: HURO.white, padding: "22px 24px" }
      ),
    ],
    { bg: HURO.navy, padding: "0px" }
  );

/**
 * Assemble a full, loadable Unlayer design from a list of rows. Sets a sensible
 * content-area width, ivory page background, and the counters Unlayer expects so
 * `loadDesign()` re-hydrates without recomputing IDs.
 */
export const buildDesign = (rows: UnlayerRow[]): UnlayerDesign => ({
  counters: { u_row: uid, u_column: uid, u_content_text: uid, u_content_heading: uid, u_content_button: uid, u_content_divider: uid, u_content_image: uid },
  body: {
    id: nextId(),
    rows,
    values: {
      popupPosition: "center",
      popupWidth: "600px",
      popupHeight: "auto",
      borderRadius: "10px",
      contentAlign: "center",
      contentVerticalAlign: "center",
      contentWidth: "600px",
      fontFamily: { label: "Inter", value: HURO_FONT.body },
      textColor: HURO.navyMuted,
      popupBackgroundColor: "#FFFFFF",
      popupBackgroundImage: { url: "", fullWidth: true, repeat: "no-repeat", size: "cover", position: "center" },
      popupOverlay_backgroundColor: "rgba(0, 0, 0, 0.1)",
      popupCloseButton_position: "top-right",
      popupCloseButton_backgroundColor: "#DDDDDD",
      popupCloseButton_iconColor: "#000000",
      popupCloseButton_borderRadius: "0px",
      popupCloseButton_margin: "0px",
      popupCloseButton_action: { name: "close_popup", attrs: { onClick: "document.querySelector('.u-popup-container').style.display = 'none';" } },
      backgroundColor: HURO.ivory,
      backgroundImage: { url: "", fullWidth: true, repeat: "no-repeat", size: "custom", position: "center" },
      preheaderText: "",
      linkStyle: { body: true, linkColor: HURO.gold, linkHoverColor: HURO.goldHover, linkUnderline: true, linkHoverUnderline: true },
      _meta: { htmlID: "u_body", htmlClassNames: "u_body" },
    },
  },
  schemaVersion: 16,
});
