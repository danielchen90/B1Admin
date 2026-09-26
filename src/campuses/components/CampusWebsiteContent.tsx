import React from "react";
import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogContent, DialogTitle, IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from "@mui/material";
import {
  AddPhotoAlternate as AddPhotoIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  DeleteOutline as DeleteIcon,
  Add as AddIcon,
  Save as SaveIcon
} from "@mui/icons-material";
import { ApiHelper, ImageEditor } from "@churchapps/apphelper";

// The public-website content model (mirrors the Api's CampusContentFields). Blank on a campus
// override means "use the network default"; HIDDEN means "hide on this center".
export const HIDDEN = "__HIDDEN__";
export const MAX_PHOTOS = 12;

interface ServiceTime { day: string; time: string; label?: string }

export interface CampusContentFields {
  mission?: string;
  about?: string;
  welcomeNote?: string;
  pastorNote?: string;
  heroImage?: string;
  serviceTimes?: ServiceTime[] | string;
  facebookUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  givingUrl?: string;
  sermonYoutubeChannel?: string;
  extraLinks?: any;
  photos?: string[] | string;
  leaders?: string;
  phone?: string;
  email?: string;
  whatToExpect?: string;
}

interface AdminRead {
  canEditOrgDefault: boolean;
  writableCampusIds: string[] | "all";
  orgDefault: { content: CampusContentFields; version: number | null };
  campus: { campusId: string; content: CampusContentFields; version: number | null } | null;
}

interface Props {
  // null = the network-wide default (only leadership admins); otherwise one worship center.
  campusId: string | null;
  campusName?: string;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// The cropper hands back a PNG; re-encode as JPEG so public pages load fast.
const toJpeg = (dataUrl: string): Promise<string> => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", 0.86));
    } catch { resolve(dataUrl); }
  };
  img.onerror = () => resolve(dataUrl);
  img.src = dataUrl;
});

function asList<T>(v: any): T[] { return Array.isArray(v) ? v : []; }
const asText = (v: any): string => (typeof v === "string" && v !== HIDDEN ? v : "");

// Card section wrapper to keep the editor readable.
const Section: React.FC<{ title: string; helper?: string; children: React.ReactNode; testId?: string }> = (p) => (
  <Card sx={{ mb: 3 }} data-testid={p.testId}>
    <CardContent>
      <Typography variant="h6" sx={{ mb: p.helper ? 0.5 : 2 }}>{p.title}</Typography>
      {p.helper && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{p.helper}</Typography>}
      {p.children}
    </CardContent>
  </Card>
);

