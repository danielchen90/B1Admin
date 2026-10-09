import React, { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Checkbox, FormControlLabel, Grid, IconButton, Link, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { Add as AddIcon, AutoAwesome as AiIcon, Delete as DeleteIcon, Upload as UploadIcon } from "@mui/icons-material";
import { errorText } from "../crmApi";
import { eventsApi, type CrmEvent, type EventPage, type EventQuestion } from "./eventsApi";

// The public page: AI drafts it from the details, staff edit every line. Plus the flyer (people
// download it to share with their churches) and the form's extra questions. Name, email, phone,
// country, city, language, ministry role, church, group size and "may we contact you" are always
// asked; these questions come on top.

const EMPTY: EventPage = { headline: "", intro: "", highlights: [], topics: [], whoShouldCome: "", faq: [], closing: "" };

interface Props { ev: CrmEvent; canEdit: boolean; onSave: (patch: Partial<CrmEvent>) => Promise<void>; reload: () => void }

export const EventPageTab: React.FC<Props> = ({ ev, canEdit, onSave, reload }) => {
  const [page, setPage] = useState<EventPage>(ev.page || EMPTY);
  const [questions, setQuestions] = useState<EventQuestion[]>(ev.questions || []);
  const [busy, setBusy] = useState<"" | "draft" | "save" | "flyer">("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setPage(ev.page || EMPTY); setQuestions(ev.questions || []); }, [ev.page, ev.questions]);

  const draft = async () => {
    if (ev.page && !window.confirm("Replace the current page text with a new draft?")) return;
    setBusy("draft"); setError("");
    try { const d = await eventsApi.draftPage(ev.id); setPage(d.page); setQuestions(d.questions); reload(); } catch (e) { setError(errorText(e)); } finally { setBusy(""); }
  };
  const save = async () => {
    setBusy("save"); setError("");
    try { await onSave({ page, questions }); } catch (e) { setError(errorText(e)); } finally { setBusy(""); }
  };
  const upload = async (file: File) => {
    setBusy("flyer"); setError("");
    try {
      const data = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(file); });
      await eventsApi.flyer(ev.id, data.split(",")[1], file.type);
      reload();
    } catch (e) { setError(errorText(e)); } finally { setBusy(""); }
  };

  const lines = (key: "highlights", label: string) => (
    <Stack spacing={1}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>{label}</Typography>
      {page[key].map((h, i) => (
        <Stack key={i} direction="row" spacing={1}>
          <TextField size="small" fullWidth value={h} disabled={!canEdit} onChange={(e) => setPage({ ...page, [key]: page[key].map((x, j) => (j === i ? e.target.value : x)) })} />
          {canEdit && <IconButton onClick={() => setPage({ ...page, [key]: page[key].filter((_, j) => j !== i) })}><DeleteIcon fontSize="small" /></IconButton>}
        </Stack>
      ))}
      {canEdit && <Button size="small" startIcon={<AddIcon />} sx={{ alignSelf: "flex-start" }} onClick={() => setPage({ ...page, [key]: [...page[key], ""] })}>Add</Button>}
    </Stack>
  );

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 8 }}>
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>Landing page</Typography>
              {canEdit && <Button variant={ev.page ? "outlined" : "contained"} startIcon={<AiIcon />} onClick={draft} disabled={!!busy} data-testid="event-draft">{busy === "draft" ? "Writing..." : ev.page ? "Draft again" : "Draft with AI"}</Button>}
            </Stack>
            {!ev.page && !page.headline && <Alert severity="info" sx={{ mb: 2 }}>Fill in the details first, then "Draft with AI" writes the page from them. You can change every word.</Alert>}
            <Stack spacing={2}>
              <TextField label="Headline" value={page.headline} onChange={(e) => setPage({ ...page, headline: e.target.value })} disabled={!canEdit} />
              <TextField label="Introduction" multiline minRows={3} value={page.intro} onChange={(e) => setPage({ ...page, intro: e.target.value })} disabled={!canEdit} />
              {lines("highlights", "What to expect")}
              <Stack spacing={1}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>Topics on the page</Typography>
                {page.topics.map((t, i) => (
                  <Stack key={i} direction="row" spacing={1}>
                    <TextField size="small" label="Topic" value={t.title} sx={{ flex: 2 }} disabled={!canEdit} onChange={(e) => setPage({ ...page, topics: page.topics.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
                    <TextField size="small" label="About it" value={t.detail} sx={{ flex: 3 }} multiline disabled={!canEdit} onChange={(e) => setPage({ ...page, topics: page.topics.map((x, j) => (j === i ? { ...x, detail: e.target.value } : x)) })} />
                    {canEdit && <IconButton onClick={() => setPage({ ...page, topics: page.topics.filter((_, j) => j !== i) })}><DeleteIcon fontSize="small" /></IconButton>}
                  </Stack>
                ))}
                {canEdit && <Button size="small" startIcon={<AddIcon />} sx={{ alignSelf: "flex-start" }} onClick={() => setPage({ ...page, topics: [...page.topics, { title: "", detail: "" }] })}>Add</Button>}
              </Stack>
              <TextField label="Who should come" multiline value={page.whoShouldCome} onChange={(e) => setPage({ ...page, whoShouldCome: e.target.value })} disabled={!canEdit} />
              <Stack spacing={1}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>Questions and answers</Typography>
                {page.faq.map((x, i) => (
                  <Stack key={i} direction="row" spacing={1}>
                    <TextField size="small" label="Question" value={x.q} sx={{ flex: 2 }} disabled={!canEdit} onChange={(e) => setPage({ ...page, faq: page.faq.map((y, j) => (j === i ? { ...y, q: e.target.value } : y)) })} />
                    <TextField size="small" label="Answer" value={x.a} sx={{ flex: 3 }} multiline disabled={!canEdit} onChange={(e) => setPage({ ...page, faq: page.faq.map((y, j) => (j === i ? { ...y, a: e.target.value } : y)) })} />
                    {canEdit && <IconButton onClick={() => setPage({ ...page, faq: page.faq.filter((_, j) => j !== i) })}><DeleteIcon fontSize="small" /></IconButton>}
                  </Stack>
                ))}
                {canEdit && <Button size="small" startIcon={<AddIcon />} sx={{ alignSelf: "flex-start" }} onClick={() => setPage({ ...page, faq: [...page.faq, { q: "", a: "" }] })}>Add</Button>}
              </Stack>
              <TextField label="Closing line" value={page.closing} onChange={(e) => setPage({ ...page, closing: e.target.value })} disabled={!canEdit} />
            </Stack>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Flyer</Typography>
            {ev.imageUrl && <img src={ev.imageUrl} alt="" style={{ width: "100%", borderRadius: 8, marginBottom: 8 }} />}
            {ev.flyerUrl && <Link href={ev.flyerUrl} target="_blank" rel="noopener" sx={{ display: "block", mb: 1 }}>Open the flyer</Link>}
            {!ev.flyerUrl && <Typography variant="body2" sx={{ color: "var(--text-muted)", mb: 1 }}>Upload the flyer (image or PDF). Visitors can download it to share.</Typography>}
            {canEdit && <Button startIcon={<UploadIcon />} onClick={() => fileRef.current?.click()} disabled={!!busy}>{busy === "flyer" ? "Uploading..." : ev.flyerUrl ? "Replace" : "Upload"}</Button>}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(file); e.target.value = ""; }} />
          </CardContent>
        </Card>
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>Extra registration questions</Typography>
            <Typography variant="caption" sx={{ color: "var(--text-muted)", display: "block", mb: 1.5 }}>Always asked: name, email, phone, country, city, language, ministry role, church, how many they bring, and permission to contact them.</Typography>
            <Stack spacing={1.5}>
              {questions.map((q, i) => (
                <Box key={i} sx={{ p: 1, border: "1px solid var(--border-light)", borderRadius: 1 }}>
                  <Stack direction="row" spacing={1}>
                    <TextField size="small" fullWidth label="Question" value={q.label} disabled={!canEdit} onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                    {canEdit && <IconButton onClick={() => setQuestions(questions.filter((_, j) => j !== i))}><DeleteIcon fontSize="small" /></IconButton>}
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                    <TextField select size="small" label="Answer" value={q.type} disabled={!canEdit} onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? { ...x, type: e.target.value as any } : x)))} sx={{ minWidth: 120 }}>
                      <MenuItem value="text">Short text</MenuItem><MenuItem value="textarea">Long text</MenuItem><MenuItem value="select">Choice</MenuItem><MenuItem value="yesno">Yes / no</MenuItem>
                    </TextField>
                    <FormControlLabel control={<Checkbox size="small" checked={q.required} disabled={!canEdit} onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)))} />} label="Required" />
                  </Stack>
                  {q.type === "select" && (
                    <TextField size="small" fullWidth sx={{ mt: 1 }} label="Choices (comma separated)" value={q.options.join(", ")} disabled={!canEdit}
                      onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? { ...x, options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } : x)))} />
                  )}
                </Box>
              ))}
              {canEdit && <Button size="small" startIcon={<AddIcon />} sx={{ alignSelf: "flex-start" }} onClick={() => setQuestions([...questions, { id: "q" + Date.now().toString(36), label: "", type: "text", options: [], required: false }])}>Add question</Button>}
            </Stack>
          </CardContent>
        </Card>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {canEdit && <Button variant="contained" fullWidth onClick={save} disabled={!!busy}>{busy === "save" ? "Saving..." : "Save page and questions"}</Button>}
      </Grid>
    </Grid>
  );
};
