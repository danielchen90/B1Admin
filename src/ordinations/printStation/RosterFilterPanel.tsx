import React from "react";
import { Card, Box, Stack, Typography, FormGroup, FormControlLabel, Checkbox, Divider, Button } from "@mui/material";
import { type RosterFilterSpec } from "./rosterTypes";
import { type CampusInterface } from "../../settings/components/CampusInterface";
import { type OrdinationTypeInterface } from "../../settings/components/OrdinationTypeInterface";

// Left-column CONTROLLED filter surface for the enhanced print-station roster (Plan 02).
//
// This purpose-built panel replaces the reused ChurchApps <PeopleSearch> in the 3/9 Grid
// split (LOCKED). It holds NO filter source-of-truth of its own: it renders exactly what the
// passed-in `spec` says and reports every change via `onChange(nextSpec)`. Plan 04's
// orchestrator owns the defaults (all campuses pre-checked, all callings, auto group-by
// location when 2+ campuses) and the resulting `filterJson` provenance.
interface RosterFilterPanelProps {
  accessibleCampuses: CampusInterface[]; // derived by parent (Plan 01 getAccessibleCampuses)
  callingTypes: OrdinationTypeInterface[]; // active ordination types, sortOrder-ordered
  spec: RosterFilterSpec; // current filter (parent owns source of truth)
  onChange: (next: RosterFilterSpec) => void;
  disabled?: boolean; // e.g. while sending a batch
}

// A tight "Select all / Clear" affordance shared by both checkbox sections.
const SelectAllClear: React.FC<{ onAll: () => void; onClear: () => void; disabled?: boolean }> = ({ onAll, onClear, disabled }) => (
  <Stack direction="row" spacing={1} sx={{ mb: 0.5 }}>
    <Button size="small" variant="text" onClick={onAll} disabled={disabled} sx={{ minWidth: 0, px: 0.5, textTransform: "none" }}>
      Select all
    </Button>
    <Typography variant="caption" sx={{ color: "var(--text-muted)", alignSelf: "center" }}>
      /
    </Typography>
    <Button size="small" variant="text" onClick={onClear} disabled={disabled} sx={{ minWidth: 0, px: 0.5, textTransform: "none" }}>
      Clear
    </Button>
  </Stack>
);

export const RosterFilterPanel: React.FC<RosterFilterPanelProps> = ({ accessibleCampuses, callingTypes, spec, onChange, disabled }) => {
  // Immutable helpers: every mutation clones the array and re-emits the whole spec so the
  // parent stays the single source of truth (no internal useState for filter values).
  const toggleCampus = (id: string) => {
    const next = spec.campusIds.includes(id) ? spec.campusIds.filter((c) => c !== id) : [...spec.campusIds, id];
    onChange({ ...spec, campusIds: next });
  };
  const setAllCampuses = () => onChange({ ...spec, campusIds: accessibleCampuses.map((c) => c.id).filter((id): id is string => !!id) });
  const clearCampuses = () => onChange({ ...spec, campusIds: [] });

  const toggleCalling = (id: string) => {
    const next = spec.ordinationTypeIds.includes(id) ? spec.ordinationTypeIds.filter((c) => c !== id) : [...spec.ordinationTypeIds, id];
    onChange({ ...spec, ordinationTypeIds: next });
  };
  const setAllCallings = () => onChange({ ...spec, ordinationTypeIds: callingTypes.map((t) => t.id).filter((id): id is string => !!id) });
  // NOTE: an EMPTY ordinationTypeIds means "all callings, no filter" per Plan 01 filterRoster
  // semantics — so Clear intentionally shows the full population, not an empty roster.
  const clearCallings = () => onChange({ ...spec, ordinationTypeIds: [] });

  return (
    <Card sx={{ p: 2 }}>
      <Stack spacing={2}>
        {/* LOCATION section — multi-select campus checkboxes (never a single-select dropdown). */}
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Locations
          </Typography>
          {accessibleCampuses.length === 0 ? (
            <Typography variant="body2" sx={{ color: "var(--text-muted)" }}>
              No accessible locations
            </Typography>
          ) : (
            <>
              <SelectAllClear onAll={setAllCampuses} onClear={clearCampuses} disabled={disabled} />
              <FormGroup>
                {accessibleCampuses.map((campus) => (
                  <FormControlLabel
                    key={campus.id}
                    control={<Checkbox size="small" checked={spec.campusIds.includes(campus.id ?? "")} onChange={() => toggleCampus(campus.id ?? "")} disabled={disabled} />}
                    label={campus.name}
                  />
                ))}
              </FormGroup>
            </>
          )}
        </Box>

        <Divider sx={{ borderColor: "var(--border-light)" }} />

        {/* CALLING section — multi-select ordination-type checkboxes (empty = all callings). */}
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Callings
          </Typography>
          {callingTypes.length === 0 ? (
            <Typography variant="body2" sx={{ color: "var(--text-muted)" }}>
              No callings available
            </Typography>
          ) : (
            <>
              <SelectAllClear onAll={setAllCallings} onClear={clearCallings} disabled={disabled} />
              <FormGroup>
                {callingTypes.map((type) => (
                  <FormControlLabel
                    key={type.id}
                    control={<Checkbox size="small" checked={spec.ordinationTypeIds.includes(type.id ?? "")} onChange={() => toggleCalling(type.id ?? "")} disabled={disabled} />}
                    label={type.name}
                  />
                ))}
              </FormGroup>
            </>
          )}
        </Box>
      </Stack>
    </Card>
  );
};
