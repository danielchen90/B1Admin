import React from "react";
import {
  Card, Box, Stack, Typography, FormGroup, FormControlLabel, Checkbox, Divider, Button,
  ToggleButton, ToggleButtonGroup, TextField, Select, MenuItem, FormControl, InputLabel, InputAdornment, IconButton
} from "@mui/material";
import { Search as SearchIcon, Clear as ClearIcon } from "@mui/icons-material";
import { type ReportFilterSpec, type ReportGroupBy, type SortBy, type SortDir, type PaymentFilter } from "./reportTypes";
import { STATUS_ORDER } from "./reportHelpers";
import { type CampusInterface } from "../../settings/components/CampusInterface";
import { type OrdinationTypeInterface } from "../../settings/components/OrdinationTypeInterface";

// Left-column CONTROLLED filter surface for the leadership report (Plan 08-02). Generalizes
// printStation/RosterFilterPanel: adds status checkboxes, an "expiring within N days" field,
// a free-text search box, and TWO group-by selects (primary + nested). Holds NO filter
// source-of-truth: it renders exactly what `spec` says and re-emits the whole spec on change.
interface ReportFilterPanelProps {
  accessibleCampuses: CampusInterface[];
  ordinationTypes: OrdinationTypeInterface[];
  spec: ReportFilterSpec;
  onChange: (next: ReportFilterSpec) => void;
  disabled?: boolean;
}

const GROUP_BY_OPTIONS: { value: ReportGroupBy; label: string }[] = [
  { value: "none", label: "None" },
  { value: "location", label: "Location" },
  { value: "type", label: "Ordination Type" },
  { value: "status", label: "Status" }
];

const PAYMENT_OPTIONS: { value: PaymentFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "paid", label: "Paid" },
  { value: "unpaid", label: "Unpaid" },
  { value: "exempt", label: "Exempt" }
];

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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

