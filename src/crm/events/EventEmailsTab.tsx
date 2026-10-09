import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Radio, RadioGroup, Stack, Switch, TextField, Typography } from "@mui/material";
import { Add as AddIcon, Send as SendIcon } from "@mui/icons-material";
import { crmApi, errorText, fmtDate, type CrmTag } from "../crmApi";
import { countryName, wallTime } from "../zones";
import { browserZone, eventsApi, type CrmEvent, type EventEmail } from "./eventsApi";

// The event's emails. Confirmation (on registering), reminders before the start, a follow-up after
// the end, and one-off invitations or updates. Each reader sees the time in their own time zone.
// Invitations reach CRM people who said we may contact them; everyone else is left out.

const KIND_TEXT: Record<string, string> = { confirmation: "Confirmation", reminder: "Reminder", followup: "Follow-up", invite: "Invitation", update: "Update" };
const MERGE = [
  "firstName", "eventTitle", "eventTime", "joinLine", "joinUrl", "eventUrl", "flyerUrl", "location"
];

const when = (e: EventEmail) => {
  if (e.kind === "confirmation") return "When someone registers";
  if (e.kind === "invite" || e.kind === "update") return e.sendAt ? (e.sentAt ? "Sent " : "Sends ") + fmtDate(e.sendAt) + " " + new Date(e.sendAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Not scheduled";
  const m = Math.abs(e.offsetMinutes || 0);
  const span = m % 1440 === 0 ? `${m / 1440} day${m / 1440 === 1 ? "" : "s"}` : m % 60 === 0 ? `${m / 60} hour${m / 60 === 1 ? "" : "s"}` : `${m} minutes`;
  return e.kind === "reminder" ? `${span} before the start` : `${span} after the end`;
};

const splitOffset = (min: number | null) => {
  const m = Math.abs(min || 0);
  if (m && m % 1440 === 0) return { n: m / 1440, unit: 1440 };
  if (m && m % 60 === 0) return { n: m / 60, unit: 60 };
  return { n: m || 1, unit: 1 };
};

const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

interface EditState extends Partial<EventEmail> { n?: number; unit?: number; sendWhen?: "now" | "later"; local?: string }

export const EventEmailsTab: React.FC<{ ev: CrmEvent; canEdit: boolean; reload: () => void }> = ({ ev, canEdit, reload }) => {
  const [edit, setEdit] = useState<EditState | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [count, setCount] = useState<{ count: number; sample: string[] } | null>(null);
  const tags = useQuery<CrmTag[]>({ queryKey: ["crm-tags"], queryFn: crmApi.tags });
  const stats = useQuery<any>({ queryKey: ["crm-stats"], queryFn: crmApi.stats });
  const ORDER: Record<string, number> = { confirmation: 0, reminder: 1, followup: 2, update: 3, invite: 4 };
  const emails = [...(ev.emails || [])].sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || (a.offsetMinutes ?? 0) - (b.offsetMinutes ?? 0));

  const isOneOff = edit?.kind === "invite" || edit?.kind === "update";
  useEffect(() => {
    if (!edit || !isOneOff) { setCount(null); return; }
    const t = setTimeout(() => eventsApi.audienceCount(ev.id, edit.audience || { type: "registrants" }).then(setCount).catch(() => setCount(null)), 300);
    return () => clearTimeout(t);
  }, [JSON.stringify(edit?.audience), edit?.kind]);

  const open = (e: EventEmail) => { const o = splitOffset(e.offsetMinutes); setEdit({ ...e, ...o, sendWhen: "later", local: toLocalInput(e.sendAt) }); };
  const newEmail = (kind: "reminder" | "followup" | "invite" | "update") => setEdit({
    kind,
    enabled: true,
    n: kind === "reminder" ? 5 : 1,
    unit: kind === "reminder" ? 60 : 1440,
    sendWhen: "now",
    audience: kind === "invite" ? { type: "crm" } : { type: "registrants" },
    subject: kind === "invite" ? "You are invited: {{eventTitle}}" : kind === "update" ? "An update about {{eventTitle}}" : kind === "reminder" ? "Coming up: {{eventTitle}}" : "Thank you for joining {{eventTitle}}",
    body: kind === "invite"
      ? "Dear {{firstName}},\n\nYou are invited to {{eventTitle}}.\n\nWhen: {{eventTime}}\n\nSee the details, register and download the flyer to share: {{eventUrl}}\n\nGod bless you,\nBible Teachers International"
      : "Dear {{firstName}},\n\n\n\nWhen: {{eventTime}}\n{{joinLine}}\n\nGod bless you,\nBible Teachers International"
  });

  const save = async () => {
    if (!edit) return;
    setError("");
    const body: Partial<EventEmail> = { subject: edit.subject, body: edit.body, enabled: edit.enabled };
    if (edit.kind === "reminder") body.offsetMinutes = -(Number(edit.n) || 0) * (edit.unit || 1);
    if (edit.kind === "followup") body.offsetMinutes = (Number(edit.n) || 0) * (edit.unit || 1);
    if (isOneOff) {
      body.audience = edit.audience;
      body.sendAt = edit.sendWhen === "now" ? new Date().toISOString() : edit.local ? new Date(edit.local).toISOString() : null;
      if (!edit.sentAt && body.sendAt && !window.confirm(`${edit.sendWhen === "now" ? "Send now" : "Schedule"} to ${count?.count ?? "these"} people?`)) return;
    }
    try {
      if (edit.id) await eventsApi.saveEmail(ev.id, edit.id, body);
      else await eventsApi.addEmail(ev.id, { kind: edit.kind, ...body });
      setEdit(null);
      reload();
    } catch (e) { setError(errorText(e)); }
  };

  const test = async (e: EventEmail) => {
    setNote("");
    try { const r = await eventsApi.testEmail(ev.id, e.id, browserZone()); setNote(r.ok ? `Test sent to ${r.to}.` : `Test not sent (${r.result}).`); } catch (err) { setNote(errorText(err)); }
  };

  const aud = edit?.audience || {};
  const setAud = (patch: any) => setEdit({ ...edit!, audience: { ...aud, ...patch } });

  return (
    <Box>
      {note && <Alert severity="info" sx={{ mb: 2 }} onClose={() => setNote("")}>{note}</Alert>}
      {canEdit && (
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap" }}>
          <Button variant="contained" startIcon={<SendIcon />} onClick={() => newEmail("invite")}>Invite people</Button>
          <Button startIcon={<AddIcon />} onClick={() => newEmail("update")}>Update to registrants</Button>
          <Button startIcon={<AddIcon />} onClick={() => newEmail("reminder")}>Add a reminder</Button>
          <Button startIcon={<AddIcon />} onClick={() => newEmail("followup")}>Add a follow-up</Button>
        </Stack>
      )}
      <Stack spacing={1.5}>
        {emails.map((e) => (
          <Card key={e.id} sx={{ opacity: e.enabled ? 1 : 0.6 }}>
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                <Chip size="small" label={KIND_TEXT[e.kind]} color={e.kind === "invite" ? "secondary" : "default"} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{e.subject}</Typography>
                  <Typography variant="caption" sx={{ color: "var(--text-muted)" }}>
                    {when(e)}{!e.enabled ? " · off" : ""}{e.sends?.sent ? ` · sent to ${e.sends.sent}` : ""}{e.sends?.failed ? ` · ${e.sends.failed} failed` : ""}
                  </Typography>
                </Box>
                {canEdit && <Button size="small" onClick={() => test(e)}>Send me a test</Button>}
                {canEdit && <Button size="small" onClick={() => open(e)}>Edit</Button>}
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <Dialog open={!!edit} onClose={() => setEdit(null)} fullWidth maxWidth="md">
        <DialogTitle>{edit?.id ? "Edit" : "New"} {KIND_TEXT[edit?.kind || "reminder"].toLowerCase()}</DialogTitle>
        <DialogContent>
          {edit && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              {(edit.kind === "reminder" || edit.kind === "followup") && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField size="small" type="number" label="Send" value={edit.n} onChange={(x) => setEdit({ ...edit, n: Number(x.target.value) })} sx={{ width: 100 }} />
                  <TextField select size="small" value={edit.unit} onChange={(x) => setEdit({ ...edit, unit: Number(x.target.value) })} sx={{ width: 130 }}>
                    <MenuItem value={1}>minutes</MenuItem><MenuItem value={60}>hours</MenuItem><MenuItem value={1440}>days</MenuItem>
                  </TextField>
                  <Typography variant="body2">{edit.kind === "reminder" ? "before the start" : "after the end"}</Typography>
                  {ev.startsAt && edit.kind === "reminder" && (
                    <Typography variant="caption" sx={{ color: "var(--text-muted)" }}>
                      ({wallTime(ev.timezone, new Date(new Date(ev.startsAt).getTime() - (Number(edit.n) || 0) * (edit.unit || 1) * 60000), { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })})
                    </Typography>
                  )}
                </Stack>
              )}
              {edit.kind === "invite" && (
                <Box sx={{ p: 1.5, border: "1px solid var(--border-light)", borderRadius: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Who gets it</Typography>
                  <Typography variant="caption" sx={{ display: "block", color: "var(--text-muted)", mb: 1 }}>People in the CRM who said we may contact them, narrowed by:</Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <TextField select size="small" label="Country" value={aud.countryCode || ""} onChange={(x) => setAud({ countryCode: x.target.value || null })} sx={{ minWidth: 160 }}>
                      <MenuItem value="">Any</MenuItem>
                      {(stats.data?.countries || []).map((c: any) => <MenuItem key={c.countryCode} value={c.countryCode}>{c.country || countryName(c.countryCode)}</MenuItem>)}
                    </TextField>
                    <TextField select size="small" label="Tag" value={aud.tagId || ""} onChange={(x) => setAud({ tagId: x.target.value || null })} sx={{ minWidth: 160 }}>
                      <MenuItem value="">Any</MenuItem>
                      {(tags.data || []).map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
                    </TextField>
                    <TextField select size="small" label="Status" value={aud.status || ""} onChange={(x) => setAud({ status: x.target.value || null })} sx={{ minWidth: 140 }}>
                      <MenuItem value="">Any</MenuItem>
                      {["Contact", "Visitor", "Regular Attendee", "Member", "Staff"].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </TextField>
                  </Stack>
                </Box>
              )}
              {isOneOff && count && <Typography variant="body2"><b>{count.count}</b> {count.count === 1 ? "person" : "people"}{count.sample.length ? `, e.g. ${count.sample.slice(0, 4).join(", ")}` : ""}</Typography>}
              {isOneOff && !edit.sentAt && (
                <RadioGroup row value={edit.sendWhen} onChange={(x) => setEdit({ ...edit, sendWhen: x.target.value as any })}>
                  <FormControlLabel value="now" control={<Radio size="small" />} label="Send now" />
                  <FormControlLabel value="later" control={<Radio size="small" />} label="Schedule" />
                  {edit.sendWhen === "later" && <TextField size="small" type="datetime-local" value={edit.local || ""} onChange={(x) => setEdit({ ...edit, local: x.target.value })} />}
                </RadioGroup>
              )}
              <TextField label="Subject" value={edit.subject || ""} onChange={(x) => setEdit({ ...edit, subject: x.target.value })} />
              <TextField label="Message" multiline minRows={10} value={edit.body || ""} onChange={(x) => setEdit({ ...edit, body: x.target.value })}
                helperText={"Blank lines make paragraphs. Fill-ins: " + MERGE.map((m) => `{{${m}}}`).join(" ") + ". {{eventTime}} is shown in each reader's own time zone."} />
              {edit.kind !== "invite" && edit.kind !== "update" && <FormControlLabel control={<Switch checked={!!edit.enabled} onChange={(x) => setEdit({ ...edit, enabled: x.target.checked })} />} label="On" />}
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {edit?.id && edit.kind !== "confirmation" && canEdit && (
            <Button color="error" sx={{ mr: "auto" }} onClick={async () => { if (window.confirm("Delete this email?")) { await eventsApi.removeEmail(ev.id, edit.id!); setEdit(null); reload(); } }}>Delete</Button>
          )}
          <Button onClick={() => setEdit(null)}>Cancel</Button>
          <Button variant="contained" onClick={save}>{isOneOff && !edit?.sentAt ? (edit?.sendWhen === "now" ? "Send" : "Schedule") : "Save"}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
