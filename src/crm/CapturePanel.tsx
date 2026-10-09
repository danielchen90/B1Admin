import React, { useRef, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, Divider, IconButton, List, ListItemButton, ListItemText, Radio, Stack, TextField, Typography } from "@mui/material";
import { AutoAwesome as AiIcon, Close as CloseIcon, Image as ImageIcon } from "@mui/icons-material";
import { crmApi, errorText, readImage, FACT_LABEL, type CaptureImage, type Extraction } from "./crmApi";

// Quick capture: paste what you learned about someone (notes, a chat, screenshots of WhatsApp),
// the AI pulls out the details, you check them, then save. On a person's page it adds to that
// person; on the CRM page it finds or creates the person.

interface Props {
  personId?: string | null;
  onSaved: (result: { personId: string; created: boolean; changes: string[] }) => void;
  compact?: boolean;
}

export const CapturePanel: React.FC<Props> = ({ personId, onSaved, compact }) => {
  const [text, setText] = useState("");
  const [images, setImages] = useState<CaptureImage[]>([]);
  const [busy, setBusy] = useState<"" | "reading" | "saving">("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ extraction: Extraction; candidates: any[] } | null>(null);
  const [target, setTarget] = useState<string>("new");
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = async (files: FileList | File[]) => {
    const read = (await Promise.all(Array.from(files).slice(0, 6).map(readImage))).filter(Boolean) as CaptureImage[];
    setImages((prev) => [...prev, ...read].slice(0, 6));
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files || []).filter((f) => f.type.startsWith("image/"));
    if (files.length) { e.preventDefault(); addFiles(files); }
  };

  const read = async () => {
    setError("");
    setBusy("reading");
    try {
      const res = await crmApi.preview({ text, images: images.map(({ mediaType, data }) => ({ mediaType, data })), personId: personId || null });
      setPreview(res);
      setTarget(res.candidates.length === 1 ? res.candidates[0].id : "new");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  };

  const save = async () => {
    if (!preview) return;
    setError("");
    setBusy("saving");
    try {
      const res = await crmApi.save({ personId: personId || (target === "new" ? null : target), text, extraction: preview.extraction, imageCount: images.length });
      setText(""); setImages([]); setPreview(null);
      onSaved(res);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  };

  const p = preview?.extraction.person;
  const row = (label: string, value?: string | null) => (value ? (
    <Stack direction="row" spacing={1}><Typography variant="body2" sx={{ minWidth: 110, color: "var(--text-muted)" }}>{label}</Typography><Typography variant="body2">{value}</Typography></Stack>
  ) : null);

  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <AiIcon fontSize="small" color="primary" />
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{personId ? "Add what you learned" : "Quick capture"}</Typography>
        </Stack>
        {!preview && (
          <>
            <Typography variant="body2" sx={{ color: "var(--text-muted)", mb: 1 }}>
              Paste notes or a conversation, or paste/drop screenshots. The AI fills in the details and keeps prayer requests and needs.
            </Typography>
            <Box onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}>
              <TextField
                multiline minRows={compact ? 3 : 5} maxRows={16} fullWidth value={text} onChange={(e) => setText(e.target.value)} onPaste={onPaste}
                placeholder={personId ? "e.g. Called today. He leads 3 churches in Gulu and asked us to pray for his wife's health." : "e.g. Met Pastor Samuel Okello from Kampala, Uganda on the Tuesday study. +256 772 123456. Wants to bring his leaders to the conference."}
                data-testid="crm-capture-text"
              />
            </Box>
            {images.length > 0 && (
              <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                {images.map((img, i) => (
                  <Box key={i} sx={{ position: "relative" }}>
                    <img src={img.preview} alt="" style={{ height: 72, borderRadius: 6, border: "1px solid var(--border-light)" }} />
                    <IconButton size="small" onClick={() => setImages(images.filter((_, j) => j !== i))} sx={{ position: "absolute", top: -8, right: -8, bgcolor: "background.paper" }}><CloseIcon fontSize="inherit" /></IconButton>
                  </Box>
                ))}
              </Stack>
            )}
            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
              <Button variant="contained" startIcon={<AiIcon />} disabled={!!busy || (!text.trim() && !images.length)} onClick={read} data-testid="crm-capture-read">
                {busy === "reading" ? "Reading..." : "Read it"}
              </Button>
              <Button startIcon={<ImageIcon />} onClick={() => fileRef.current?.click()} disabled={!!busy}>Screenshots</Button>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
            </Stack>
          </>
        )}

        {preview && p && (
          <Box>
            <Typography variant="body2" sx={{ mb: 1.5 }}>{preview.extraction.noteSummary}</Typography>
            <Stack spacing={0.5} sx={{ mb: 1.5 }}>
              {row("Name", [p.firstName, p.lastName].filter(Boolean).join(" "))}
              {row("Email", p.emails.join(", "))}
              {row("Phone", p.phones.join(", "))}
              {row("Place", [p.city, p.region, p.countryCode].filter(Boolean).join(", "))}
              {row("Time zone", p.timezone)}
              {row("Languages", p.languages.join(", "))}
              {row("Ministry", [p.ministryRole, p.organization].filter(Boolean).join(", "))}
              {p.contactConsent !== "unknown" && row("May contact", p.contactConsent === "yes" ? "Yes, agreed to hear about events" : "No")}
            </Stack>
            {preview.extraction.facts.length > 0 && (
              <Stack spacing={0.5} sx={{ mb: 1.5 }}>
                {preview.extraction.facts.map((f, i) => (
                  <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                    <Chip size="small" label={FACT_LABEL[f.kind] || f.kind} color={f.kind === "prayer" ? "secondary" : f.kind === "followup" ? "warning" : "default"} />
                    <Typography variant="body2">{f.text}</Typography>
                  </Stack>
                ))}
              </Stack>
            )}
            {preview.extraction.tags.length > 0 && (
              <Stack direction="row" spacing={0.5} sx={{ mb: 1.5, flexWrap: "wrap" }}>{preview.extraction.tags.map((t) => <Chip key={t} size="small" variant="outlined" label={t} />)}</Stack>
            )}
            {preview.extraction.transcript && (
              <details style={{ marginBottom: 12 }}>
                <summary style={{ cursor: "pointer", fontSize: 13 }}>Screenshot transcript</summary>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", mt: 1, color: "var(--text-muted)" }}>{preview.extraction.transcript}</Typography>
              </details>
            )}

            {!personId && (
              <>
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Who is this?</Typography>
                <List dense disablePadding>
                  {preview.candidates.map((c) => (
                    <ListItemButton key={c.id} onClick={() => setTarget(c.id)} selected={target === c.id}>
                      <Radio size="small" checked={target === c.id} />
                      <ListItemText primary={c.displayName} secondary={[c.membershipStatus, c.email, c.mobilePhone, [c.city, c.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ")} />
                    </ListItemButton>
                  ))}
                  <ListItemButton onClick={() => setTarget("new")} selected={target === "new"}>
                    <Radio size="small" checked={target === "new"} />
                    <ListItemText primary="A new person" secondary={preview.candidates.length ? "None of these" : "No one in the CRM matches"} />
                  </ListItemButton>
                </List>
              </>
            )}

            <Typography variant="caption" sx={{ display: "block", color: "var(--text-muted)", mt: 1 }}>
              Saving fills empty fields only; anything that differs from the record is kept as a note.
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
              <Button variant="contained" onClick={save} disabled={!!busy} data-testid="crm-capture-save">{busy === "saving" ? "Saving..." : "Save to profile"}</Button>
              <Button onClick={() => setPreview(null)} disabled={!!busy}>Back</Button>
            </Stack>
          </Box>
        )}
        {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
      </CardContent>
    </Card>
  );
};
