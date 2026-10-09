import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Permissions, UserHelper } from "@churchapps/helpers";
import { PageHeader } from "@churchapps/apphelper";
import { Alert, Box, Button, Card, CardActionArea, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Grid, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { Add as AddIcon, Event as EventIcon } from "@mui/icons-material";
import { PageBreadcrumbs } from "../../components/ui";
import { errorText } from "../crmApi";
import { eventsApi, KIND_LABEL, type CrmEvent } from "./eventsApi";
import { wallTime } from "../zones";

// Event planner: Bible studies, conferences, fast tracks. Each event gets a landing page with a
// registration form; sign-ups land in the CRM and get the event's emails.

const STATUS_COLOR: Record<string, "default" | "success" | "warning"> = { draft: "default", published: "success", closed: "warning" };

export const EventsPage: React.FC = () => {
  const navigate = useNavigate();
  const canEdit = UserHelper.checkAccess(Permissions.membershipApi.people.edit);
  const q = useQuery<CrmEvent[]>({ queryKey: ["crm-events"], queryFn: eventsApi.list });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("study");
  const [error, setError] = useState("");

  const create = async () => {
    setError("");
    try {
      const { id } = await eventsApi.create(title, kind);
      navigate(`/crm/events/${id}`);
    } catch (e) { setError(errorText(e)); }
  };

  const events = q.data || [];
  const now = Date.now();
  const upcoming = events.filter((e) => !e.startsAt || new Date(e.endsAt || e.startsAt).getTime() >= now);
  const past = events.filter((e) => e.startsAt && new Date(e.endsAt || e.startsAt).getTime() < now);

  const card = (e: CrmEvent) => (
    <Grid key={e.id} size={{ xs: 12, sm: 6, lg: 4 }}>
      <Card sx={{ height: "100%" }}>
        <CardActionArea onClick={() => navigate(`/crm/events/${e.id}`)} sx={{ height: "100%" }}>
          {e.imageUrl && <Box sx={{ height: 140, backgroundImage: `url(${e.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }} />}
          <CardContent>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <Chip size="small" label={KIND_LABEL[e.kind] || "Event"} />
              <Chip size="small" color={STATUS_COLOR[e.status]} label={e.status === "published" ? "Registration open" : e.status === "closed" ? "Closed" : "Draft"} />
            </Stack>
            <Typography variant="h6" sx={{ lineHeight: 1.25 }}>{e.title}</Typography>
            <Typography variant="body2" sx={{ color: "var(--text-muted)", mt: 0.5 }}>
              {e.startsAt ? wallTime(e.timezone, new Date(e.startsAt), { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }) : "No date yet"}
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, fontWeight: 600 }}>{e.registrations} registered{e.capacity ? ` of ${e.capacity}` : ""}</Typography>
          </CardContent>
        </CardActionArea>
      </Card>
    </Grid>
  );

  return (
    <>
      <PageBreadcrumbs items={[{ label: "CRM", path: "/crm" }, { label: "Events" }]} />
      <PageHeader title="Events" subtitle="Plan a study or conference, publish its page and registration, and keep everyone informed." icon={<EventIcon />}>
        {canEdit && <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={() => setOpen(true)} data-testid="new-event">New event</Button>}
      </PageHeader>
      <Box sx={{ p: { xs: 1, md: 2 } }}>
        {q.error && <Alert severity="warning">{errorText(q.error)}</Alert>}
        {!q.isLoading && events.length === 0 && <Typography sx={{ color: "var(--text-muted)" }}>No events yet. Start with "New event".</Typography>}
        {upcoming.length > 0 && <Grid container spacing={2}>{upcoming.map(card)}</Grid>}
        {past.length > 0 && (
          <>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 4, mb: 1 }}>Past</Typography>
            <Grid container spacing={2}>{past.map(card)}</Grid>
          </>
        )}
      </Box>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New event</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Created in the Image of God" />
            <TextField select label="Kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              {Object.entries(KIND_LABEL).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </TextField>
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!title.trim()} onClick={create}>Create</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
