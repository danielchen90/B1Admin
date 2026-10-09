import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Box, Button, Card, CardContent, Chip, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { Download as DownloadIcon } from "@mui/icons-material";
import { fmtDate } from "../crmApi";
import { countryName, wallTime } from "../zones";
import { eventsApi, type CrmEvent } from "./eventsApi";

// Who registered: by country, language and role at a glance, the full list (with each person's
// local start time), status changes (attended / cancelled) and a CSV for spreadsheets.

const csvCell = (v: any) => `"${String(v ?? "").replace(/"/g, "\"\"")}"`;

export const EventRegistrationsTab: React.FC<{ ev: CrmEvent; canEdit: boolean }> = ({ ev, canEdit }) => {
  const navigate = useNavigate();
  const q = useQuery<any[]>({ queryKey: ["crm-event-regs", ev.id], queryFn: () => eventsApi.registrations(ev.id) });
  const rows = q.data || [];
  const live = rows.filter((r) => r.status !== "cancelled");
  const people = live.reduce((n, r) => n + (r.groupSize || 1), 0);

  const groups = useMemo(() => {
    const count = (key: (r: any) => string) => {
      const m = new Map<string, number>();
      live.forEach((r) => { const k = key(r); if (k) m.set(k, (m.get(k) || 0) + 1); });
      return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    };
    return { countries: count((r) => countryName(r.countryCode)), languages: count((r) => r.language || ""), roles: count((r) => r.ministryRole || "") };
  }, [rows]);

  const exportCsv = () => {
    const qs = ev.questions || [];
    const head = [
      "First name", "Last name", "Email", "Phone", "Country", "City", "Time zone", "Language", "Ministry role", "Church", "Group size", "May contact", "Status", "Registered", ...qs.map((x) => x.label)
    ];
    const body = rows.map((r) => [
      r.firstName, r.lastName, r.email, r.phone, countryName(r.countryCode), r.city, r.timezone, r.language, r.ministryRole, r.organization, r.groupSize, r.contactConsent ? "yes" : "no", r.status, fmtDate(r.createdAt), ...qs.map((x) => r.answers?.[x.id] || "")
    ]);
    const csv = [head, ...body].map((line) => line.map(csvCell).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `${ev.slug}-registrations.csv`;
    a.click();
  };

  const setStatus = async (id: string, status: string) => { await eventsApi.setRegistration(ev.id, id, status); q.refetch(); };
  const chipList = (label: string, list: [string, number][]) => list.length ? (
    <Box sx={{ mb: 1 }}>
      <Typography variant="caption" sx={{ color: "var(--text-muted)" }}>{label}</Typography>
      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5 }}>{list.map(([k, n]) => <Chip key={k} size="small" label={`${k} ${n}`} />)}</Stack>
    </Box>
  ) : null;

  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>{live.length} registered{people > live.length ? `, ${people} people with their groups` : ""}</Typography>
          <Button startIcon={<DownloadIcon />} onClick={exportCsv} disabled={!rows.length}>Download CSV</Button>
        </Stack>
        {chipList("Countries", groups.countries)}
        {chipList("Languages", groups.languages)}
        {chipList("Ministry roles", groups.roles)}
        <Box sx={{ overflowX: "auto", mt: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell><TableCell>Place</TableCell><TableCell>Their start time</TableCell><TableCell>Ministry</TableCell><TableCell>Contact</TableCell><TableCell>Group</TableCell><TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} hover sx={{ opacity: r.status === "cancelled" ? 0.5 : 1 }}>
                  <TableCell sx={{ cursor: r.personId ? "pointer" : "default" }} onClick={() => r.personId && navigate(`/people/${r.personId}?tab=profile`)}>
                    <b>{[r.firstName, r.lastName].filter(Boolean).join(" ")}</b>
                    <Typography variant="caption" sx={{ display: "block", color: "var(--text-muted)" }}>{fmtDate(r.createdAt)}</Typography>
                  </TableCell>
                  <TableCell>{[r.city, countryName(r.countryCode)].filter(Boolean).join(", ")}{r.language && <Typography variant="caption" sx={{ display: "block", color: "var(--text-muted)" }}>{r.language}</Typography>}</TableCell>
                  <TableCell>{ev.startsAt ? wallTime(r.timezone || ev.timezone, new Date(ev.startsAt)) : ""}</TableCell>
                  <TableCell>{[r.ministryRole, r.organization].filter(Boolean).join(", ")}</TableCell>
                  <TableCell><Typography variant="body2">{r.email}</Typography>{r.phone && <Typography variant="caption" sx={{ color: "var(--text-muted)" }}>{r.phone}</Typography>}</TableCell>
                  <TableCell>{r.groupSize || 1}</TableCell>
                  <TableCell>
                    <TextField select size="small" variant="standard" value={r.status} disabled={!canEdit} onChange={(e) => setStatus(r.id, e.target.value)}>
                      <MenuItem value="registered">Registered</MenuItem><MenuItem value="attended">Attended</MenuItem><MenuItem value="cancelled">Cancelled</MenuItem>
                    </TextField>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        {!q.isLoading && rows.length === 0 && <Typography sx={{ color: "var(--text-muted)", mt: 2 }}>No one has registered yet.</Typography>}
      </CardContent>
    </Card>
  );
};
