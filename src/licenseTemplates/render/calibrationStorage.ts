// Per-WORKSTATION (device-local) print calibration for the CR80 license printer.
//
// LOCKED DECISION: calibration is per-workstation, NOT per-template — the physical
// printer + card-stock feed offset is a property of THIS device, so the same offset
// applies to every card printed here regardless of which template is used. It therefore
// lives in localStorage (survives reloads, never syncs to the server / other machines)
// rather than on the template row. The calibration dialog (06-06) WRITES it; the print
// dialog (06-05) READS it and bakes the offsets into every /render and /testCard call so
// the previewed bytes already carry this workstation's alignment.

export interface Calibration {
  offsetXmm: number;
  offsetYmm: number;
  scale: number;
}

export const DEFAULT_CALIBRATION: Calibration = { offsetXmm: 0, offsetYmm: 0, scale: 1 };

const STORAGE_KEY = "badgy.calibration";

// Read this workstation's calibration. Falls back to DEFAULT_CALIBRATION when the key
// is absent, unparseable, or holds non-finite numbers (a corrupt value must never bake
// a broken offset into a render — it just means "uncalibrated").
export const getCalibration = (): Calibration => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CALIBRATION };
    const parsed = JSON.parse(raw) as Partial<Calibration>;
    const offsetXmm = Number(parsed?.offsetXmm);
    const offsetYmm = Number(parsed?.offsetYmm);
    const scale = Number(parsed?.scale);
    return {
      offsetXmm: Number.isFinite(offsetXmm) ? offsetXmm : DEFAULT_CALIBRATION.offsetXmm,
      offsetYmm: Number.isFinite(offsetYmm) ? offsetYmm : DEFAULT_CALIBRATION.offsetYmm,
      scale: Number.isFinite(scale) && scale > 0 ? scale : DEFAULT_CALIBRATION.scale
    };
  } catch {
    return { ...DEFAULT_CALIBRATION };
  }
};

// Persist this workstation's calibration. Guards each field (never write NaN / a
// non-positive scale) and swallows localStorage failures (private-mode quota) — a
// failed write simply leaves calibration at its previous value.
export const setCalibration = (c: Calibration): void => {
  try {
    const scale = Number(c.scale);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      offsetXmm: Number.isFinite(Number(c.offsetXmm)) ? Number(c.offsetXmm) : 0,
      offsetYmm: Number.isFinite(Number(c.offsetYmm)) ? Number(c.offsetYmm) : 0,
      scale: Number.isFinite(scale) && scale > 0 ? scale : 1
    }));
  } catch {
    // localStorage unavailable (private mode / quota) — calibration stays as-is.
  }
};
