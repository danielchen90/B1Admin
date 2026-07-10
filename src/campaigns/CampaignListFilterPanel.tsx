import React from "react";
import { Card, Box, Stack, Typography, FormGroup, FormControlLabel, Checkbox, Divider, Button, TextField, InputAdornment, IconButton } from "@mui/material";
import { Search as SearchIcon, Clear as ClearIcon } from "@mui/icons-material";
import { type CampusInterface } from "../settings/components/CampusInterface";
import { type CampaignListFilter } from "./emailTypes";

// The LOCKED campaign status vocabulary (Phase 11 — no new statuses). Rendered in
// this fixed order as multi-select checkboxes.
export const CAMPAIGN_STATUSES = ["draft", "scheduled", "sending", "sent", "failed", "canceled"] as const;

// Left-column CONTROLLED filter surface for the campaign list (Plan 12-04),
// following the project list-page-filter-style (mirrors ordinations ReportFilterPanel):
// a search field + STATUS multi-select + CAMPUS multi-select. Holds NO
// source-of-truth — it renders exactly what `filter` says and re-emits the whole
// CampaignListFilter on every change.
interface CampaignListFilterPanelProps {
  accessibleCampuses: CampusInterface[];
  filter: CampaignListFilter;
  onChange: (next: CampaignListFilter) => void;
  disabled?: boolean;
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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

export const CampaignListFilterPanel: React.FC<CampaignListFilterPanelProps> = ({ accessibleCampuses, filter, onChange, disabled }) => {
  const toggleStatus = (status: string) => {
    const next = filter.statuses.includes(status) ? filter.statuses.filter((s) => s !== status) : [...filter.statuses, status];
    onChange({ ...filter, statuses: next });
  };
  const setAllStatuses = () => onChange({ ...filter, statuses: [...CAMPAIGN_STATUSES] });
  const clearStatuses = () => onChange({ ...filter, statuses: [] });

  const toggleCampus = (id: string) => {
    const next = filter.campusIds.includes(id) ? filter.campusIds.filter((c) => c !== id) : [...filter.campusIds, id];
    onChange({ ...filter, campusIds: next });
  };
  const setAllCampuses = () => onChange({ ...filter, campusIds: accessibleCampuses.map((c) => c.id).filter((id): id is string => !!id) });
  const clearCampuses = () => onChange({ ...filter, campusIds: [] });

  const search = filter.search ?? "";

  return (
    <Card sx={{ p: 2 }}>
      <Stack spacing={2}>
        {/* SEARCH */}
        <Box>
          <TextField
            fullWidth
            size="small"
            placeholder="Search name or subject"
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
              ) : undefined
            }}
          />
        </Box>

        <Divider sx={{ borderColor: "var(--border-light)" }} />

        {/* STATUS — multi-select over the locked status set. */}
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>Status</Typography>
          <SelectAllClear onAll={setAllStatuses} onClear={clearStatuses} disabled={disabled} />
          <FormGroup>
            {CAMPAIGN_STATUSES.map((status) => (
              <FormControlLabel
                key={status}
                control={<Checkbox size="small" checked={filter.statuses.includes(status)} onChange={() => toggleStatus(status)} disabled={disabled} />}
                label={titleCase(status)}
              />
            ))}
          </FormGroup>
        </Box>

        <Divider sx={{ borderColor: "var(--border-light)" }} />

        {/* CAMPUS — multi-select over the accessible campuses. */}
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>Campuses</Typography>
          {accessibleCampuses.length === 0 ? (
            <Typography variant="body2" sx={{ color: "var(--text-muted)" }}>No accessible campuses</Typography>
          ) : (
            <>
              <SelectAllClear onAll={setAllCampuses} onClear={clearCampuses} disabled={disabled} />
              <FormGroup>
                {accessibleCampuses.map((campus) => (
                  <FormControlLabel
                    key={campus.id}
                    control={<Checkbox size="small" checked={filter.campusIds.includes(campus.id ?? "")} onChange={() => toggleCampus(campus.id ?? "")} disabled={disabled} />}
                    label={campus.name}
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
