import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Permissions, UserHelper } from "@churchapps/helpers";
import { Loading, PageHeader } from "@churchapps/apphelper";
import { Box, Grid, Card, List, ListItemButton, ListItemText, Typography, Chip, Stack } from "@mui/material";
import { PageBreadcrumbs } from "../components/ui";
import { useCampuses } from "../hooks/useCampuses";
import { InboxFilterPanel, DEFAULT_INBOX_SPEC, type InboxFilterSpec } from "./InboxFilterPanel";
import { SubmissionDetail } from "./SubmissionDetail";

// The login-free submissions inbox (Phase 20, Plan 07, FRM-03). A campus-scoped master-detail
// list of anonymous prayer/contact submissions in the standard B1Admin list style
// (ReportFilterPanel/GroupsFilterPanel — sidebar filter + list; memory list-page-filter-style).
//
// SCOPE IS SERVER-SIDE (20-03): the client fetches GET /formsubmissions/inbox and sends NO
// campusId for authorization — the API derives the caller's campus scope from their admin
// role, so an org/leadership admin naturally sees ALL campuses and a campus admin sees only
// theirs. This UI does ZERO scope logic; the campus filter here is a convenience over the
// rows the server already returned, never an authorization control.

// The inbox list DTO shape (20-03 loadInboxScoped): id/campusId/submissionType/
// submitterName/submissionDate/unread. The published FormSubmissionInterface predates these
// login-free columns, so a local interface carries them (avoids new tsc errors — the wire
// carries the fields regardless).
interface InboxRow {
  id?: string;
  campusId?: string | null;
  submissionType?: string;
  submitterName?: string | null;
  submissionDate?: string | Date | null;
  unread?: boolean;
}

const fmtDate = (d: string | Date | null | undefined): string => {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { dateStyle: "medium" } as any);
};

const typeLabel = (t?: string) => (t === "prayer" ? "Prayer" : t === "contact" ? "Contact" : t || "");

export const InboxPage: React.FC = () => {
  const canView = UserHelper.checkAccess(Permissions.membershipApi.forms.admin) || UserHelper.checkAccess(Permissions.membershipApi.forms.edit);

  // The server-scoped inbox read — NO campusId sent (scope is server-derived, 20-03).
  const inboxQuery = useQuery<InboxRow[]>({
    queryKey: ["/formsubmissions/inbox", "MembershipApi"],
    enabled: canView,
    placeholderData: []
  });
  const rows = useMemo(() => inboxQuery.data ?? [], [inboxQuery.data]);

  const campuses = useCampuses();
  const campusNameById = useMemo(() => {
    const map: Record<string, string> = {};
    campuses.forEach((c) => {
      if (c.id) map[c.id] = c.name ?? "";
    });
    return map;
  }, [campuses]);

  // Campuses actually present in the (already server-scoped) rows — the convenience filter
  // only offers these, and only when there is more than one.
  const visibleCampuses = useMemo(() => {
    const ids = new Set<string>();
    rows.forEach((r) => {
      if (r.campusId) ids.add(r.campusId);
    });
    return campuses.filter((c) => c.id && ids.has(c.id));
  }, [rows, campuses]);

  const [spec, setSpec] = useState<InboxFilterSpec>(DEFAULT_INBOX_SPEC);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Locally-cleared unread ids (mark-read reflects immediately without a refetch).
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const isUnread = (r: InboxRow) => !!r.unread && !readIds.has(r.id ?? "");

  const filtered = useMemo(() => {
    const q = spec.search.trim().toLowerCase();
    return rows.filter((r) => {
      if (spec.types.length > 0 && !spec.types.includes((r.submissionType as any))) return false;
      if (spec.readStates.length > 0) {
        const state = isUnread(r) ? "unread" : "read";
        if (!spec.readStates.includes(state as any)) return false;
      }
      if (spec.campusIds.length > 0 && !(r.campusId && spec.campusIds.includes(r.campusId))) return false;
      if (q) {
        const hay = (r.submitterName ?? "").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, spec, readIds]);

  const handleMarkedRead = (id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  if (!canView) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="body1">You do not have access to the submissions inbox.</Typography>
      </Box>
    );
  }

  return (
    <>
      <PageBreadcrumbs items={[{ label: "Inbox" }]} />
      <PageHeader title="Inbox" subtitle="Login-free prayer requests and contact messages from your campus pages." icon="inbox" />

      <Box sx={{ p: { xs: 1, md: 2 } }}>
        {inboxQuery.isLoading ? (
          <Loading />
        ) : (
          <Grid container spacing={2}>
            {/* Sidebar filters (standard list style). */}
            <Grid size={{ xs: 12, md: 3 }}>
              <InboxFilterPanel spec={spec} onChange={setSpec} visibleCampuses={visibleCampuses} />
            </Grid>

            {/* Master list. */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Card>
                {filtered.length === 0 ? (
                  <Box sx={{ p: 3 }}>
                    <Typography variant="body2" sx={{ color: "var(--text-muted)" }}>
                      No submissions match your filters.
                    </Typography>
                  </Box>
                ) : (
                  <List disablePadding>
                    {filtered.map((r) => {
                      const unread = isUnread(r);
                      const campusName = r.campusId ? campusNameById[r.campusId] || "" : "";
                      return (
                        <ListItemButton
                          key={r.id}
                          selected={selectedId === r.id}
                          onClick={() => setSelectedId(r.id ?? null)}
                          sx={{ borderBottom: "1px solid var(--border-light)", alignItems: "flex-start" }}
                        >
                          <ListItemText
                            primary={
                              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                                {unread && <Box component="span" sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "primary.main", flexShrink: 0 }} />}
                                <Typography component="span" sx={{ fontWeight: unread ? 700 : 400 }}>
                                  {r.submitterName || "(no name)"}
                                </Typography>
                              </Stack>
                            }
                            secondary={
                              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5, flexWrap: "wrap" }}>
                                <Chip size="small" label={typeLabel(r.submissionType)} color={r.submissionType === "prayer" ? "secondary" : "default"} sx={{ height: 20 }} />
                                {campusName && <Typography component="span" variant="caption" sx={{ color: "var(--text-muted)" }}>{campusName}</Typography>}
                                <Typography component="span" variant="caption" sx={{ color: "var(--text-muted)" }}>{fmtDate(r.submissionDate)}</Typography>
                              </Stack>
                            }
                            secondaryTypographyProps={{ component: "div" }}
                          />
                        </ListItemButton>
                      );
                    })}
                  </List>
                )}
              </Card>
            </Grid>

            {/* Detail pane. */}
            <Grid size={{ xs: 12, md: 5 }}>
              <SubmissionDetail submissionId={selectedId} campusNameById={campusNameById} onMarkedRead={handleMarkedRead} />
            </Grid>
          </Grid>
        )}
      </Box>
    </>
  );
};
