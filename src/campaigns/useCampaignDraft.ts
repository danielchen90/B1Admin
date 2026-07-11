// Campaign draft state + OCC persistence hook (Plan 12-05, SND-03).
//
// Owns the editable draft (name / subject / preheader / blockJson / renderedHtml /
// audienceFilterJson / campusId / status / version) and its persistence:
//   - load by id on mount (getCampaign) — or start an empty in-memory draft on
//     /email/new; the FIRST save createDrafts then navigates /new → /:id, and
//     every subsequent save updateDrafts under OCC.
//   - debounced autosave (scheduleAutosave, ~2.5s idle) + immediate manual save.
//   - OCC via expectedVersion: we track the SERVER-RETURNED version as the next
//     expectedVersion (Pitfall 7). A stale-version 409 triggers reload-and-reapply:
//     re-fetch the fresh row, re-layer the user's in-flight edits over it, and
//     retry ONCE, surfacing a non-blocking "reloaded due to a concurrent edit" notice.
//
// Sanitization (subject CR/LF strip) is server-side (12-03) — the hook just sends
// fields. There was no autosave precedent in the codebase; this is net-new but
// small (local state + a debounce timer + the OCC retry).

import React from "react";
import { useNavigate } from "react-router-dom";
import { parseApiError } from "./apiError";
import { getCampaign, createDraft, updateDraft } from "./campaignApi";
import { type CampaignInterface } from "./emailTypes";

// The mutable subset a user edits. Everything else on the draft is server-owned.
export type DraftPatch = Partial<
  Pick<
    CampaignInterface,
    "name" | "subject" | "preheader" | "blockJson" | "renderedHtml" | "audienceFilterJson" | "campusId"
  >
>;

export interface UseCampaignDraft {
  draft: CampaignInterface | null;
  loading: boolean;
  saving: boolean;
  lastSavedAt: Date | null;
  error: string;
  notice: string;
  clearNotice: () => void;
  // Merge a patch into local state (no persistence) — for controlled fields.
  patchLocal: (patch: DraftPatch) => void;
  // Debounced autosave (~2.5s idle after the last call).
  scheduleAutosave: (patch: DraftPatch) => void;
  // Immediate save (manual "Save Draft"). Resolves after the round-trip.
  save: (patch?: DraftPatch, opts?: { immediate?: boolean }) => Promise<void>;
  // Re-fetch the campaign by id and replace draft state + reset the tracked
  // expectedVersion. Needed after freeze/send so the editor reflects the server
  // status (draft→scheduled→sending) and the bumped version. RETURNS the fresh
  // server row so callers can read the authoritative version/status/audience
  // WITHOUT waiting for a React re-render (the send flow depends on this).
  reload: () => Promise<CampaignInterface | null>;
}

const AUTOSAVE_MS = 2500;

// A 409 stale-version conflict from the OCC guard. The 12-03 controller returns
// { error, code } with a conflict code; we also treat a raw "409" as a conflict.
function isVersionConflict(err: unknown): boolean {
  const body = parseApiError(err);
  const code = (body.code || "").toLowerCase();
  if (code === "conflict" || code === "version_conflict") return true;
  const raw = err instanceof Error ? err.message : "";
  return raw.includes("409");
}

// A fresh empty draft (in-memory) for /email/new. No id until the first save.
function emptyDraft(): CampaignInterface {
  return { name: "", subject: "", preheader: "", status: "draft", blockJson: "", renderedHtml: "" };
}

