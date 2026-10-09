import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Permissions, UserHelper } from "@churchapps/helpers";
import { Loading } from "@churchapps/apphelper";
import { Alert, Autocomplete, Box, Button, Card, CardContent, Checkbox, Chip, Grid, IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { AutoAwesome as AiIcon, Delete as DeleteIcon, Edit as EditIcon, OpenInNew as OpenIcon, Verified as VerifiedIcon } from "@mui/icons-material";
import { CapturePanel } from "./CapturePanel";
import { crmApi, errorText, fmtDate, FACT_LABEL, SITE_LABEL, type CrmPersonView, type CrmProfile, type CrmTag } from "./crmApi";
import { TIMEZONES, countryOptions } from "./zones";

// The person's CRM profile: what the ministry knows about them (AI summary, prayer requests and
// needs, notes, location/time zone/languages/ministry, tags, contact consent) and what they have done
// on the other sites (courses, books, services, groups, viewing, Ask Mary topics).

const CONSENT_TEXT: Record<string, string> = { yes: "Yes, may be contacted about events and studies", no: "No, do not contact", unknown: "Not asked yet" };

export const CrmProfileTab: React.FC<{ personId: string }> = ({ personId }) => {
  const canEdit = UserHelper.checkAccess(Permissions.membershipApi.people.edit);
  const q = useQuery<CrmPersonView>({ queryKey: ["crm-person", personId], queryFn: () => crmApi.person(personId) });
  const allTags = useQuery<CrmTag[]>({ queryKey: ["crm-tags"], queryFn: crmApi.tags });
  const [error, setError] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<CrmProfile>>({});
  const [noteText, setNoteText] = useState("");
  const [factKind, setFactKind] = useState("prayer");
  const [factText, setFactText] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [allActivity, setAllActivity] = useState(false);

  const data = q.data;
  const facts = useMemo(() => (data?.facts || []).filter((f) => showDone || f.status === "open"), [data, showDone]);
  const doneCount = (data?.facts || []).filter((f) => f.status === "done").length;

  const act = async (fn: () => Promise<any>) => {
    setError("");
    try { await fn(); await q.refetch(); } catch (e) { setError(errorText(e)); }
  };

  if (q.isLoading) return <Loading />;
  if (q.error || !data) return <Alert severity="warning">{errorText(q.error) || "This profile could not be loaded."}</Alert>;
  const prof = data.profile;

  const summarize = async () => {
    setSummarizing(true);
    await act(() => crmApi.summary(personId));
    setSummarizing(false);
  };

  const startEdit = () => {
    setDraft({ countryCode: prof.countryCode, city: prof.city, region: prof.region, timezone: prof.timezone, languages: prof.languages, ministryRole: prof.ministryRole, organization: prof.organization, contactConsent: prof.contactConsent });
    setEditing(true);
  };
  const saveProfile = () => act(async () => { await crmApi.saveProfile(personId, draft); setEditing(false); });

  const detail = (label: string, value?: React.ReactNode) => (
    <Stack direction="row" spacing={1} sx={{ py: 0.5 }}>
      <Typography variant="body2" sx={{ minWidth: 120, color: "var(--text-muted)" }}>{label}</Typography>
      <Typography variant="body2" component="div">{value || <span style={{ color: "var(--text-muted)" }}>-</span>}</Typography>
    </Stack>
  );

  const localTime = prof.timezone ? (() => {
    try { return new Date().toLocaleTimeString(undefined, { timeZone: prof.timezone!, hour: "numeric", minute: "2-digit", weekday: "short" }); } catch { return ""; }
  })() : "";

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <AiIcon fontSize="small" color="primary" />
                <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>Profile</Typography>
                <Button size="small" onClick={summarize} disabled={summarizing}>{summarizing ? "Writing..." : prof.summary ? "Refresh" : "Write summary"}</Button>
              </Stack>
              {prof.summary
                ? <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{prof.summary}</Typography>
                : <Typography variant="body2" sx={{ color: "var(--text-muted)" }}>No summary yet. Add what you know below, or write one from the record.</Typography>}
              {prof.summaryUpdatedAt && <Typography variant="caption" sx={{ color: "var(--text-muted)" }}>Written {fmtDate(prof.summaryUpdatedAt)}</Typography>}
            </CardContent>
          </Card>

          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>Prayer requests, needs and follow-ups</Typography>
                {doneCount > 0 && <Button size="small" onClick={() => setShowDone(!showDone)}>{showDone ? "Hide done" : `Show done (${doneCount})`}</Button>}
              </Stack>
              {facts.length === 0 && <Typography variant="body2" sx={{ color: "var(--text-muted)" }}>Nothing recorded yet.</Typography>}
              {facts.map((f) => (
                <Stack key={f.id} direction="row" spacing={1} alignItems="flex-start" sx={{ py: 0.5, opacity: f.status === "done" ? 0.55 : 1 }}>
                  <Checkbox size="small" sx={{ p: 0.25 }} checked={f.status === "done"} disabled={!canEdit} onChange={(e) => act(() => crmApi.setFact(f.id, e.target.checked ? "done" : "open"))} />
                  <Chip size="small" label={FACT_LABEL[f.kind] || f.kind} color={f.kind === "prayer" ? "secondary" : f.kind === "followup" ? "warning" : "default"} />
                  <Typography variant="body2" sx={{ flex: 1, textDecoration: f.status === "done" ? "line-through" : "none" }}>{f.text}</Typography>
                  <Typography variant="caption" sx={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>{fmtDate(f.createdAt)}</Typography>
                  {canEdit && <IconButton size="small" onClick={() => act(() => crmApi.deleteFact(f.id))}><DeleteIcon fontSize="inherit" /></IconButton>}
                </Stack>
              ))}
              {canEdit && (
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <TextField select size="small" value={factKind} onChange={(e) => setFactKind(e.target.value)} sx={{ minWidth: 150 }}>
                    {Object.entries(FACT_LABEL).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
                  </TextField>
                  <TextField size="small" fullWidth placeholder="Add one" value={factText} onChange={(e) => setFactText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && factText.trim()) act(async () => { await crmApi.addFact(personId, factKind, factText); setFactText(""); }); }} />
                  <Button disabled={!factText.trim()} onClick={() => act(async () => { await crmApi.addFact(personId, factKind, factText); setFactText(""); })}>Add</Button>
                </Stack>
              )}
            </CardContent>
          </Card>

          {canEdit && <Box sx={{ mb: 2 }}><CapturePanel personId={personId} compact onSaved={() => q.refetch()} /></Box>}

          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Notes</Typography>
              {canEdit && (
                <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                  <TextField size="small" fullWidth multiline maxRows={6} placeholder="A quick note (saved as written)" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                  <Button disabled={!noteText.trim()} onClick={() => act(async () => { await crmApi.addNote(personId, noteText); setNoteText(""); })}>Save</Button>
                </Stack>
              )}
              {data.notes.length === 0 && <Typography variant="body2" sx={{ color: "var(--text-muted)" }}>No notes yet.</Typography>}
              {data.notes.map((n) => (
                <Box key={n.id} sx={{ py: 1, borderTop: "1px solid var(--border-light)" }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="caption" sx={{ color: "var(--text-muted)", flex: 1 }}>
                      {fmtDate(n.createdAt)}{n.addedByName ? " · " + n.addedByName : ""}{n.kind === "capture" ? " · quick capture" : ""}{n.imageCount ? ` · ${n.imageCount} screenshot${n.imageCount > 1 ? "s" : ""}` : ""}
                    </Typography>
                    {canEdit && <IconButton size="small" onClick={() => { if (window.confirm("Delete this note and the facts taken from it?")) act(() => crmApi.deleteNote(n.id)); }}><DeleteIcon fontSize="inherit" /></IconButton>}
                  </Stack>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{n.body}</Typography>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>About</Typography>
                {canEdit && !editing && <IconButton size="small" onClick={startEdit}><EditIcon fontSize="small" /></IconButton>}
              </Stack>
              {!editing ? (
                <>
                  {detail("Mary Banks ID", data.person.hasMbid ? <Stack direction="row" spacing={0.5} alignItems="center"><VerifiedIcon fontSize="inherit" color="primary" /><span>Yes{prof.mbidCreatedAt ? ", since " + fmtDate(prof.mbidCreatedAt) : ""}{prof.mbidRemovedAt ? " (account removed)" : ""}</span></Stack> : "No")}
                  {detail("Status", data.person.membershipStatus)}
                  {detail("Place", [prof.city, prof.region, prof.country].filter(Boolean).join(", "))}
                  {detail("Time zone", prof.timezone ? `${prof.timezone}${localTime ? " · now " + localTime : ""}` : "")}
                  {detail("Languages", prof.languages)}
                  {detail("Ministry role", prof.ministryRole)}
                  {detail("Church / ministry", prof.organization)}
                  {detail("May contact", <span>{CONSENT_TEXT[prof.contactConsent || "unknown"]}{prof.consentSource ? <Typography variant="caption" component="div" sx={{ color: "var(--text-muted)" }}>{prof.consentSource}{prof.consentAt ? ", " + fmtDate(prof.consentAt) : ""}</Typography> : null}</span>)}
                  {detail("Last active", fmtDate(prof.lastActiveAt))}
                </>
              ) : (
                <Stack spacing={1.5}>
                  <Autocomplete size="small" options={countryOptions} getOptionLabel={(o) => o.name} value={countryOptions.find((c) => c.code === draft.countryCode) || null}
                    onChange={(_, v) => setDraft({ ...draft, countryCode: v?.code || null })} renderInput={(p) => <TextField {...p} label="Country" />} />
                  <Stack direction="row" spacing={1}>
                    <TextField size="small" label="City" fullWidth value={draft.city || ""} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
                    <TextField size="small" label="Region" fullWidth value={draft.region || ""} onChange={(e) => setDraft({ ...draft, region: e.target.value })} />
                  </Stack>
                  <Autocomplete size="small" options={TIMEZONES} value={draft.timezone || null} onChange={(_, v) => setDraft({ ...draft, timezone: v || null })} renderInput={(p) => <TextField {...p} label="Time zone" />} />
                  <TextField size="small" label="Languages" placeholder="e.g. English, Luganda" value={draft.languages || ""} onChange={(e) => setDraft({ ...draft, languages: e.target.value })} />
                  <TextField size="small" label="Ministry role" placeholder="e.g. Pastor" value={draft.ministryRole || ""} onChange={(e) => setDraft({ ...draft, ministryRole: e.target.value })} />
                  <TextField size="small" label="Church / ministry" value={draft.organization || ""} onChange={(e) => setDraft({ ...draft, organization: e.target.value })} />
                  <TextField select size="small" label="May contact" value={draft.contactConsent || "unknown"} onChange={(e) => setDraft({ ...draft, contactConsent: e.target.value as any })}>
                    {Object.entries(CONSENT_TEXT).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
                  </TextField>
                  <Stack direction="row" spacing={1}>
                    <Button variant="contained" onClick={saveProfile}>Save</Button>
                    <Button onClick={() => setEditing(false)}>Cancel</Button>
                  </Stack>
                </Stack>
              )}
            </CardContent>
          </Card>

          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Tags</Typography>
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                {data.tags.map((t) => <Chip key={t.id} size="small" label={t.name} onDelete={canEdit ? () => act(() => crmApi.untag(personId, t.id)) : undefined} />)}
                {data.tags.length === 0 && <Typography variant="body2" sx={{ color: "var(--text-muted)" }}>No tags.</Typography>}
              </Stack>
              {canEdit && (
                <Autocomplete freeSolo size="small" sx={{ mt: 1 }} options={(allTags.data || []).map((t) => t.name).filter((n) => !data.tags.some((t) => t.name === n))}
                  inputValue={tagInput} onInputChange={(_, v) => setTagInput(v)}
                  onChange={(_, v) => { if (v) act(async () => { await crmApi.tag(personId, String(v)); setTagInput(""); allTags.refetch(); }); }}
                  renderInput={(p) => <TextField {...p} placeholder="Add a tag and press Enter" />} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Across the ministry</Typography>
              {data.activities.length === 0 && <Typography variant="body2" sx={{ color: "var(--text-muted)" }}>No activity on the other sites yet.</Typography>}
              {(allActivity ? data.activities : data.activities.slice(0, 15)).map((a) => (
                <Stack key={a.id} direction="row" spacing={1} alignItems="flex-start" sx={{ py: 0.75, borderTop: "1px solid var(--border-light)" }}>
                  <Chip size="small" variant="outlined" label={SITE_LABEL[a.site] || a.site} sx={{ minWidth: 104 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {a.title}
                      {a.url && <Tooltip title="Open"><IconButton size="small" href={a.url} target="_blank" rel="noopener"><OpenIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>}
                    </Typography>
                    {a.detail && <Typography variant="caption" sx={{ color: "var(--text-muted)", display: "block", whiteSpace: "pre-wrap" }}>{a.detail}</Typography>}
                  </Box>
                  <Typography variant="caption" sx={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>{fmtDate(a.occurredAt)}</Typography>
                </Stack>
              ))}
              {data.activities.length > 15 && (
                <Button size="small" sx={{ mt: 1 }} onClick={() => setAllActivity(!allActivity)}>{allActivity ? "Show less" : `Show all ${data.activities.length}`}</Button>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
