import React from "react";
import {
  Card, Box, Stack, Typography, FormGroup, FormControlLabel, Checkbox, Divider, Button,
  TextField, InputAdornment, IconButton
} from "@mui/material";
import { Search as SearchIcon, Clear as ClearIcon } from "@mui/icons-material";
import { type CampusInterface } from "../settings/components/CampusInterface";
import { SUBMISSION_TYPES, type SubmissionType } from "./submissionTypes";

// Left-column CONTROLLED filter surface for the login-free submissions inbox (Phase 20,
// Plan 07, FRM-03). Mirrors the standard B1Admin list style (ReportFilterPanel /
// GroupsFilterPanel — sidebar filter + search + multi-select checkboxes; memory
// list-page-filter-style). Holds NO source-of-truth: it renders exactly what `spec` says
// and re-emits the whole spec on change.
//
// The Campus filter section only appears when the admin can actually see MORE THAN ONE
// campus (an org/leadership admin) — a single-campus admin has nothing to filter by
// (server-side scope already restricts them to their own campus).

export type SubmissionTypeFilter = SubmissionType;
export type ReadFilter = "unread" | "read";

export interface InboxFilterSpec {
  search: string;
  types: SubmissionTypeFilter[]; // [] = all types
  readStates: ReadFilter[]; // [] = all
  campusIds: string[]; // [] = all visible campuses
}

export const DEFAULT_INBOX_SPEC: InboxFilterSpec = {
  search: "",
  types: [],
  readStates: [],
  campusIds: []
};

const TYPE_OPTIONS: { value: SubmissionTypeFilter; label: string; color: string }[] = SUBMISSION_TYPES.map((t) => ({ value: t.value, label: t.label, color: t.color }));

const READ_OPTIONS: { value: ReadFilter; label: string }[] = [
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" }
];

interface Props {
  spec: InboxFilterSpec;
  onChange: (next: InboxFilterSpec) => void;
  /** Campuses present in the loaded submissions (server already scoped these to the admin). */
  visibleCampuses: CampusInterface[];
  disabled?: boolean;
}

export const InboxFilterPanel: React.FC<Props> = ({ spec, onChange, visibleCampuses, disabled }) => {
  const toggleType = (v: SubmissionTypeFilter) => {
    const next = spec.types.includes(v) ? spec.types.filter((t) => t !== v) : [...spec.types, v];
    onChange({ ...spec, types: next });
  };
  const toggleRead = (v: ReadFilter) => {
    const next = spec.readStates.includes(v) ? spec.readStates.filter((r) => r !== v) : [...spec.readStates, v];
    onChange({ ...spec, readStates: next });
  };
  const toggleCampus = (id: string) => {
    const next = spec.campusIds.includes(id) ? spec.campusIds.filter((c) => c !== id) : [...spec.campusIds, id];
    onChange({ ...spec, campusIds: next });
  };

  // Only offer campus filtering when the admin actually sees more than one campus.
  const showCampusFilter = visibleCampuses.length > 1;

  return (
    <Card sx={{ p: 2 }}>
      <Stack spacing={2}>
        {/* SEARCH */}
        <Box>
          <TextField
            fullWidth
            size="small"
            placeholder="Search name or message"
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

        {/* TYPE */}
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Type
          </Typography>
          <FormGroup>
            {TYPE_OPTIONS.map((o) => (
              <FormControlLabel
                key={o.value}
                control={<Checkbox size="small" checked={spec.types.includes(o.value)} onChange={() => toggleType(o.value)} disabled={disabled} data-testid={"inbox-type-filter-" + o.value} />}
                label={<Stack direction="row" spacing={1} alignItems="center"><Box component="span" sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: o.color, display: "inline-block" }} /><span>{o.label}</span></Stack>}
              />
            ))}
          </FormGroup>
        </Box>

        <Divider sx={{ borderColor: "var(--border-light)" }} />

        {/* READ / UNREAD */}
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Status
          </Typography>
          <FormGroup>
            {READ_OPTIONS.map((o) => (
              <FormControlLabel
                key={o.value}
                control={<Checkbox size="small" checked={spec.readStates.includes(o.value)} onChange={() => toggleRead(o.value)} disabled={disabled} />}
                label={o.label}
              />
            ))}
          </FormGroup>
        </Box>

        {/* CAMPUS — only when the admin sees more than one (org/leadership admin). */}
        {showCampusFilter && (
          <>
            <Divider sx={{ borderColor: "var(--border-light)" }} />
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Campus
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <Button size="small" variant="text" onClick={() => onChange({ ...spec, campusIds: visibleCampuses.map((c) => c.id ?? "").filter(Boolean) })} disabled={disabled} sx={{ minWidth: 0, px: 0.5, textTransform: "none" }}>
                  Select all
                </Button>
                <Typography variant="caption" sx={{ color: "var(--text-muted)", alignSelf: "center" }}>/</Typography>
                <Button size="small" variant="text" onClick={() => onChange({ ...spec, campusIds: [] })} disabled={disabled} sx={{ minWidth: 0, px: 0.5, textTransform: "none" }}>
                  Clear
                </Button>
              </Stack>
              <FormGroup>
                {visibleCampuses.map((campus) => (
                  <FormControlLabel
                    key={campus.id}
                    control={<Checkbox size="small" checked={spec.campusIds.includes(campus.id ?? "")} onChange={() => toggleCampus(campus.id ?? "")} disabled={disabled} />}
                    label={campus.name}
                  />
                ))}
              </FormGroup>
            </Box>
          </>
        )}
      </Stack>
    </Card>
  );
};
