import React, { useMemo, useState } from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Permissions, UserHelper } from "@churchapps/helpers";
import { PageHeader } from "@churchapps/apphelper";
import { Alert, Avatar, Box, Button, Card, CardContent, Chip, Grid, Link, MenuItem, Pagination, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { Hub as HubIcon, Send as SendIcon, Sync as SyncIcon, Verified as VerifiedIcon } from "@mui/icons-material";
import { PageBreadcrumbs } from "../components/ui";
import { CapturePanel } from "./CapturePanel";
import { crmApi, errorText, fmtDate, type CrmTag } from "./crmApi";
import { countryName } from "./zones";

// The ministry-wide CRM: everyone with a Mary Banks ID, church members, and people met anywhere
// (Bible studies, conferences, WhatsApp). Search and filter, ask questions in plain words, and
// capture what you learn about someone.

const PAGE = 50;

const AskBox: React.FC = () => {
  const [question, setQuestion] = useState("");
  const [thread, setThread] = useState<{ role: "user" | "assistant"; content: string; people?: { id: string; name: string }[] }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const ask = async () => {
    const qn = question.trim();
    if (!qn) return;
    setBusy(true); setError("");
    const history = thread.map(({ role, content }) => ({ role, content }));
    setThread([...thread, { role: "user", content: qn }]);
    setQuestion("");
    try {
      const res = await crmApi.ask(qn, history);
      setThread((t) => [...t, { role: "assistant", content: res.answer, people: res.people }]);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  // Answers carry [[personId]] after names: show them as links.
  const render = (text: string, people: { id: string; name: string }[] = []) => {
    const known = new Set(people.map((p) => p.id));
    return text.split(/(\[\[[A-Za-z0-9_-]{6,20}\]\])/g).map((part, i) => {
      const m = part.match(/^\[\[(.+)\]\]$/);
      if (!m) return <React.Fragment key={i}>{part}</React.Fragment>;
      return known.has(m[1]) ? <Link key={i} component={RouterLink} to={`/people/${m[1]}?tab=profile`} sx={{ ml: 0.5, fontSize: 12 }}>(open)</Link> : null;
    });
  };

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>Ask the CRM</Typography>
        <Typography variant="body2" sx={{ color: "var(--text-muted)", mb: 1.5 }}>
          e.g. "What is the name of the pastor from Uganda?", "What did he ask us to pray about?", "Who in Pakistan took a course this month?"
        </Typography>
        <Box sx={{ maxHeight: 320, overflowY: "auto", mb: thread.length ? 1.5 : 0 }}>
          {thread.map((m, i) => (
            <Box key={i} sx={{ mb: 1, p: 1.25, borderRadius: 2, bgcolor: m.role === "user" ? "action.hover" : "transparent", border: m.role === "assistant" ? "1px solid var(--border-light)" : "none" }}>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{m.role === "assistant" ? render(m.content, m.people) : m.content}</Typography>
            </Box>
          ))}
          {busy && <Typography variant="body2" sx={{ color: "var(--text-muted)" }}>Looking...</Typography>}
        </Box>
        <Stack direction="row" spacing={1}>
          <TextField size="small" fullWidth placeholder="Ask about anyone" value={question} onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !busy) ask(); }} data-testid="crm-ask" />
          <Button variant="contained" onClick={ask} disabled={busy || !question.trim()}><SendIcon fontSize="small" /></Button>
          {thread.length > 0 && <Button onClick={() => setThread([])}>Clear</Button>}
        </Stack>
        {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
      </CardContent>
    </Card>
  );
};

