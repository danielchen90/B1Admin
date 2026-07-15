// The reusable descriptor edit controls (Plan 18-02).
//
// Extracted VERBATIM from AudienceTab's right-card "Edit audience" block so the
// manage-view editor (Plan 04) reuses the EXACT same type dropdown + conditional
// campus/group/auxiliary target selects CONTEXT requires. This is a controlled,
// presentational component — it owns NO descriptor state; every change emits
// through onChange, matching AudienceTab's derived-state pattern (the descriptor
// is parsed from the draft's audienceFilterJson each render).
//
// AUDIENCE_TYPES + TARGETED_TYPES live here as the single source of truth both
// consumers import, so the tab and the manage editor can never drift.

import React from "react";
import { Stack, TextField, MenuItem, Button, Typography } from "@mui/material";
import { type AudienceDescriptor } from "./emailTypes";

// The selectable audience types, in the order the dropdown offers them.
export const AUDIENCE_TYPES: { value: AudienceDescriptor["type"]; label: string }[] = [
  { value: "church", label: "Whole church" },
  { value: "campus", label: "A campus" },
  { value: "group", label: "A group" },
  { value: "auxiliary", label: "An auxiliary" },
  { value: "people", label: "Specific people" },
];

// Types that resolve from a targetId (campus/group/auxiliary point at one record).
export const TARGETED_TYPES: AudienceDescriptor["type"][] = ["campus", "group", "auxiliary"];

// Loose named-record shapes matching the hooks' Campus/Group/Auxiliary rows —
// only id + name are read (groups also carry an optional categoryName for the
// grouped label). `name` is optional so the interfaces assign without a cast.
interface CampusOption { id?: string; name?: string }
interface GroupOption { id?: string; name?: string; categoryName?: string }
interface AuxiliaryOption { id?: string; name?: string }

export interface AudienceDescriptorControlsProps {
  descriptor: AudienceDescriptor;
  onChange: (next: AudienceDescriptor) => void;
  campuses: CampusOption[];
  groups: GroupOption[];
  auxiliaries: AuxiliaryOption[];
  // Disable every control (AudienceTab passes !editable; the manage view uses it
  // for read states). Also gates the explicit-people "clear" affordance.
  disabled?: boolean;
}

export const AudienceDescriptorControls: React.FC<AudienceDescriptorControlsProps> = ({
  descriptor,
  onChange,
  campuses,
  groups,
  auxiliaries,
  disabled = false,
}) => {
  // Switch the audience type. Dropping to a coarse type clears the now-irrelevant
  // targetId / personIds so the descriptor never carries stale carriers. (Campus-
  // target preservation lived in AudienceTab because it needed draft.campusId;
  // that stays in the tab's handler and is passed in as the already-built next.)
  const handleTypeChange = (type: AudienceDescriptor["type"]) => {
    if (type === "people") {
      onChange({ type: "people", personIds: descriptor.personIds ?? [] });
    } else if (TARGETED_TYPES.includes(type)) {
      onChange({ type });
    } else {
      onChange({ type });
    }
  };

  const handleTargetIdChange = (targetId: string) => {
    onChange({ ...descriptor, targetId: targetId || undefined });
  };

  // Clear the explicit-people carry — falls back to an editable whole-church
  // filter the user can then re-scope (broaden/replace).
  const handleClearPeople = () => onChange({ type: "church" });

  if (descriptor.type === "people") {
    return (
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          This campaign targets an explicit set of{" "}
          {(descriptor.personIds?.length ?? 0).toLocaleString()} selected people
          (still campus-scoped when it sends).
        </Typography>
        <Button
          variant="outlined"
          size="small"
          disabled={disabled}
          onClick={handleClearPeople}
          data-testid="audience-clear-people"
        >
          Clear selection &amp; pick an audience instead
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <TextField
        select
        label="Send to"
        size="small"
        fullWidth
        value={descriptor.type}
        disabled={disabled}
        onChange={(e) => handleTypeChange(e.target.value as AudienceDescriptor["type"])}
        data-testid="audience-type"
      >
        {AUDIENCE_TYPES.map((t) => (
          <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
        ))}
      </TextField>

      {descriptor.type === "campus" && (
        <TextField
          select
          label="Campus"
          size="small"
          fullWidth
          value={descriptor.targetId ?? ""}
          disabled={disabled}
          onChange={(e) => handleTargetIdChange(e.target.value)}
          data-testid="audience-campus"
        >
          <MenuItem value="">All campuses in scope</MenuItem>
          {campuses.map((c) => (
            <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
          ))}
        </TextField>
      )}

      {descriptor.type === "group" && (
        <TextField
          select
          label="Group"
          size="small"
          fullWidth
          value={groups.some((g) => g.id === descriptor.targetId) ? descriptor.targetId : ""}
          disabled={disabled}
          onChange={(e) => handleTargetIdChange(e.target.value)}
          helperText="The group to send to. Re-resolved to its current members at send."
          data-testid="audience-group"
        >
          <MenuItem value="">Select a group…</MenuItem>
          {groups
            .slice()
            .sort((a, b) =>
              (a.categoryName ?? "").localeCompare(b.categoryName ?? "") ||
              (a.name ?? "").localeCompare(b.name ?? "")
            )
            .map((g) => (
              <MenuItem key={g.id} value={g.id}>
                {g.categoryName ? `${g.categoryName} — ${g.name}` : g.name}
              </MenuItem>
            ))}
        </TextField>
      )}

      {descriptor.type === "auxiliary" && (
        <TextField
          select
          label="Auxiliary"
          size="small"
          fullWidth
          value={auxiliaries.some((a) => a.id === descriptor.targetId) ? descriptor.targetId : ""}
          disabled={disabled}
          onChange={(e) => handleTargetIdChange(e.target.value)}
          helperText="The auxiliary to send to. Re-resolved to its current members at send."
          data-testid="audience-auxiliary"
        >
          <MenuItem value="">Select an auxiliary…</MenuItem>
          {auxiliaries
            .slice()
            .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
            .map((a) => (
              <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>
            ))}
        </TextField>
      )}

      <Typography variant="caption" color="text.secondary">
        Broaden, narrow, or replace the audience any time before you send.
        The count on the left updates to match.
      </Typography>
    </Stack>
  );
};

export default AudienceDescriptorControls;