export function useCampaignDraft(id?: string): UseCampaignDraft {
  const navigate = useNavigate();
  const [draft, setDraft] = React.useState<CampaignInterface | null>(id ? null : emptyDraft());
  const [loading, setLoading] = React.useState<boolean>(!!id);
  const [saving, setSaving] = React.useState(false);
  const [lastSavedAt, setLastSavedAt] = React.useState<Date | null>(null);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");

  // A live ref to the current draft so save() always reads the latest merged
  // state (avoids stale closures from the debounce timer / async retries).
  const draftRef = React.useRef<CampaignInterface | null>(draft);
  draftRef.current = draft;
  // The expectedVersion to send on the NEXT save (server-returned last version).
  const expectedVersionRef = React.useRef<number | undefined>(undefined);
  // Debounce timer handle.
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against overlapping saves (a debounced autosave firing mid manual save).
  const inFlightRef = React.useRef(false);

  // Load an existing draft by id.
  React.useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    getCampaign(id)
      .then((c) => {
        if (!active) return;
        setDraft(c);
        expectedVersionRef.current = c.version;
      })
      .catch((err: unknown) => {
        if (active) setError(parseApiError(err).error || "Couldn't load the campaign.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const patchLocal = React.useCallback((patch: DraftPatch) => {
    setDraft((prev) => ({ ...(prev ?? emptyDraft()), ...patch }));
  }, []);

  // The core persister. Merges `patch` into the live draft, then create/update
  // under OCC. On a 409 stale version, reload-and-reapply the in-flight edits once.
  const doSave = React.useCallback(
    async (patch: DraftPatch): Promise<void> => {
      if (inFlightRef.current) return;
      // Merge the patch into local state first so the UI + next save see it.
      const merged: CampaignInterface = { ...(draftRef.current ?? emptyDraft()), ...patch };
      setDraft(merged);

      inFlightRef.current = true;
      setSaving(true);
      setError("");
      try {
        if (!merged.id) {
          // First save of a brand-new draft → create, then transition the route.
          const created = await createDraft({
            name: merged.name || "Untitled campaign",
            subject: merged.subject,
            preheader: merged.preheader,
            blockJson: merged.blockJson,
            renderedHtml: merged.renderedHtml,
            audienceFilterJson: merged.audienceFilterJson,
            campusId: merged.campusId,
          });
          setDraft(created);
          expectedVersionRef.current = created.version;
          setLastSavedAt(new Date());
          if (created.id) navigate(`/email/${created.id}`, { replace: true });
          return;
        }

        const fields = {
          name: merged.name,
          subject: merged.subject,
          preheader: merged.preheader,
          blockJson: merged.blockJson,
          renderedHtml: merged.renderedHtml,
          audienceFilterJson: merged.audienceFilterJson,
          campusId: merged.campusId,
        };
        try {
          const saved = await updateDraft(merged.id, {
            ...fields,
            expectedVersion: expectedVersionRef.current,
          });
          // The update endpoint returns only { id, version } — merge it OVER the
          // local draft so we keep every field we just sent (name/subject/blockJson/
          // audienceFilterJson/campusId). Replacing wholesale would wipe the in-memory
          // draft to {id,version}, which (e.g.) reverts the Audience tab to whole-church.
          setDraft({ ...merged, ...saved });
          expectedVersionRef.current = saved.version;
          setLastSavedAt(new Date());
        } catch (err) {
          if (!isVersionConflict(err)) throw err;
          // Reload-and-reapply (Pitfall 7): fetch the fresh row, re-layer the
          // user's in-flight edits over it, retry ONCE with the fresh version.
          const fresh = await getCampaign(merged.id);
          const reapplied: CampaignInterface = { ...fresh, ...fields };
          const saved = await updateDraft(merged.id, {
            ...fields,
            expectedVersion: fresh.version,
          });
          setDraft({ ...reapplied, ...saved });
          expectedVersionRef.current = saved.version;
          setLastSavedAt(new Date());
          setNotice("Your changes were re-applied after a concurrent edit was detected.");
        }
      } catch (err) {
        setError(parseApiError(err).error || "Couldn't save the draft.");
        throw err;
      } finally {
        inFlightRef.current = false;
        setSaving(false);
      }
    },
    [navigate]
  );

  const save = React.useCallback(
    async (patch: DraftPatch = {}, _opts?: { immediate?: boolean }): Promise<void> => {
      // A manual/immediate save flushes any pending autosave timer first.
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      await doSave(patch);
    },
    [doSave]
  );

  const scheduleAutosave = React.useCallback(
    (patch: DraftPatch) => {
      // Apply the patch locally immediately so the field stays responsive, then
      // debounce the persistence.
      patchLocal(patch);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        // Swallow autosave errors into `error` (doSave already sets it); never
        // reject an autosave (it's fire-and-forget).
        doSave(patch).catch(() => {});
      }, AUTOSAVE_MS);
    },
    [doSave, patchLocal]
  );

  // Flush the timer on unmount.
  React.useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const clearNotice = React.useCallback(() => setNotice(""), []);

  // Re-fetch the campaign fresh and replace draft state (mirrors the mount load).
  // Resets expectedVersion to the server's version so the next OCC save/freeze
  // uses the current value. RETURNS the fresh row (or null when there's no id /
  // on error) so the send flow can read the authoritative version/status/audience
  // immediately, without depending on a React re-render of draftRef.
  const reload = React.useCallback(async (): Promise<CampaignInterface | null> => {
    const currentId = draftRef.current?.id ?? id;
    if (!currentId) return null;
    try {
      const fresh = await getCampaign(currentId);
      setDraft(fresh);
      expectedVersionRef.current = fresh.version;
      return fresh;
    } catch (err) {
      setError(parseApiError(err).error || "Couldn't reload the campaign.");
      return null;
    }
  }, [id]);

  return {
    draft,
    loading,
    saving,
    lastSavedAt,
    error,
    notice,
    clearNotice,
    patchLocal,
    scheduleAutosave,
    save,
    reload,
  };
}

export default useCampaignDraft;
