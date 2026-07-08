import React from "react";
import { Card, Stack, Box, Typography, Divider, TextField, InputAdornment, IconButton, FormGroup, FormControlLabel, Checkbox, Button } from "@mui/material";
import { Search as SearchIcon, Clear as ClearIcon } from "@mui/icons-material";

// Sidebar filter for the Groups list, modeled on the ordination LeadershipReport's
// ReportFilterPanel: a controlled Card with a search box and independent multi-select
// checkbox groups (Scope / Campus), each visually separated by a divider.
// The Scope group's "Org-wide" option is the explicit way to isolate groups that have
// no campus. (Auxiliaries are intentionally not surfaced here — manage/view them in the
// dedicated Auxiliaries area.)

export interface GroupsFilterSpec {
  search: string;
  scopes: string[]; // "campus" | "orgwide"; empty = all
  campusIds: string[]; // empty = all
}

export const EMPTY_GROUPS_FILTER: GroupsFilterSpec = { search: "", scopes: [], campusIds: [] };

const SCOPE_OPTIONS: { id: string; label: string }[] = [
  { id: "campus", label: "Campus-scoped" },
  { id: "orgwide", label: "Org-wide (no campus)" }
];

// Match a single group against the spec. Within a checkbox group the selections are
// OR'd (any match); across the two groups (and the search box) they are AND'd. An
// empty group means "no constraint" so nothing is hidden until a box is ticked.
export const matchesGroupsFilter = (g: any, spec: GroupsFilterSpec): boolean => {
  const term = spec.search.trim().toLowerCase();
  if (term && !(g.name || "").toLowerCase().includes(term) && !(g.categoryName || "").toLowerCase().includes(term)) return false;
  if (spec.scopes.length) {
    const ok = spec.scopes.some((s) => (s === "campus" ? !!g.campusId : !g.campusId));
    if (!ok) return false;
  }
  if (spec.campusIds.length && !spec.campusIds.includes(g.campusId)) return false;
  return true;
};

export const activeGroupsFilterCount = (spec: GroupsFilterSpec): number =>
  (spec.search.trim() ? 1 : 0) + spec.scopes.length + spec.campusIds.length;

const SelectAllClear: React.FC<{ onAll: () => void; onClear: () => void }> = ({ onAll, onClear }) => (
  <Stack direction="row" spacing={1} sx={{ mb: 0.5 }}>
    <Button size="small" variant="text" onClick={onAll} sx={{ minWidth: 0, px: 0.5, textTransform: "none" }}>Select all</Button>
    <Typography variant="caption" sx={{ color: "var(--text-muted)", alignSelf: "center" }}>/</Typography>
    <Button size="small" variant="text" onClick={onClear} sx={{ minWidth: 0, px: 0.5, textTransform: "none" }}>Clear</Button>
  </Stack>
);

const CheckboxGroup: React.FC<{
  title: string;
  options: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  onAll: () => void;
  onClear: () => void;
}> = ({ title, options, selected, onToggle, onAll, onClear }) => (
  <Box>
    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>{title}</Typography>
    {options.length === 0 ? (
      <Typography variant="body2" sx={{ color: "var(--text-muted)" }}>None available</Typography>
    ) : (
      <>
        <SelectAllClear onAll={onAll} onClear={onClear} />
        <FormGroup>
          {options.map((o) => (
            <FormControlLabel
              key={o.id}
              control={<Checkbox size="small" checked={selected.includes(o.id)} onChange={() => onToggle(o.id)} />}
              label={<Typography variant="body2">{o.label}</Typography>}
            />
          ))}
        </FormGroup>
      </>
    )}
  </Box>
);

interface GroupsFilterPanelProps {
  spec: GroupsFilterSpec;
  onChange: (next: GroupsFilterSpec) => void;
  campuses: { id: string; name: string }[];
}

export const GroupsFilterPanel: React.FC<GroupsFilterPanelProps> = ({ spec, onChange, campuses }) => {
  const toggle = (key: "scopes" | "campusIds", id: string) => {
    const arr = spec[key];
    onChange({ ...spec, [key]: arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id] });
  };
  const setAll = (key: "scopes" | "campusIds", ids: string[]) => onChange({ ...spec, [key]: ids });
  const clear = (key: "scopes" | "campusIds") => onChange({ ...spec, [key]: [] });

  const campusOptions = campuses.map((c) => ({ id: c.id, label: c.name }));
  const hasActive = activeGroupsFilterCount(spec) > 0;

  return (
    <Card sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Filters</Typography>
          {hasActive && (
            <Button size="small" variant="text" onClick={() => onChange(EMPTY_GROUPS_FILTER)} sx={{ minWidth: 0, px: 0.5, textTransform: "none" }}>Reset all</Button>
          )}
        </Stack>

        <TextField
          fullWidth
          size="small"
          placeholder="Search name or category"
          value={spec.search}
          onChange={(e) => onChange({ ...spec, search: e.target.value })}
          InputProps={{
            startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>),
            endAdornment: spec.search ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => onChange({ ...spec, search: "" })} aria-label="Clear search"><ClearIcon fontSize="small" /></IconButton>
              </InputAdornment>
            ) : undefined
          }}
        />

        <Divider sx={{ borderColor: "var(--border-light)" }} />
        <CheckboxGroup title="Scope" options={SCOPE_OPTIONS} selected={spec.scopes} onToggle={(id) => toggle("scopes", id)} onAll={() => setAll("scopes", SCOPE_OPTIONS.map((o) => o.id))} onClear={() => clear("scopes")} />

        <Divider sx={{ borderColor: "var(--border-light)" }} />
        <CheckboxGroup title="Campus" options={campusOptions} selected={spec.campusIds} onToggle={(id) => toggle("campusIds", id)} onAll={() => setAll("campusIds", campusOptions.map((o) => o.id))} onClear={() => clear("campusIds")} />
      </Stack>
    </Card>
  );
};
