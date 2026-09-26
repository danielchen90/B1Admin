import React from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, Switch, TextField, Typography } from "@mui/material";
import { Language as WebsiteIcon } from "@mui/icons-material";
import { ApiHelper } from "@churchapps/apphelper";
import { type EventInterface } from "@churchapps/helpers";
import { useCampuses } from "../../hooks/useCampuses";

// Public-website listing for an event (2026-09 redesign). An event appears on the public site's
// events feed only when "Show on the public website" is on. "Worship center" ties it to one center
// ("All centers" = network-wide). The Api enforces that a campus admin can only publish for their
// own center; this UI just offers the centers the admin can write to.

export interface PublicListing {
  publicListing?: boolean;
  campusId?: string | null;
  location?: string | null;
  registrationUrl?: string | null;
  image?: string | null;
}

export type EventWithListing = EventInterface & PublicListing;

export const ALL_CENTERS = "__ALL__";

const toBool = (v: any) => v === true || v === 1 || v === "1" || (v && typeof v === "object" && Array.isArray(v.data) && v.data[0] === 1);

export const listingFromEvent = (ev?: any): PublicListing => ({
  publicListing: toBool(ev?.publicListing),
  campusId: ev?.campusId ?? null,
  location: ev?.location ?? "",
  registrationUrl: ev?.registrationUrl ?? "",
  image: ev?.image ?? ""
});

export const isListed = (ev?: any) => toBool(ev?.publicListing);

// Which centers can this admin publish to? "all" when org-wide (or unknown: the Api decides).
const useWritableCenters = () => {
  const campuses = useCampuses();
  const [writable, setWritable] = React.useState<string[] | "all">("all");
  React.useEffect(() => {
    ApiHelper.get("/campusContent/admin", "MembershipApi")
      .then((d: any) => { if (d?.writableCampusIds) setWritable(d.writableCampusIds); })
      .catch(() => setWritable("all"));
  }, []);
  const options = writable === "all" ? campuses : campuses.filter((c) => c.id && writable.includes(c.id));
  return { options, allowNetworkWide: writable === "all" };
};

interface FieldsProps {
  value: PublicListing;
  onChange: (next: PublicListing) => void;
}

export const EventPublicListingFields: React.FC<FieldsProps> = ({ value, onChange }) => {
  const { options, allowNetworkWide } = useWritableCenters();
  const set = (patch: Partial<PublicListing>) => onChange({ ...value, ...patch });
  const centerValue = value.campusId || (allowNetworkWide ? ALL_CENTERS : "");

  return (
    <Box sx={{ p: 2, borderRadius: 1, border: "1px solid var(--border-light, #e0e0e0)" }} data-testid="event-public-listing">
      <FormControlLabel
        control={<Switch checked={!!value.publicListing} onChange={(e) => set({ publicListing: e.target.checked, campusId: value.campusId ?? (allowNetworkWide ? null : options[0]?.id ?? null) })} data-testid="event-public-toggle" />}
        label={<Stack direction="row" spacing={1} alignItems="center"><WebsiteIcon fontSize="small" /><span>Show on the public website</span></Stack>}
      />
      {value.publicListing && (
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            select
            fullWidth
            label="Worship center"
            value={centerValue}
            onChange={(e) => set({ campusId: e.target.value === ALL_CENTERS ? null : e.target.value })}
            helperText={allowNetworkWide ? "All centers shows the event on every center's page." : "You can publish events for your own worship center."}
            data-testid="event-public-center"
          >
            {allowNetworkWide && <MenuItem value={ALL_CENTERS}>All centers</MenuItem>}
            {options.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </TextField>
          <TextField fullWidth label="Location" placeholder="Fellowship hall, 100 Main St" value={value.location || ""} onChange={(e) => set({ location: e.target.value })} inputProps={{ maxLength: 255 }} data-testid="event-public-location" />
          <TextField fullWidth label="Registration link (optional)" placeholder="https://" value={value.registrationUrl || ""} onChange={(e) => set({ registrationUrl: e.target.value })} inputProps={{ maxLength: 500 }} data-testid="event-public-registration" />
          <TextField fullWidth label="Image link (optional)" placeholder="https://" value={value.image || ""} onChange={(e) => set({ image: e.target.value })} inputProps={{ maxLength: 500 }} />
        </Stack>
      )}
    </Box>
  );
};

// Normalize the listing values for the Api (blank strings become null).
export const listingPayload = (l: PublicListing): PublicListing => ({
  publicListing: !!l.publicListing,
  campusId: l.campusId || null,
  location: (l.location || "").trim() || null,
  registrationUrl: (l.registrationUrl || "").trim() || null,
  image: (l.image || "").trim() || null
});

interface ModalProps {
  eventId: string;
  onDone: (saved: boolean) => void;
}

// Edit the website listing of an existing event (from a group's calendar tab or a curated calendar).
export const EventPublicListingModal: React.FC<ModalProps> = ({ eventId, onDone }) => {
  const [event, setEvent] = React.useState<EventWithListing | null>(null);
  const [listing, setListing] = React.useState<PublicListing>({});
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    ApiHelper.get("/events/" + eventId, "ContentApi").then((ev: EventWithListing) => {
      setEvent(ev);
      setListing(listingFromEvent(ev));
    });
  }, [eventId]);

  const handleSave = async () => {
    if (!event) return;
    setSaving(true);
    setError("");
    try {
      await ApiHelper.post("/events", [{ ...event, ...listingPayload(listing), allDay: toBool((event as any).allDay) }], "ContentApi");
      onDone(true);
    } catch (e: any) {
      setError(e?.message || "Could not save.");
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={() => onDone(false)} fullWidth maxWidth="sm">
      <DialogTitle>Public website</DialogTitle>
      <DialogContent>
        {!event ? <Typography color="text.secondary">Loading...</Typography> : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{event.title}</Typography>
            {event.visibility === "private" && <Alert severity="warning">This event is private. Private events never show on the public website, even when this is turned on.</Alert>}
            <EventPublicListingFields value={listing} onChange={setListing} />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onDone(false)}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={!event || saving} data-testid="event-public-save">Save</Button>
      </DialogActions>
    </Dialog>
  );
};
