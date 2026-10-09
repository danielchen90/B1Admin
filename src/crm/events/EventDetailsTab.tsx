import React, { useEffect, useMemo, useState } from "react";
import { Autocomplete, Box, Button, Card, CardContent, FormControlLabel, Grid, IconButton, MenuItem, Stack, Switch, TextField, Typography } from "@mui/material";
import { Add as AddIcon, Delete as DeleteIcon } from "@mui/icons-material";
import { TIMEZONES, zonedToUtc } from "../zones";
import { TimeZoneStrip } from "./TimeZoneStrip";
import { KIND_LABEL, type CrmEvent, type EventSpeaker, type EventTopic } from "./eventsApi";

// What the event is: the message, its topics, who ministers, when (in the host's time zone, with
// the time around the world), where and how people join, and capacity.

const partsIn = (iso: string | null, tz: string) => {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value || "";
  return { date: `${g("year")}-${g("month")}-${g("day")}`, time: `${g("hour")}:${g("minute")}` };
};

interface Props { ev: CrmEvent; canEdit: boolean; onSave: (patch: Partial<CrmEvent> & { slug?: string }) => Promise<void> }

export const EventDetailsTab: React.FC<Props> = ({ ev, canEdit, onSave }) => {
  const [f, setF] = useState<any>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = partsIn(ev.startsAt, ev.timezone);
    const e = partsIn(ev.endsAt, ev.timezone);
    setF({
      title: ev.title,
      kind: ev.kind,
      subtitle: ev.subtitle || "",
      message: ev.message || "",
      slug: ev.slug,
      topics: ev.topics || [],
      speakers: ev.speakers || [],
      timezone: ev.timezone,
      date: s.date,
      start: s.time,
      endDate: e.date || s.date,
      end: e.time,
      schedule: ev.schedule || "",
      location: ev.location || "",
      joinUrl: ev.joinUrl || "",
      languages: ev.languages || "",
      capacity: ev.capacity || "",
      registrationOpen: ev.registrationOpen
    });
  }, [ev]);

  const startsAt = useMemo(() => (f.date && f.start && f.timezone ? zonedToUtc(f.date, f.start, f.timezone) : null), [f.date, f.start, f.timezone]);
  const endsAt = useMemo(() => (f.endDate && f.end && f.timezone ? zonedToUtc(f.endDate, f.end, f.timezone) : null), [f.endDate, f.end, f.timezone]);
  const set = (k: string, v: any) => setF({ ...f, [k]: v });

  const save = async () => {
    setBusy(true);
    try {
      await onSave({
        title: f.title,
        kind: f.kind,
        subtitle: f.subtitle,
        message: f.message,
        slug: f.slug,
        topics: f.topics.filter((t: EventTopic) => t.title.trim()),
        speakers: f.speakers.filter((s: EventSpeaker) => s.name.trim()),
        timezone: f.timezone,
        startsAt: startsAt ? startsAt.toISOString() : null,
        endsAt: endsAt ? endsAt.toISOString() : null,
        schedule: f.schedule,
        location: f.location,
        joinUrl: f.joinUrl,
        languages: f.languages,
        capacity: f.capacity ? Number(f.capacity) : null,
        registrationOpen: f.registrationOpen
      } as any);
    } finally { setBusy(false); }
  };

  const listEditor = <T extends Record<string, string>>(key: "topics" | "speakers", fields: [keyof T, string, number][], empty: T) => (
    <Stack spacing={1}>
      {(f[key] || []).map((row: T, i: number) => (
        <Stack key={i} direction="row" spacing={1}>
          {fields.map(([k, label, flex]) => (
            <TextField key={String(k)} size="small" label={label} value={row[k] || ""} sx={{ flex }} disabled={!canEdit}
              onChange={(e) => set(key, f[key].map((r: T, j: number) => (j === i ? { ...r, [k]: e.target.value } : r)))} />
          ))}
          {canEdit && <IconButton onClick={() => set(key, f[key].filter((_: T, j: number) => j !== i))}><DeleteIcon fontSize="small" /></IconButton>}
        </Stack>
      ))}
      {canEdit && <Button size="small" startIcon={<AddIcon />} sx={{ alignSelf: "flex-start" }} onClick={() => set(key, [...(f[key] || []), empty])}>Add</Button>}
    </Stack>
  );

  if (!f.timezone) return null;
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 7 }}>
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>The message</Typography>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1}>
                <TextField label="Title" value={f.title} onChange={(e) => set("title", e.target.value)} sx={{ flex: 3 }} disabled={!canEdit} />
                <TextField select label="Kind" value={f.kind} onChange={(e) => set("kind", e.target.value)} sx={{ flex: 1 }} disabled={!canEdit}>
                  {Object.entries(KIND_LABEL).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
                </TextField>
              </Stack>
              <TextField label="Subtitle" value={f.subtitle} onChange={(e) => set("subtitle", e.target.value)} disabled={!canEdit} placeholder="e.g. A three-day online conference with Apostle Mary Banks" />
              <TextField label="What is being ministered" multiline minRows={5} value={f.message} onChange={(e) => set("message", e.target.value)} disabled={!canEdit}
                helperText="In your own words. The page is written from this, the topics and the details; it keeps your topics and scripture as written." />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Topics</Typography>
                {listEditor<EventTopic>("topics", [["title", "Topic", 2], ["detail", "Scripture or note", 3]], { title: "", detail: "" })}
              </Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Who is ministering</Typography>
                {listEditor<EventSpeaker>("speakers", [["name", "Name", 2], ["role", "Role", 3]], { name: "", role: "" })}
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, md: 5 }}>
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>When</Typography>
            <Stack spacing={2}>
              <Autocomplete options={TIMEZONES} value={f.timezone} disableClearable onChange={(_, v) => set("timezone", v)} disabled={!canEdit}
                renderInput={(p) => <TextField {...p} size="small" label="Your time zone" />} />
              <Stack direction="row" spacing={1}>
                <TextField size="small" type="date" label="Starts" InputLabelProps={{ shrink: true }} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value, endDate: f.endDate && f.endDate >= e.target.value ? f.endDate : e.target.value })} disabled={!canEdit} sx={{ flex: 3 }} />
                <TextField size="small" type="time" label="at" InputLabelProps={{ shrink: true }} value={f.start} onChange={(e) => set("start", e.target.value)} disabled={!canEdit} sx={{ flex: 2 }} />
              </Stack>
              <Stack direction="row" spacing={1}>
                <TextField size="small" type="date" label="Ends" InputLabelProps={{ shrink: true }} value={f.endDate} onChange={(e) => set("endDate", e.target.value)} disabled={!canEdit} sx={{ flex: 3 }} />
                <TextField size="small" type="time" label="at" InputLabelProps={{ shrink: true }} value={f.end} onChange={(e) => set("end", e.target.value)} disabled={!canEdit} sx={{ flex: 2 }} />
              </Stack>
              <TextField size="small" label="Schedule (optional)" placeholder="e.g. Friday to Sunday, or every Tuesday for 6 weeks" value={f.schedule} onChange={(e) => set("schedule", e.target.value)} disabled={!canEdit} />
              <TimeZoneStrip startsAt={startsAt} hostZone={f.timezone} registrantZones={ev.zones?.registrants} crmZones={ev.zones?.crm} />
            </Stack>
          </CardContent>
        </Card>
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Where and how</Typography>
            <Stack spacing={2}>
              <TextField size="small" label="Where" placeholder="e.g. Online (Global Church) or a venue address" value={f.location} onChange={(e) => set("location", e.target.value)} disabled={!canEdit} />
              <TextField size="small" label="Join link (sent to people who register)" value={f.joinUrl} onChange={(e) => set("joinUrl", e.target.value)} disabled={!canEdit} />
              <TextField size="small" label="Languages offered" placeholder="e.g. English, French, Swahili, Urdu" value={f.languages} onChange={(e) => set("languages", e.target.value)} disabled={!canEdit} />
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField size="small" type="number" label="Capacity (blank = no limit)" value={f.capacity} onChange={(e) => set("capacity", e.target.value)} disabled={!canEdit} sx={{ flex: 1 }} />
                <FormControlLabel control={<Switch checked={!!f.registrationOpen} onChange={(e) => set("registrationOpen", e.target.checked)} disabled={!canEdit} />} label="Registration open" />
              </Stack>
              <TextField size="small" label="Page address" value={f.slug} onChange={(e) => set("slug", e.target.value)} disabled={!canEdit} helperText={`.../e/${f.slug}`} />
            </Stack>
          </CardContent>
        </Card>
        {canEdit && <Button variant="contained" onClick={save} disabled={busy} fullWidth data-testid="event-save">{busy ? "Saving..." : "Save details"}</Button>}
      </Grid>
    </Grid>
  );
};
