import { useCallback, useEffect, useState } from "react";
import { ApiHelper } from "@churchapps/apphelper";
import { type LicensePhotoCropInterface } from "./LicensePhotoInterfaces";

// Loads a person's saved license crop so Plan 04 can re-open the editor pre-positioned.
//
// PATH NOTE: the apphelper MembershipApi config base ALREADY ends in "/membership", so the
// resource path here is BARE ("/personPhotoCrops"), NOT "/membership/personPhotoCrops" — a
// "/membership" prefix doubles to ".../membership/membership/..." → 404. This is the durable
// Phase-3 lesson (existing screens use bare /campuses, /people, /ordinationTypes); the
// Plan-01 controller is mounted at /membership/personPhotoCrops on the server, which the
// MembershipApi base supplies.
//
// Gating is server-enforced; the client editor-open affordance is gated in Plan 04. So a
// 401/empty here resolves to null rather than throwing — a missing crop is the normal
// first-time state, not an error.
export const useLicensePhoto = (personId?: string) => {
  const [crop, setCrop] = useState<LicensePhotoCropInterface | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const reload = useCallback(async () => {
    if (!personId) {
      setCrop(null);
      return;
    }
    setLoading(true);
    try {
      const rows: LicensePhotoCropInterface[] = await ApiHelper.get(`/personPhotoCrops?personId=${personId}`, "MembershipApi");
      const list = Array.isArray(rows) ? rows : [];
      setCrop(list.find((r) => r.purpose === "license") ?? null);
    } catch {
      // 401/network/empty → treat as no saved crop (server enforces real access control).
      setCrop(null);
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { crop, loading, reload };
};
