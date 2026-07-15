import React from "react";
import { Card, Box, Stack, Typography, FormGroup, FormControlLabel, Checkbox, Divider, Button, TextField, InputAdornment, IconButton } from "@mui/material";
import { Search as SearchIcon, Clear as ClearIcon } from "@mui/icons-material";

// The controlled filter state for the Saved Audiences list (Plan 18-04). Facets are
// OR-within (any of the picked values matches) and AND-across (a row must satisfy
// every non-empty facet) — the project list-page-filter-style behavior. An empty
// array = that facet is off.
export interface SavedAudienceFilter {
  search?: string;
  // Audience type: church / campus / group / auxiliary / people.
  types: string[];
  // Availability: "available" (target resolves) / "stale" (target missing).
  availability: string[];
}

// The audience types offered as a facet, in a fixed order.
export const AUDIENCE_TYPE_FACETS: { value: string; label: string }[] = [
  { value: "church", label: "Whole church" },
  { value: "campus", label: "A campus" },
  { value: "group", label: "A group" },
  { value: "auxiliary", label: "An auxiliary" },
  { value: "people", label: "Specific people" },
];

// The availability facet options (stale = the saved target no longer resolves).
export const AVAILABILITY_FACETS: { value: string; label: string }[] = [
  { value: "available", label: "Available" },
  { value: "stale", label: "Stale" },
];

// Left-column CONTROLLED filter surface for the Saved Audiences list — the standard
// B1Admin list-page-filter-style sidebar (mirrors CampaignListFilterPanel): a search
// field + TWO multi-select facets in fixed order — audience TYPE + AVAILABILITY. Holds
// NO source-of-truth — it renders exactly what `filter` says and re-emits the whole
// SavedAudienceFilter on every change.
interface SavedAudienceFilterPanelProps {
  filter: SavedAudienceFilter;
  onChange: (next: SavedAudienceFilter) => void;
  disabled?: boolean;
}

const SelectAllClear: React.FC<{ onAll: () => void; onClear: () => void; disabled?: boolean }> = ({ onAll, onClear, disabled }) => (
  <Stack direction="row" spacing={1} sx={{ mb: 0.5 }}>
    <Button size="small" variant="text" onClick={onAll} disabled={disabled} sx={{ minWidth: 0, px: 0.5, textTransform: "none" }}>
      Select all
    </Button>
    <Typography variant="caption" sx={{ color: "var(--text-muted)", alignSelf: "center" }}>/</Typography>
    <Button size="small" variant="text" onClick={onClear} disabled={disabled} sx={{ minWidth: 0, px: 0.5, textTransform: "none" }}>
      Clear
    </Button>
  </Stack>
);

export const SavedAudienceFilterPanel: React.FC<SavedAudienceFilterPanelProps> = ({ filter, onChange, disabled }) => {
  const toggleType = (type: string) => {
    const next = filter.types.includes(type) ? filter.types.filter((t) => t !== type) : [...filter.types, type];
    onChange({ ...filter, types: next });
  };
  const setAllTypes = () => onChange({ ...filter, types: AUDIENCE_TYPE_FACETS.map((t) => t.value) });
  const clearTypes = () => onChange({ ...filter, types: [] });

  const toggleAvailability = (value: string) => {
    const next = filter.availability.includes(value) ? filter.availability.filter((a) => a !== value) : [...filter.availability, value];
    onChange({ ...filter, availability: next });
  };
  const setAllAvailability = () => onChange({ ...filter, availability: AVAILABILITY_FACETS.map((a) => a.value) });
  const clearAvailability = () => onChange({ ...filter, availability: [] });

  const search = filter.search ?? "";

  return (
    <Card sx={{ p: 2 }}>
      <Stack spacing={2}>
        {/* SEARCH — label (matching happens in the list-page filter memo). */}
        <Box>
          <TextField
            fullWidth
            size="small"
            placeholder="Search saved audiences"
            value={search}
            onChange={(e) => onChange({ ...filter, search: e.target.value })}
            disabled={disabled}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => onChange({ ...filter, search: "" })} disabled={disabled} aria-label="Clear search">
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : undefined,
            }}
          />
        </Box>

        <Divider sx={{ borderColor: "var(--border-light)" }} />

        {/* AUDIENCE TYPE — multi-select over the saved-audience type vocabulary. */}
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>Audience type</Typography>
          <SelectAllClear onAll={setAllTypes} onClear={clearTypes} disabled={disabled} />
          <FormGroup>
            {AUDIENCE_TYPE_FACETS.map((t) => (
              <FormControlLabel
                key={t.value}
                control={<Checkbox size="small" checked={filter.types.includes(t.value)} onChange={() => toggleType(t.value)} disabled={disabled} />}
                label={t.label}
              />
            ))}
          </FormGroup>
        </Box>

        <Divider sx={{ borderColor: "var(--border-light)" }} />

        {/* AVAILABILITY — available vs stale (the saved target no longer resolves). */}
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>Availability</Typography>
          <SelectAllClear onAll={setAllAvailability} onClear={clearAvailability} disabled={disabled} />
          <FormGroup>
            {AVAILABILITY_FACETS.map((a) => (
              <FormControlLabel
                key={a.value}
                control={<Checkbox size="small" checked={filter.availability.includes(a.value)} onChange={() => toggleAvailability(a.value)} disabled={disabled} />}
                label={a.label}
              />
            ))}
          </FormGroup>
        </Box>
      </Stack>
    </Card>
  );
};

export default SavedAudienceFilterPanel;