export const ReportFilterPanel: React.FC<ReportFilterPanelProps> = ({ accessibleCampuses, ordinationTypes, spec, onChange, disabled }) => {
  const toggleCampus = (id: string) => {
    const next = spec.campusIds.includes(id) ? spec.campusIds.filter((c) => c !== id) : [...spec.campusIds, id];
    onChange({ ...spec, campusIds: next });
  };
  const setAllCampuses = () => onChange({ ...spec, campusIds: accessibleCampuses.map((c) => c.id).filter((id): id is string => !!id) });
  const clearCampuses = () => onChange({ ...spec, campusIds: [] });

  const toggleType = (id: string) => {
    const next = spec.ordinationTypeIds.includes(id) ? spec.ordinationTypeIds.filter((t) => t !== id) : [...spec.ordinationTypeIds, id];
    onChange({ ...spec, ordinationTypeIds: next });
  };
  const setAllTypes = () => onChange({ ...spec, ordinationTypeIds: ordinationTypes.map((t) => t.id).filter((id): id is string => !!id) });
  const clearTypes = () => onChange({ ...spec, ordinationTypeIds: [] });

  const toggleStatus = (status: string) => {
    const next = spec.statuses.includes(status) ? spec.statuses.filter((s) => s !== status) : [...spec.statuses, status];
    onChange({ ...spec, statuses: next });
  };
  const setAllStatuses = () => onChange({ ...spec, statuses: [...STATUS_ORDER] });
  const clearStatuses = () => onChange({ ...spec, statuses: [] });

  const setExpiring = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") return onChange({ ...spec, expiringWithinDays: null });
    const n = parseInt(trimmed, 10);
    onChange({ ...spec, expiringWithinDays: isNaN(n) || n < 0 ? null : n });
  };

  const setPaymentStatus = (value: PaymentFilter) => onChange({ ...spec, paymentStatus: value });

  const setGroupBy1 = (value: ReportGroupBy) => onChange({ ...spec, groupBy1: value });
  const setGroupBy2 = (value: ReportGroupBy) => onChange({ ...spec, groupBy2: value });
  const setSortBy = (value: SortBy | null) => {
    if (value) onChange({ ...spec, sortBy: value });
  };
  const setSortDir = (value: SortDir | null) => {
    if (value) onChange({ ...spec, sortDir: value });
  };

  return (
    <Card sx={{ p: 2 }}>
      <Stack spacing={2}>
        {/* SEARCH */}
        <Box>
          <TextField
            fullWidth
            size="small"
            placeholder="Search name or credential #"
            value={spec.search}
            onChange={(e) => onChange({ ...spec, search: e.target.value })}
            disabled={disabled}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: spec.search ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => onChange({ ...spec, search: "" })} disabled={disabled} aria-label="Clear search">
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : undefined
            }}
          />
        </Box>

        <Divider sx={{ borderColor: "var(--border-light)" }} />

        {/* LOCATION */}
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

        {/* ORDINATION TYPES — also scopes Print Licenses: only checked types are printed. */}
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Ordination Types
          </Typography>
          <Typography variant="caption" sx={{ color: "var(--text-muted)", display: "block", mb: 0.5 }}>
            Print Licenses prints only the checked types. Leave all unchecked to print every credential a person holds.
          </Typography>
          {ordinationTypes.length === 0 ? (
            <Typography variant="body2" sx={{ color: "var(--text-muted)" }}>
              No ordination types available
            </Typography>
          ) : (
            <>
              <SelectAllClear onAll={setAllTypes} onClear={clearTypes} disabled={disabled} />
              <FormGroup>
                {ordinationTypes.map((type) => (
                  <FormControlLabel
                    key={type.id}
                    control={<Checkbox size="small" checked={spec.ordinationTypeIds.includes(type.id ?? "")} onChange={() => toggleType(type.id ?? "")} disabled={disabled} />}
                    label={type.name}
                  />
                ))}
              </FormGroup>
            </>
          )}
        </Box>

        <Divider sx={{ borderColor: "var(--border-light)" }} />

        {/* STATUS — STATUS_ORDER, title-cased, default ALL selected (owned by parent). */}
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Status
          </Typography>
          <SelectAllClear onAll={setAllStatuses} onClear={clearStatuses} disabled={disabled} />
          <FormGroup>
            {STATUS_ORDER.map((status) => (
              <FormControlLabel
                key={status}
                control={<Checkbox size="small" checked={spec.statuses.includes(status)} onChange={() => toggleStatus(status)} disabled={disabled} />}
                label={titleCase(status)}
              />
            ))}
          </FormGroup>
        </Box>

        <Divider sx={{ borderColor: "var(--border-light)" }} />

        {/* PAYMENT — single-choice filter (all/paid/unpaid/exempt), default All. */}
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            Payment
          </Typography>
          <FormControl size="small" fullWidth disabled={disabled}>
            <InputLabel id="report-payment-label">Payment</InputLabel>
            <Select
              labelId="report-payment-label"
              label="Payment"
              value={spec.paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value as PaymentFilter)}>
              {PAYMENT_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Divider sx={{ borderColor: "var(--border-light)" }} />

        {/* EXPIRATION WINDOW */}
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Expiring within
          </Typography>
          <TextField
            size="small"
            type="number"
            value={spec.expiringWithinDays ?? ""}
            onChange={(e) => setExpiring(e.target.value)}
            disabled={disabled}
            placeholder="Any"
            slotProps={{ htmlInput: { min: 0 } }}
            InputProps={{ endAdornment: <InputAdornment position="end">days</InputAdornment> }}
            sx={{ width: 160 }}
          />
          {spec.expiringWithinDays != null && (
            <Button size="small" variant="text" onClick={() => onChange({ ...spec, expiringWithinDays: null })} disabled={disabled} sx={{ ml: 1, textTransform: "none" }}>
              Clear
            </Button>
          )}
        </Box>

        <Divider sx={{ borderColor: "var(--border-light)" }} />

        {/* GROUP BY — TWO selects: primary + nested secondary. */}
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            Group by
          </Typography>
          <Stack spacing={1.5}>
            <FormControl size="small" fullWidth disabled={disabled}>
              <InputLabel id="report-groupby1-label">Primary</InputLabel>
              <Select
                labelId="report-groupby1-label"
                label="Primary"
                value={spec.groupBy1}
                onChange={(e) => setGroupBy1(e.target.value as ReportGroupBy)}>
                {GROUP_BY_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth disabled={disabled || spec.groupBy1 === "none"}>
              <InputLabel id="report-groupby2-label">Then by</InputLabel>
              <Select
                labelId="report-groupby2-label"
                label="Then by"
                value={spec.groupBy2}
                onChange={(e) => setGroupBy2(e.target.value as ReportGroupBy)}>
                {GROUP_BY_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </Box>

        <Divider sx={{ borderColor: "var(--border-light)" }} />

        {/* SORT */}
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Sort by
          </Typography>
          <Stack spacing={1}>
            <ToggleButtonGroup exclusive size="small" value={spec.sortBy} onChange={(_e, v) => setSortBy(v as SortBy | null)} disabled={disabled}>
              <ToggleButton value="lastName" sx={{ textTransform: "none" }}>
                Last name
              </ToggleButton>
              <ToggleButton value="firstName" sx={{ textTransform: "none" }}>
                First name
              </ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup exclusive size="small" value={spec.sortDir} onChange={(_e, v) => setSortDir(v as SortDir | null)} disabled={disabled}>
              <ToggleButton value="asc" sx={{ textTransform: "none" }}>
                A–Z
              </ToggleButton>
              <ToggleButton value="desc" sx={{ textTransform: "none" }}>
                Z–A
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </Box>
      </Stack>
    </Card>
  );
};
