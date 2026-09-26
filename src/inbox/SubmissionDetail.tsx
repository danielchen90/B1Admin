import React from "react";
import { Card, CardContent, Box, Stack, Typography, Chip, Button, CircularProgress, Divider, Link } from "@mui/material";
import { ApiHelper } from "@churchapps/apphelper";
import { SubmissionTypeChip, formatVisitDate, type VisitExtra } from "./submissionTypes";

// Detail pane for the login-free submissions inbox (Phase 20, Plan 07, FRM-03). Fetches
// GET /formsubmissions/inbox/:id (the 20-03 scoped detail read — an out-of-scope or absent
// id 404s server-side, never leaking another campus's row) and shows the full submission:
// name / email / phone / message + campus + type + date. A "Mark read" action posts to
// POST /formsubmissions/inbox/:id/read (scope-guarded server-side). The client does NO
// scope logic — scope is entirely server-derived (20-03).

export interface InboxDetailDto {
  id?: string;
  campusId?: string | null;
  submissionType?: string;
  submitterName?: string | null;
  submitterEmail?: string | null;
  submitterPhone?: string | null;
  message?: string | null;
  submissionDate?: string | Date | null;
  unread?: boolean;
  extra?: VisitExtra | null;
}

interface Props {
  submissionId: string | null;
  /** campusId → display name, resolved from the church campus list. */
  campusNameById: Record<string, string>;
  /** Called after a successful mark-read so the list can clear the unread state. */
  onMarkedRead: (id: string) => void;
}

const fmtDate = (d: string | Date | null | undefined): string => {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

export const SubmissionDetail: React.FC<Props> = ({ submissionId, campusNameById, onMarkedRead }) => {
  const [detail, setDetail] = React.useState<InboxDetailDto | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [marking, setMarking] = React.useState(false);

  React.useEffect(() => {
    if (!submissionId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    ApiHelper.get("/formsubmissions/inbox/" + submissionId, "MembershipApi")
      .then((data: InboxDetailDto) => {
        if (!cancelled) setDetail(data && data.id ? data : null);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  const handleMarkRead = async () => {
    if (!submissionId || marking) return;
    setMarking(true);
    try {
      await ApiHelper.post("/formsubmissions/inbox/" + submissionId + "/read", {}, "MembershipApi");
      setDetail((d) => (d ? { ...d, unread: false } : d));
      onMarkedRead(submissionId);
    } catch {
      // swallow — a scope-guarded miss 404s; the list simply keeps its state.
    } finally {
      setMarking(false);
    }
  };

  if (!submissionId) {
    return (
      <Card sx={{ height: "100%", minHeight: 320 }}>
        <CardContent>
          <Typography variant="body2" sx={{ color: "var(--text-muted)" }}>
            Select a submission to read it.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card sx={{ height: "100%", minHeight: 320 }}>
        <CardContent>
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (!detail) {
    return (
      <Card sx={{ height: "100%", minHeight: 320 }}>
        <CardContent>
          <Typography variant="body2" sx={{ color: "var(--text-muted)" }}>
            This submission is no longer available.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const campusName = detail.campusId ? campusNameById[detail.campusId] || "" : "";

  return (
    <Card sx={{ minHeight: 320 }}>
      <CardContent>
        <Stack spacing={2}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <SubmissionTypeChip type={detail.submissionType} />
              {campusName && <Chip size="small" variant="outlined" label={campusName} />}
              {detail.unread && <Chip size="small" color="primary" label="Unread" />}
            </Stack>
            {detail.unread && (
              <Button size="small" variant="outlined" onClick={handleMarkRead} disabled={marking} startIcon={marking ? <CircularProgress size={14} /> : undefined}>
                Mark read
              </Button>
            )}
          </Box>

          <Box>
            <Typography variant="h6" sx={{ mb: 0.25 }}>
              {detail.submitterName || "(no name)"}
            </Typography>
            <Typography variant="caption" sx={{ color: "var(--text-muted)" }}>
              {fmtDate(detail.submissionDate)}
            </Typography>
          </Box>

          <Divider sx={{ borderColor: "var(--border-light)" }} />

          <Stack spacing={0.75}>
            {detail.submitterEmail && (
              <Typography variant="body2">
                <strong>Email:</strong> <Link href={"mailto:" + detail.submitterEmail}>{detail.submitterEmail}</Link>
              </Typography>
            )}
            {detail.submitterPhone && (
              <Typography variant="body2">
                <strong>Phone:</strong> <Link href={"tel:" + detail.submitterPhone}>{detail.submitterPhone}</Link>
              </Typography>
            )}
          </Stack>

          {detail.submissionType === "visit" && detail.extra && (detail.extra.visitDate || detail.extra.partySize || detail.extra.notes) && (
            <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: "rgba(21, 101, 192, 0.06)", border: "1px solid rgba(21, 101, 192, 0.25)" }} data-testid="visit-details">
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>Visit details</Typography>
              <Stack spacing={0.5}>
                {detail.extra.visitDate && <Typography variant="body2"><strong>Planning to visit:</strong> {formatVisitDate(detail.extra.visitDate)}</Typography>}
                {detail.extra.partySize && <Typography variant="body2"><strong>Party size:</strong> {detail.extra.partySize} {detail.extra.partySize === 1 ? "person" : "people"}</Typography>}
                {detail.extra.notes && <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}><strong>Notes:</strong> {detail.extra.notes}</Typography>}
              </Stack>
            </Box>
          )}

          {detail.message && (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Message
              </Typography>
              <Typography variant="body1" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                {detail.message}
              </Typography>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};