export const CrmPage: React.FC = () => {
  const navigate = useNavigate();
  const canView = UserHelper.checkAccess(Permissions.membershipApi.people.view);
  const canEdit = UserHelper.checkAccess(Permissions.membershipApi.people.edit);
  const [filters, setFilters] = useState({ q: "", status: "", source: "", countryCode: "", tagId: "", consent: "" });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [syncing, setSyncing] = useState(false);

  const stats = useQuery<any>({ queryKey: ["crm-stats"], queryFn: crmApi.stats, enabled: canView });
  const tags = useQuery<CrmTag[]>({ queryKey: ["crm-tags"], queryFn: crmApi.tags, enabled: canView });
  const list = useQuery({
    queryKey: ["crm-people", filters, page],
    queryFn: () => crmApi.people({ ...filters, limit: PAGE, offset: (page - 1) * PAGE }),
    enabled: canView
  });

  const set = (k: keyof typeof filters, v: string) => { setFilters({ ...filters, [k]: v }); setPage(1); };
  const s = stats.data;
  const pages = Math.max(1, Math.ceil((list.data?.total || 0) / PAGE));
  const countries = useMemo(() => s?.countries || [], [s]);

  const runSync = async () => {
    setSyncing(true);
    try { await crmApi.syncRun("all"); await Promise.all([stats.refetch(), list.refetch()]); } finally { setSyncing(false); }
  };

  if (!canView) return <Box sx={{ p: 3 }}><Typography>You do not have access to the CRM.</Typography></Box>;
  if (stats.error && /org_wide_only/.test(String((stats.error as any)?.message))) {
    return <Box sx={{ p: 3 }}><Alert severity="info">The CRM covers people across the whole ministry, so it is open to staff who can see every campus.</Alert></Box>;
  }

  const stat = (label: string, value?: number) => (
    <Box sx={{ textAlign: "center", px: 1 }}>
      <Typography variant="h5" sx={{ color: "#FFF", fontWeight: 700 }}>{value === undefined ? "-" : value.toLocaleString()}</Typography>
      <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.8)" }}>{label}</Typography>
    </Box>
  );

  return (
    <>
      <PageBreadcrumbs items={[{ label: "CRM" }]} />
      <PageHeader title="CRM" subtitle="Everyone the ministry knows: Mary Banks ID accounts, members, and people met anywhere." icon={<HubIcon />}>
        <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
          {stat("people", s?.total)}
          {stat("Mary Banks IDs", s?.withMbid)}
          {stat("members", s?.members)}
          {stat("new in 30 days", s?.newLast30)}
          {stat("may contact", s?.consentYes)}
        </Stack>
      </PageHeader>

      <Box sx={{ p: { xs: 1, md: 2 } }}>
        {s && !s.ai && <Alert severity="warning" sx={{ mb: 2 }}>The AI (quick capture, summaries, Ask the CRM) needs ANTHROPIC_API_KEY on the API server.</Alert>}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={{ xs: 12, md: 6 }}><AskBox /></Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            {canEdit && <CapturePanel onSaved={(r) => navigate(`/people/${r.personId}?tab=profile`)} />}
          </Grid>
        </Grid>

        <Card>
          <CardContent>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mb: 2 }}>
              <TextField size="small" placeholder="Search name, email, phone, place, church" value={search} onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") set("q", search); }} onBlur={() => search !== filters.q && set("q", search)} sx={{ flex: 2 }} data-testid="crm-search" />
              <TextField select size="small" label="Status" value={filters.status} onChange={(e) => set("status", e.target.value)} sx={{ minWidth: 140 }}>
                <MenuItem value="">Any</MenuItem>
                {["Contact", "Visitor", "Guest", "Regular Attendee", "Member", "Staff", "Inactive"].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </TextField>
              <TextField select size="small" label="Came from" value={filters.source} onChange={(e) => set("source", e.target.value)} sx={{ minWidth: 150 }}>
                <MenuItem value="">Anywhere</MenuItem>
                <MenuItem value="mbid">Has a Mary Banks ID</MenuItem>
                <MenuItem value="church">Church records</MenuItem>
                <MenuItem value="capture">Quick capture</MenuItem>
                <MenuItem value="event">Event sign-up</MenuItem>
                <MenuItem value="globalchurch">Global Church</MenuItem>
              </TextField>
              <TextField select size="small" label="Country" value={filters.countryCode} onChange={(e) => set("countryCode", e.target.value)} sx={{ minWidth: 150 }}>
                <MenuItem value="">Any</MenuItem>
                {countries.map((c: any) => <MenuItem key={c.countryCode} value={c.countryCode}>{c.country || countryName(c.countryCode)} ({c.people})</MenuItem>)}
              </TextField>
              <TextField select size="small" label="Tag" value={filters.tagId} onChange={(e) => set("tagId", e.target.value)} sx={{ minWidth: 130 }}>
                <MenuItem value="">Any</MenuItem>
                {(tags.data || []).map((t) => <MenuItem key={t.id} value={t.id}>{t.name} ({t.people})</MenuItem>)}
              </TextField>
              <TextField select size="small" label="May contact" value={filters.consent} onChange={(e) => set("consent", e.target.value)} sx={{ minWidth: 130 }}>
                <MenuItem value="">Any</MenuItem>
                <MenuItem value="yes">Yes</MenuItem>
                <MenuItem value="no">No</MenuItem>
                <MenuItem value="unknown">Not asked</MenuItem>
              </TextField>
            </Stack>

            <Typography variant="body2" sx={{ color: "var(--text-muted)", mb: 1 }}>{(list.data?.total ?? 0).toLocaleString()} people</Typography>
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Place</TableCell>
                    <TableCell>Ministry</TableCell>
                    <TableCell>Contact</TableCell>
                    <TableCell>Last active</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(list.data?.rows || []).map((r: any) => (
                    <TableRow key={r.id} hover sx={{ cursor: "pointer" }} onClick={() => navigate(`/people/${r.id}?tab=profile`)}>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Avatar sx={{ width: 28, height: 28, fontSize: 13 }}>{(r.displayName || "?").slice(0, 1)}</Avatar>
                          <span>{r.displayName || "(no name)"}</span>
                          {r.mbidSub && <VerifiedIcon titleAccess="Has a Mary Banks ID" sx={{ fontSize: 15 }} color="primary" />}
                        </Stack>
                      </TableCell>
                      <TableCell><Chip size="small" label={r.membershipStatus || "-"} variant={r.membershipStatus === "Contact" ? "outlined" : "filled"} /></TableCell>
                      <TableCell>{[r.city, r.country || countryName(r.countryCode)].filter(Boolean).join(", ")}{r.timezone ? <Typography variant="caption" sx={{ display: "block", color: "var(--text-muted)" }}>{r.timezone}</Typography> : null}</TableCell>
                      <TableCell>{[r.ministryRole, r.organization].filter(Boolean).join(", ")}</TableCell>
                      <TableCell>
                        <Typography variant="body2">{r.email}</Typography>
                        {r.mobilePhone && <Typography variant="caption" sx={{ color: "var(--text-muted)" }}>{r.mobilePhone}</Typography>}
                      </TableCell>
                      <TableCell>{fmtDate(r.lastActiveAt || r.mbidCreatedAt || r.dateAdded)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            {pages > 1 && <Pagination sx={{ mt: 2 }} count={pages} page={page} onChange={(_, p) => setPage(p)} />}
          </CardContent>
        </Card>

        <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2, color: "var(--text-muted)" }}>
          <Typography variant="caption">
            Mary Banks ID sync: {s?.sync?.keycloak?.at ? fmtDate(s.sync.keycloak.at) + " " + new Date(s.sync.keycloak.at).toLocaleTimeString() : "not run yet"}
            {" · "}Activity: {s?.sync?.activity?.at ? fmtDate(s.sync.activity.at) + " " + new Date(s.sync.activity.at).toLocaleTimeString() : "not run yet"}
            {s?.sync?.sources?.length ? ` (${s.sync.sources.join(", ")})` : ""}
          </Typography>
          {canEdit && <Button size="small" startIcon={<SyncIcon />} onClick={runSync} disabled={syncing}>{syncing ? "Syncing..." : "Sync now"}</Button>}
        </Stack>
      </Box>
    </>
  );
};
