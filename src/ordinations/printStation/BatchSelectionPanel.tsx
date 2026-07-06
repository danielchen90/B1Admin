import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { type PersonInterface } from "@churchapps/helpers";
import { Locale, PageHeader } from "@churchapps/apphelper";
import { Box } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { canWriteOrdinations } from "../../helpers/OrdinationHelper";
import { useCampuses } from "../../hooks/useCampuses";
import { useOrdinationTypes } from "../../hooks/useOrdinationTypes";
import { type PersonOrdinationInterface } from "../../people/components/PersonOrdinationInterface";
import { composeRoster, getAccessibleCampuses } from "./rosterHelpers";
import { type RosterFilterSpec } from "./rosterTypes";
import * as printBatchApi from "./printBatchApi";

// Past this many selected people the batch still proceeds, but we warn the operator that
// rendering may take a while (RESEARCH ~150 soft cap — bounded memory is enforced
// server-side regardless, so this is advisory only, never a hard block).
const SOFT_CAP = 150;

// The "build a batch" half of the print station (PRT-02), rebuilt as a PURPOSE-BUILT roster:
// the selectable set is the campus-scoped ACTIVE-credential holders (from /personOrdinations,
// NOT the church-wide people-list search), joined client-side to people names / callings /
// campuses, filtered by the
// operator's campus + calling checkboxes, grouped (location/calling) and sorted, then sent as
// UNIQUE personIds + a structured RosterFilterSpec filterJson to the UNCHANGED POST /printBatches.
export const BatchSelectionPanel = React.memo(() => {
  const navigate = useNavigate();
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: "success" | "error" | "warning" }>({ open: false, message: "", severity: "success" });

  const canWrite = canWriteOrdinations();

  // --- Data layer: compose the scoped active-credential roster client-side --------------
  // RESEARCH Pattern 1: source from the campus-scoped /personOrdinations (server applies the
  // Phase-1 role scope), keep only ACTIVE rows, then join names / callings / campuses.
  const ordQuery = useQuery<PersonOrdinationInterface[]>({ queryKey: ["/personOrdinations", "MembershipApi"], placeholderData: [] });
  const activeRows = useMemo(() => (ordQuery.data ?? []).filter((o) => o.status === "active"), [ordQuery.data]);
  const personIds = useMemo(() => Array.from(new Set(activeRows.map((o) => o.personId!).filter(Boolean))), [activeRows]);

  // GET /people/ids?ids=… for the names/avatars. The `enabled` guard is REQUIRED — an empty
  // ids param 500s server-side (Pitfall 3), so we never fire it until there is ≥1 active id.
  const peopleQuery = useQuery<PersonInterface[]>({
    queryKey: ["/people/ids?ids=" + personIds.join(","), "MembershipApi"],
    enabled: personIds.length > 0,
    placeholderData: []
  });

  const types = useOrdinationTypes(); // already sortOrder-ordered
  const campuses = useCampuses();
  // Calling checkboxes = active ordination types only (an inactive vocabulary entry can't be printed).
  const callingTypes = useMemo(() => types.filter((t) => t.active !== false), [types]);

  const allRows = useMemo(() => composeRoster(activeRows, peopleQuery.data ?? [], types, campuses), [activeRows, peopleQuery.data, types, campuses]);
  const accessibleCampuses = useMemo(() => getAccessibleCampuses(activeRows, campuses), [activeRows, campuses]);

  // --- Filter state (RosterFilterSpec) with LOCKED defaults -----------------------------
  // groupBy starts "none" because campusIds starts empty; the AUTO rule below drives it once
  // the accessible campuses initialize (all pre-checked → 2+ selected → auto Location).
  const [spec, setSpec] = useState<RosterFilterSpec>({ campusIds: [], ordinationTypeIds: [], groupBy: "none", sortBy: "lastName", sortDir: "asc" });

  // Pre-check ALL accessible campuses ONCE on first resolve (LOCKED default). Guarded by a ref
  // so the operator can later clear all campuses without this effect re-filling them.
  const didInitCampuses = useRef(false);
  useEffect(() => {
    if (didInitCampuses.current) return;
    if (accessibleCampuses.length === 0) return;
    didInitCampuses.current = true;
    setSpec((s) => ({ ...s, campusIds: accessibleCampuses.map((c) => c.id).filter((id): id is string => !!id) }));
  }, [accessibleCampuses]);

  // AUTO group-by rule (LOCKED): "Auto-group by location when 2+ campuses selected; single
  // campus renders flat; explicit group-by selector (None/Location/Calling) overrides the auto
  // default." Implemented dynamically — NO static groupBy:"location" default (that would leave a
  // Location header on a single campus and fail the LOCKED "single campus renders flat" rule).
  const groupByUserOverridden = useRef(false); // flips true once the operator picks a group-by
  const lastAutoGroupBy = useRef<RosterFilterSpec["groupBy"]>("none"); // the value the auto-rule last set

  // Auto-derive: while the operator hasn't overridden, groupBy tracks the campus count. Unchecking
  // down to a single campus renders FLAT ("none"); re-checking 2+ auto-groups by Location.
  useEffect(() => {
    if (groupByUserOverridden.current) return;
    const auto: RosterFilterSpec["groupBy"] = spec.campusIds.length >= 2 ? "location" : "none";
    lastAutoGroupBy.current = auto;
    if (spec.groupBy !== auto) setSpec((s) => ({ ...s, groupBy: auto }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.campusIds.length]);

  // Override-detection: when RosterFilterPanel's onChange moves groupBy to a value the auto-rule
  // did NOT set, the operator chose it explicitly — flip the override flag so the auto-derive
  // effect early-returns thereafter and the operator's None/Location/Calling choice wins for good.
  // A campus-count-driven change never trips this because the auto-rule updates lastAutoGroupBy first.
  useEffect(() => {
    if (!groupByUserOverridden.current && spec.groupBy !== lastAutoGroupBy.current) groupByUserOverridden.current = true;
  }, [spec.groupBy]);

  const handleSendToPrintStation = useCallback(async () => {
    if (selectedPersonIds.length === 0 || isSending) return;
    setIsSending(true);
    try {
      const result = await printBatchApi.createBatch({
        personIds: Array.from(new Set(selectedPersonIds)),
        filterJson: JSON.stringify(spec)
      });
      const skipped = result.skipped || [];
      if (skipped.length > 0) {
        setToast({ open: true, message: `${skipped.length} ${skipped.length === 1 ? "person" : "people"} skipped (no active credential, template, or cropped photo). Building ${result.cardCount} card${result.cardCount === 1 ? "" : "s"}.`, severity: "warning" });
      }
      navigate("/ordinations/print-station/" + result.batchId);
    } catch (e) {
      setToast({ open: true, message: e instanceof Error ? e.message : "Unable to create the print batch", severity: "error" });
      setIsSending(false);
    }
  }, [selectedPersonIds, spec, isSending, navigate]);

  return (
    <>
      <PageHeader title={Locale.label("ordinations.printStation.title") || "Print Station"} subtitle="Filter the roster, select the ministers to print, and send them to a new batch." />
      {/* Rendering wired in Task 2. */}
      <Box sx={{ p: 3 }} data-roster-rows={allRows.length} data-accessible-campuses={accessibleCampuses.length} data-callings={callingTypes.length} data-can-write={canWrite} data-sending={isSending} data-selected={selectedPersonIds.length} data-over-cap={selectedPersonIds.length > SOFT_CAP} data-send={typeof handleSendToPrintStation} data-clear={typeof setSelectedPersonIds} data-toast={toast.open ? 1 : 0} />
    </>
  );
});
