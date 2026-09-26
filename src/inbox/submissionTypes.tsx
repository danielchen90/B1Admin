import React from "react";
import { Chip } from "@mui/material";

// Readable label + color per login-free submission type (Phase 20 prayer/contact plus the
// 2026-09 Next Steps types). One place so the list, the detail pane and the filter agree.
export const SUBMISSION_TYPES = [
  { value: "prayer", label: "Prayer", color: "#6A1B9A" },
  { value: "contact", label: "Contact", color: "#546E7A" },
  { value: "visit", label: "Plan a visit", color: "#1565C0" },
  { value: "salvation", label: "Follow Jesus", color: "#C62828" },
  { value: "baptism", label: "Baptism", color: "#00838F" },
  { value: "serve", label: "Serve", color: "#2E7D32" },
  { value: "discipleship", label: "Discipleship class", color: "#E65100" },
  // Members round: a member claimed a church record that is linked to another account.
  { value: "link_review", label: "Record link review", color: "#5D4037" }
] as const;

export type SubmissionType = (typeof SUBMISSION_TYPES)[number]["value"];

export const submissionTypeInfo = (t?: string) => SUBMISSION_TYPES.find((x) => x.value === t) ?? { value: t || "", label: t ? t.charAt(0).toUpperCase() + t.slice(1) : "Other", color: "#757575" };

export const SubmissionTypeChip: React.FC<{ type?: string; small?: boolean }> = ({ type, small }) => {
  const info = submissionTypeInfo(type);
  return (
    <Chip
      size="small"
      label={info.label}
      sx={{ bgcolor: info.color, color: "#FFF", fontWeight: 600, height: small ? 20 : undefined }}
      data-testid={"submission-type-" + (type || "other")}
    />
  );
};

// "visit" extras stored with the submission (Api `extra` JSON).
export interface VisitExtra { visitDate?: string; partySize?: number; notes?: string }

// "link_review" extras: the claimed record and the accounts involved (Api MeController claim).
export interface LinkReviewExtra { personId?: string; requestedByUserId?: string; linkedUserIds?: string[] }

export const formatVisitDate = (d?: string): string => {
  if (!d) return "";
  const date = new Date(d.slice(0, 10) + "T12:00:00");
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
};
