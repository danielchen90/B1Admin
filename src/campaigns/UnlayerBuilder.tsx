// The Unlayer block-builder wrapper (Plan 12-05, BLD-01/BLD-03/BLD-05).
//
// A thin controlled wrapper over react-email-editor's <EmailEditor>. It owns the
// editor lifecycle (onReady → loadDesign + image callback) and exposes an
// imperative handle so the page + dialogs can drive it:
//   - loadDesign(design)   : swap the current design (template picker / draft reload)
//   - exportNow()          : capture BOTH blockJson (design) AND renderedHtml
//                            (Unlayer's table-based, inlined HTML — BLD-01) and
//                            hand them to onExport (autosave / manual-save path)
//   - captureDesign(cb)    : one-shot grab of {design, html} WITHOUT going through
//                            onExport (the "Save as template" flow, Task 3)
//
// Merge tags (BLD-03) come from mergeTags.ts; image upload (BLD-05) routes through
// campaignApi.uploadCampaignImage → done({url}) with the server's ABSOLUTE URL
// (12-03). The full Unlayer block palette is exposed (CONTEXT: no `tools`
// restriction). The server NEVER runs Unlayer — it only stores/renders the HTML
// this editor produces.

import React from "react";
import EmailEditor, { type EditorRef } from "react-email-editor";
import type { JSONTemplate } from "@unlayer/types";
import { MERGE_TAGS } from "./mergeTags";
import { uploadCampaignImage } from "./campaignApi";

// The design JSON Unlayer consumes (loadDesign) / produces (saveDesign). The
// starter templates + persisted blockJson are this shape; we keep it loose here.
export type UnlayerDesignJson = JSONTemplate<"email">;

// What every capture yields: the design (→ blockJson) + rendered HTML (→ renderedHtml).
export interface CapturedDesign {
  design: UnlayerDesignJson;
  html: string;
}

export interface UnlayerBuilderHandle {
  // Load a design into the editor (template pick / draft reload).
  loadDesign: (design: UnlayerDesignJson) => void;
  // Capture design + html and forward to onExport (autosave / save-draft path).
  exportNow: () => void;
  // One-shot capture of the current {design, html} for callers that must NOT
  // trigger onExport (Save-as-template). No-op-safe if the editor isn't ready.
  captureDesign: (cb: (captured: CapturedDesign) => void) => void;
}

export interface UnlayerBuilderProps {
  // Initial design to load once the editor is ready (persisted blockJson or a
  // starter template). Undefined → a blank editor.
  initialDesign?: UnlayerDesignJson;
  // Namespacing key for uploaded images (the campaign id). Uploads are disabled
  // until a campaign id exists (a brand-new draft creates one on first pick/save).
  campaignId?: string;
  // Called whenever a capture is requested via exportNow(): carries BOTH the
  // design (blockJson source-of-truth) and the rendered table-based HTML.
  onExport?: (design: UnlayerDesignJson, html: string) => void;
  // Editor viewport height.
  minHeight?: number | string;
}

// The imperative wrapper. Consumers hold a ref<UnlayerBuilderHandle>.
export const UnlayerBuilder = React.forwardRef<UnlayerBuilderHandle, UnlayerBuilderProps>(
  ({ initialDesign, campaignId, onExport, minHeight = 640 }, ref) => {
    const editorRef = React.useRef<EditorRef>(null);
    // The latest campaignId, read at upload time so a draft created AFTER mount
    // still namespaces uploads correctly (the ref avoids re-registering callbacks).
    const campaignIdRef = React.useRef<string | undefined>(campaignId);
    campaignIdRef.current = campaignId;
    // The latest onExport, read at export time (same rationale).
    const onExportRef = React.useRef<UnlayerBuilderProps["onExport"]>(onExport);
    onExportRef.current = onExport;

    // Grab the live UnlayerEditor instance (null until onReady has fired).
    const getEditor = React.useCallback(() => editorRef.current?.editor ?? null, []);

    const captureDesign = React.useCallback(
      (cb: (captured: CapturedDesign) => void) => {
        const editor = getEditor();
        if (!editor) return;
        editor.saveDesign((design) => {
          editor.exportHtml((data) => cb({ design, html: data.html }));
        });
      },
      [getEditor]
    );

    React.useImperativeHandle(
      ref,
      (): UnlayerBuilderHandle => ({
        loadDesign: (design) => {
          getEditor()?.loadDesign(design);
        },
        exportNow: () => {
          captureDesign(({ design, html }) => onExportRef.current?.(design, html));
        },
        captureDesign,
      }),
      [getEditor, captureDesign]
    );

    // Editor ready: load the initial design + wire the image-upload callback.
    const onReady = React.useCallback(
      (editor: NonNullable<ReturnType<typeof getEditor>>) => {
        if (initialDesign) editor.loadDesign(initialDesign);

        // BLD-05: route the builder's image uploads through our endpoint, which
        // returns an ABSOLUTE hosted URL (12-03). Unlayer hands us the File(s)
        // via data.attachments; we upload the first and report the URL back.
        editor.registerCallback("image", (data, done) => {
          const file = data?.attachments?.[0];
          const id = campaignIdRef.current;
          if (!file || !id) {
            // No campaign namespace yet (or no file): fail the upload gracefully
            // rather than crash — the page creates a draft before real edits.
            done({ error: "Save the campaign before adding images." });
            return;
          }
          done({ progress: 10 });
          uploadCampaignImage(id, file)
            .then(({ url }) => done({ progress: 100, url }))
            .catch(() => done({ error: "Image upload failed." }));
        });
      },
      // initialDesign is intentionally read once on ready; later swaps go through
      // the imperative loadDesign handle.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      []
    );

    return (
      <EmailEditor
        ref={editorRef}
        onReady={onReady}
        minHeight={minHeight}
        options={{ displayMode: "email", mergeTags: MERGE_TAGS }}
      />
    );
  }
);

UnlayerBuilder.displayName = "UnlayerBuilder";

export default UnlayerBuilder;