export const CampusWebsiteContent: React.FC<Props> = ({ campusId, campusName }) => {
  const isOrg = campusId === null;
  const [loaded, setLoaded] = React.useState<AdminRead | null>(null);
  const [loadError, setLoadError] = React.useState<string>("");
  const [content, setContent] = React.useState<CampusContentFields>({});
  const [version, setVersion] = React.useState<number | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [editor, setEditor] = React.useState<null | "photo" | "hero">(null);
  const [uploading, setUploading] = React.useState(false);

  const load = React.useCallback(() => {
    setLoadError("");
    const qs = campusId ? "?campusId=" + encodeURIComponent(campusId) : "";
    ApiHelper.get("/campusContent/admin" + qs, "MembershipApi").then((data: AdminRead) => {
      if (!data || data.canEditOrgDefault === undefined) {
        setLoadError("You do not have permission to edit this website content.");
        return;
      }
      setLoaded(data);
      const own = isOrg ? data.orgDefault : data.campus;
      setContent({ ...(own?.content || {}) });
      setVersion(own?.version ?? null);
      setDirty(false);
    }).catch(() => setLoadError("You do not have permission to edit this website content."));
  }, [campusId, isOrg]);

  React.useEffect(() => { load(); }, [load]);

  const org = loaded?.orgDefault?.content || {};
  const set = (key: keyof CampusContentFields, value: any) => { setContent((c) => ({ ...c, [key]: value })); setDirty(true); };

  // Inherited value shown as a hint on a campus override.
  const inheritHint = (key: keyof CampusContentFields) => {
    if (isOrg) return undefined;
    const v = asText((org as any)[key]);
    return v ? "Network default: " + (v.length > 80 ? v.slice(0, 80) + "..." : v) : undefined;
  };

  const ownPhotos = asList<string>(content.photos);
  const photosHidden = content.photos === HIDDEN;
  const inheritedPhotos = !isOrg && ownPhotos.length === 0 && !photosHidden ? asList<string>(org.photos) : [];

  const movePhoto = (index: number, delta: number) => {
    const list = [...ownPhotos];
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    set("photos", list);
  };
  const removePhoto = (index: number) => set("photos", ownPhotos.filter((_, i) => i !== index));

  const handleImage = async (dataUrl?: string) => {
    const mode = editor;
    if (!dataUrl) { setEditor(null); return; }
    setUploading(true);
    setErrors([]);
    try {
      const result = await ApiHelper.post("/campusContent/photo", { campusId, dataUrl: await toJpeg(dataUrl) }, "MembershipApi");
      if (!result?.url) throw new Error((result?.errors || ["Upload failed."]).join(" "));
      if (mode === "hero") set("heroImage", result.url);
      else set("photos", [...ownPhotos, result.url].slice(0, MAX_PHOTOS));
      setEditor(null);
    } catch (e: any) {
      setErrors([e?.message || "Upload failed."]);
    } finally {
      setUploading(false);
    }
  };

  const serviceTimes = asList<ServiceTime>(content.serviceTimes);
  const setServiceTime = (i: number, patch: Partial<ServiceTime>) => set("serviceTimes", serviceTimes.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const handleSave = async () => {
    setSaving(true);
    setErrors([]);
    try {
      const body: any = { campusId, content: { ...content, serviceTimes: serviceTimes.filter((s) => s.day || s.time) } };
      if (version !== null) body.version = version;
      const result = await ApiHelper.post("/campusContent", body, "MembershipApi");
      if (result?.errors) { setErrors(result.errors); return; }
      if (result?.error === "stale version") { setErrors(["Someone else saved this page while you were editing. Reload to see their changes."]); return; }
      setVersion(result?.version ?? version);
      setSavedAt(new Date());
      setDirty(false);
      load();
    } catch (e: any) {
      const msg = (e?.message || "").toString();
      if (msg.includes("stale")) setErrors(["Someone else saved this page while you were editing. Reload to see their changes."]);
      else setErrors([msg || "Could not save. Check the fields and try again."]);
    } finally {
      setSaving(false);
    }
  };

  if (loadError) return <Box sx={{ p: 3 }}><Alert severity="warning">{loadError}</Alert></Box>;
  if (!loaded) return <Box sx={{ p: 3 }}><Typography color="text.secondary">Loading website content...</Typography></Box>;

  const textField = (key: keyof CampusContentFields, label: string, opts: { multiline?: boolean; rows?: number; helper?: string; max?: number; type?: string; testId?: string } = {}) => {
    const value = asText((content as any)[key]);
    const hint = inheritHint(key);
    const helper = [opts.helper, hint].filter(Boolean).join(" ");
    return (
      <TextField
        fullWidth
        label={label}
        type={opts.type}
        value={value}
        onChange={(e) => set(key, e.target.value)}
        multiline={opts.multiline}
        minRows={opts.rows}
        helperText={helper || (opts.max ? `${value.length}/${opts.max}` : undefined)}
        inputProps={{ maxLength: opts.max, "data-testid": opts.testId }}
        sx={{ mb: 2 }}
      />
    );
  };

  return (
    <Box sx={{ p: 3 }} data-testid="campus-website-content">
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5">{isOrg ? "Website defaults for every center" : `Website page: ${campusName || "this center"}`}</Typography>
          <Typography variant="body2" color="text.secondary">
            {isOrg
              ? "These values show on every worship center page unless a center enters its own."
              : "Leave a field blank to use the network default. What you enter here shows only on this center's page."}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {savedAt && !dirty && <Chip color="success" size="small" label="Saved" />}
          <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving || uploading || !dirty} data-testid="campus-content-save">
            {saving ? "Saving..." : "Save"}
          </Button>
        </Stack>
      </Stack>

      {errors.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }} data-testid="campus-content-errors">
          {errors.map((e, i) => <div key={i}>{e}</div>)}
        </Alert>
      )}

      <Section
        title="Photos"
        helper="Add photos of your worship center: the building, your pastor, worship, fellowship. The first photo is used on the locations page."
        testId="campus-content-photos"
      >
        {inheritedPhotos.length > 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>This center is showing the network default photos. Add photos here to use your own.</Alert>
        )}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 2, mb: 2 }}>
          {ownPhotos.map((url, i) => (
            <Card key={url + i} variant="outlined" data-testid="campus-photo-tile">
              <Box component="img" src={url} alt={`Photo ${i + 1}`} sx={{ width: "100%", aspectRatio: "3 / 2", objectFit: "cover", display: "block" }} />
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 1, py: 0.5 }}>
                <Typography variant="caption" color="text.secondary">{i === 0 ? "Cover photo" : `Photo ${i + 1}`}</Typography>
                <Box>
                  <Tooltip title="Move earlier"><span><IconButton size="small" onClick={() => movePhoto(i, -1)} disabled={i === 0} aria-label="Move photo earlier"><ArrowBackIcon fontSize="small" /></IconButton></span></Tooltip>
                  <Tooltip title="Move later"><span><IconButton size="small" onClick={() => movePhoto(i, 1)} disabled={i === ownPhotos.length - 1} aria-label="Move photo later"><ArrowForwardIcon fontSize="small" /></IconButton></span></Tooltip>
                  <Tooltip title="Remove"><IconButton size="small" onClick={() => removePhoto(i)} aria-label="Remove photo"><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                </Box>
              </Stack>
            </Card>
          ))}
          {inheritedPhotos.map((url, i) => (
            <Box key={"inh" + i} component="img" src={url} alt="Network default photo" sx={{ width: "100%", aspectRatio: "3 / 2", objectFit: "cover", opacity: 0.45, borderRadius: 1 }} />
          ))}
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <Button variant="outlined" startIcon={<AddPhotoIcon />} onClick={() => setEditor("photo")} disabled={ownPhotos.length >= MAX_PHOTOS || uploading} data-testid="campus-photo-add">
            Add photo
          </Button>
          <Typography variant="body2" color="text.secondary">{ownPhotos.length} of {MAX_PHOTOS}</Typography>
        </Stack>
      </Section>

      <Section title="Visitor information" helper="Shown on the center page so a first-time guest knows who to ask for and how to reach you." testId="campus-content-visitor">
        {textField("leaders", "Pastor(s)", { max: 200, testId: "campus-leaders" })}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          {textField("phone", "Phone", { max: 40, type: "tel", testId: "campus-phone" })}
          {textField("email", "Email", { max: 120, type: "email", testId: "campus-email" })}
        </Stack>
        {textField("whatToExpect", "Your first visit", { multiline: true, rows: 4, max: 2000, helper: "Parking, what to wear, children, how long the service lasts, language help.", testId: "campus-what-to-expect" })}
      </Section>

      <Section title="Service times" helper={!isOrg && serviceTimes.length === 0 && asList(org.serviceTimes).length > 0 ? "Using the network default service times. Add a time to set this center's own list." : undefined}>
        {serviceTimes.map((s, i) => (
          <Stack key={i} direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1 }}>
            <TextField select size="small" label="Day" value={s.day || ""} onChange={(e) => setServiceTime(i, { day: e.target.value })} sx={{ minWidth: 150 }}>
              {DAYS.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
            </TextField>
            <TextField size="small" label="Time" placeholder="10:00 AM" value={s.time || ""} onChange={(e) => setServiceTime(i, { time: e.target.value })} />
            <TextField size="small" label="Label (optional)" placeholder="Sunday worship" value={s.label || ""} onChange={(e) => setServiceTime(i, { label: e.target.value })} sx={{ flex: 1 }} />
            <IconButton aria-label="Remove service time" onClick={() => set("serviceTimes", serviceTimes.filter((_, idx) => idx !== i))}><DeleteIcon /></IconButton>
          </Stack>
        ))}
        <Button size="small" startIcon={<AddIcon />} onClick={() => set("serviceTimes", [...serviceTimes, { day: "Sunday", time: "", label: "" }])}>Add service time</Button>
      </Section>

      <Section title="About this center">
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          {asText(content.heroImage)
            ? <Box component="img" src={asText(content.heroImage)} alt="Header image" sx={{ width: 240, aspectRatio: "16 / 9", objectFit: "cover", borderRadius: 1 }} />
            : <Typography variant="body2" color="text.secondary">{inheritHint("heroImage") ? "Using the network default header image." : "No header image yet."}</Typography>}
          <Button variant="outlined" onClick={() => setEditor("hero")} disabled={uploading}>{asText(content.heroImage) ? "Change header image" : "Add header image"}</Button>
          {asText(content.heroImage) && <Button color="inherit" onClick={() => set("heroImage", "")}>Remove</Button>}
        </Stack>
        {textField("welcomeNote", "Welcome message", { multiline: true, rows: 2 })}
        {textField("about", "About", { multiline: true, rows: 3 })}
        {textField("mission", "Mission", { multiline: true, rows: 2 })}
        {textField("pastorNote", "A note from the pastor", { multiline: true, rows: 3 })}
      </Section>

      <Section title="Links">
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          {textField("facebookUrl", "Facebook page")}
          {textField("instagramUrl", "Instagram")}
        </Stack>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          {textField("youtubeUrl", "YouTube page")}
          {textField("sermonYoutubeChannel", "Sermon YouTube channel")}
        </Stack>
        {textField("givingUrl", "Online giving link")}
      </Section>

      {editor && (
        <Dialog open onClose={() => !uploading && setEditor(null)} maxWidth="md" fullWidth>
          <DialogTitle>{editor === "hero" ? "Header image" : "Add a photo"}</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {editor === "hero" ? "Choose a wide image, then crop it." : "Choose a landscape photo, then crop it. Photos are shown in a 3:2 frame."}
            </Typography>
            {uploading && <Alert severity="info" sx={{ mb: 1 }}>Uploading...</Alert>}
            <ImageEditor
              photoUrl=""
              aspectRatio={editor === "hero" ? 16 / 9 : 3 / 2}
              outputWidth={editor === "hero" ? 1600 : 1500}
              outputHeight={editor === "hero" ? 900 : 1000}
              onUpdate={handleImage}
              onCancel={() => setEditor(null)}
              hideDelete={true}
            />
          </DialogContent>
        </Dialog>
      )}
    </Box>
  );
};
