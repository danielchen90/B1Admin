import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Permissions, UserHelper } from "@churchapps/helpers";
import { Loading, PageHeader } from "@churchapps/apphelper";
import { Alert, Box, Button, Chip, Stack, Tab, Tabs } from "@mui/material";
import { ContentCopy as CopyIcon, Event as EventIcon, OpenInNew as OpenIcon } from "@mui/icons-material";
import { PageBreadcrumbs } from "../../components/ui";
import { errorText } from "../crmApi";
import { eventsApi, ERROR_TEXT, KIND_LABEL, type CrmEvent } from "./eventsApi";
import { EventDetailsTab } from "./EventDetailsTab";
import { EventPageTab } from "./EventPageTab";
import { EventRegistrationsTab } from "./EventRegistrationsTab";
import { EventEmailsTab } from "./EventEmailsTab";

// One event: details -> page and form -> publish -> registrations -> emails.

export const EventEditorPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const canEdit = UserHelper.checkAccess(Permissions.membershipApi.people.edit);
  const q = useQuery<CrmEvent>({ queryKey: ["crm-event", id], queryFn: () => eventsApi.get(id!), enabled: !!id });
  const [tab, setTab] = useState("details");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const ev = q.data;

  const save = async (patch: any) => {
    setError("");
    try { await eventsApi.save(id!, patch); await q.refetch(); } catch (e) { const code = errorText(e); setError(ERROR_TEXT[code] || code); throw e; }
  };
  const setStatus = (status: CrmEvent["status"]) => save({ status }).catch(() => {});

  if (q.isLoading) return <Loading />;
  if (!ev) return <Box sx={{ p: 3 }}><Alert severity="warning">{errorText(q.error) || "Event not found."}</Alert></Box>;

  return (
    <>
      <PageBreadcrumbs items={[{ label: "CRM", path: "/crm" }, { label: "Events", path: "/crm/events" }, { label: ev.title }]} />
      <PageHeader title={ev.title} subtitle={`${KIND_LABEL[ev.kind] || "Event"} · ${ev.registrations} registered`} icon={<EventIcon />}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap", gap: 1 }}>
          <Chip label={ev.status === "published" ? "Published" : ev.status === "closed" ? "Closed" : "Draft"} sx={{ color: "#FFF", borderColor: "rgba(255,255,255,0.5)" }} variant="outlined" />
          {ev.status !== "draft" && (
            <>
              <Button variant="outlined" startIcon={<OpenIcon />} href={ev.url} target="_blank" rel="noopener" sx={{ color: "#FFF", borderColor: "rgba(255,255,255,0.5)" }}>Open page</Button>
              <Button variant="outlined" startIcon={<CopyIcon />} sx={{ color: "#FFF", borderColor: "rgba(255,255,255,0.5)" }}
                onClick={() => { navigator.clipboard.writeText(ev.url); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>{copied ? "Copied" : "Copy link"}</Button>
            </>
          )}
          {canEdit && ev.status === "draft" && <Button variant="contained" color="secondary" onClick={() => setStatus("published")} data-testid="event-publish">Publish and open registration</Button>}
          {canEdit && ev.status === "published" && <Button variant="outlined" sx={{ color: "#FFF", borderColor: "rgba(255,255,255,0.5)" }} onClick={() => setStatus("closed")}>Close</Button>}
          {canEdit && ev.status !== "published" && ev.status !== "draft" && <Button variant="outlined" sx={{ color: "#FFF", borderColor: "rgba(255,255,255,0.5)" }} onClick={() => setStatus("published")}>Reopen</Button>}
        </Stack>
      </PageHeader>
      <Box sx={{ px: { xs: 1, md: 2 } }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" sx={{ mb: 2 }}>
          <Tab value="details" label="Details" />
          <Tab value="page" label="Page and form" />
          <Tab value="registrations" label={`Registrations (${ev.registrations})`} />
          <Tab value="emails" label="Emails" />
        </Tabs>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
        {ev.status === "draft" && tab === "details" && <Alert severity="info" sx={{ mb: 2 }}>Fill in the details, draft the page, then publish. Nothing is public until you publish.</Alert>}
        {tab === "details" && <EventDetailsTab ev={ev} canEdit={canEdit} onSave={save} />}
        {tab === "page" && <EventPageTab ev={ev} canEdit={canEdit} onSave={save} reload={() => q.refetch()} />}
        {tab === "registrations" && <EventRegistrationsTab ev={ev} canEdit={canEdit} />}
        {tab === "emails" && <EventEmailsTab ev={ev} canEdit={canEdit} reload={() => q.refetch()} />}
        {canEdit && tab === "details" && (
          <Box sx={{ mt: 4, mb: 2 }}>
            <Button color="error" size="small" onClick={async () => {
              if (!window.confirm(`Delete "${ev.title}" with its ${ev.registrations} registrations and emails? People stay in the CRM.`)) return;
              await eventsApi.remove(ev.id); navigate("/crm/events");
            }}>Delete event</Button>
          </Box>
        )}
      </Box>
    </>
  );
};
