import React from "react";
import { Card, Box, Stack, Typography, FormGroup, FormControlLabel, Checkbox, Divider, Button, TextField, InputAdornment, IconButton } from "@mui/material";
import { Search as SearchIcon, Clear as ClearIcon } from "@mui/icons-material";
import { type CampusInterface } from "../settings/components/CampusInterface";
import { type CampaignListFilter } from "./emailTypes";

// The LOCKED campaign status vocabulary (Phase 11 — no new statuses). Rendered in
// this fixed order as multi-select checkboxes.
export const CAMPAIGN_STATUSES = ["draft", "scheduled", "sending", "sent", "failed", "canceled"] as const;

// Left-column CONTROLLED filter surface for the campaign list — the Phase-16
// activity-dashboard sidebar (HST-04), following the project list-page-filter-style
// (mirrors ordinations ReportFilterPanel): a search field + FOUR facets in fixed
// order — STATUS + CAMPUS + SENDER multi-selects + a DATE-RANGE from/to pair. Holds
// NO source-of-truth — it renders exactly what `filter` says and re-emits the whole
// CampaignListFilter on every change.
//
// CAMPUS ROLE-SCOPING (Pitfall 3): this panel is a pure renderer of whatever
// `accessibleCampuses` the CALLER passes. useCampuses() returns the church-WIDE
// campus list (NOT role-scoped), so the CALLER (CampaignListPage) is responsible for
// passing only the campuses the current user may access — never expose campuses the
// user can't see. The sender options likewise come from the caller (`senderOptions`,
// derived from the loaded DTO) — this component never derives them itself.
interface CampaignListFilterPanelProps {
  accessibleCampuses: CampusInterface[];
  // Distinct sender labels derived by the list page from the loaded campaign DTO.
  senderOptions: string[];
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

export const CampaignListFilterPanel: React.FC<CampaignListFilterPanelProps> = ({ accessibleCampuses, senderOptions, filter, onChange, disabled }) => {
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

  const toggleSender = (sender: string) => {
    const next = filter.senders.includes(sender) ? filter.senders.filter((s) => s !== sender) : [...filter.senders, sender];
    onChange({ ...filter, senders: next });
  };
  const setAllSenders = () => onChange({ ...filter, senders: [...senderOptions] });
  const clearSenders = () => onChange({ ...filter, senders: [] });

  const search = filter.search ?? "";

  return (
    <Card sx={{ p: 2 }}>
      <Stack spacing={2}>
        {/* SEARCH — subject + sender (matching happens in the list-page filter memo). */}
        <Box>
          <TextField
            fullWidth
            size="small"
            placeholder="Search subject or sender"
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

        {/* CAMPUS — multi-select over the caller-scoped accessible campuses. */}
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

        <Divider sx={{ borderColor: "var(--border-light)" }} />

        {/* SENDER — multi-select over the distinct sender labels the caller derived. */}
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>Sender</Typography>
          {senderOptions.length === 0 ? (
            <Typography variant="body2" sx={{ color: "var(--text-muted)" }}>No senders</Typography>
          ) : (
            <>
              <SelectAllClear onAll={setAllSenders} onClear={clearSenders} disabled={disabled} />
              <FormGroup>
                {senderOptions.map((sender) => (
                  <FormControlLabel
                    key={sender}
                    control={<Checkbox size="small" checked={filter.senders.includes(sender)} onChange={() => toggleSender(sender)} disabled={disabled} />}
                    label={sender}
                  />
                ))}
              </FormGroup>
            </>
          )}
        </Box>

        <Divider sx={{ borderColor: "var(--border-light)" }} />

        {/* DATE RANGE — sent/scheduled effective-date from/to (ISO yyyy-mm-dd). */}
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>Date range</Typography>
          <Stack spacing={1.5}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="From"
              InputLabelProps={{ shrink: true }}
              value={filter.dateFrom ?? ""}
              onChange={(e) => onChange({ ...filter, dateFrom: e.target.value || undefined })}
              disabled={disabled}
            />
            <TextField
              fullWidth
              size="small"
              type="date"
              label="To"
              InputLabelProps={{ shrink: true }}
              value={filter.dateTo ?? ""}
              onChange={(e) => onChange({ ...filter, dateTo: e.target.value || undefined })}
              disabled={disabled}
            />
          </Stack>
        </Box>
      </Stack>
    </Card>
  );
};
