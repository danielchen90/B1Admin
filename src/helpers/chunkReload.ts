// Auto-recover from stale dynamic-import (chunk) failures after a redeploy.
//
// Vite fingerprints each lazy-route chunk by content hash. When a new build is deployed,
// a browser tab still running the OLD bundle holds references to old hashes; loading one
// (e.g. navigating to a lazy route) 404s with "Failed to fetch dynamically imported
// module". Vite's build-time __vitePreload helper emits a `vite:preloadError` event on
// window for exactly this case; React.lazy import() rejections can also surface as
// unhandled promise rejections. In both cases the fix is the same: do ONE full reload so
// the browser fetches the fresh index.html and the current chunk hashes.
//
// Guarded by a timestamp in sessionStorage so a genuinely broken/missing asset (which keeps
// failing after the reload) cannot loop — we only reload if we have not just reloaded, and
// otherwise let the error surface to the existing error boundary.

const GUARD_KEY = "b1admin:chunk-reload-at";
const RELOAD_COOLDOWN_MS = 10_000;

const looksLikeChunkError = (message?: string | null): boolean =>
  !!message &&
  /dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Failed to fetch/i.test(message);

const reloadOnce = (): void => {
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(GUARD_KEY)) || 0;
  } catch {
    // sessionStorage unavailable (private mode / sandboxed iframe) — fall through to reload.
  }
  if (Date.now() - last < RELOAD_COOLDOWN_MS) return; // just reloaded → don't loop; show the error
  try {
    sessionStorage.setItem(GUARD_KEY, String(Date.now()));
  } catch {
    /* ignore — best-effort guard */
  }
  window.location.reload();
};

export const installChunkReloadHandler = (): void => {
  if (typeof window === "undefined") return;

  // Vite's first-class signal for a failed module preload / dynamic import.
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault(); // we own recovery; suppress Vite's rethrow
    reloadOnce();
  });

  // React.lazy import() rejections that escape as unhandled promise rejections.
  window.addEventListener("unhandledrejection", (event) => {
    const reason = (event as PromiseRejectionEvent).reason;
    const message = typeof reason === "string" ? reason : reason?.message;
    if (looksLikeChunkError(message)) reloadOnce();
  });
};
