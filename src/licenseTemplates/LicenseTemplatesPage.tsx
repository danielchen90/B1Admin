import React from "react";
import { useNavigate } from "react-router-dom";
import { ApiHelper, PageHeader } from "@churchapps/apphelper";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, Box, Button, Card, Chip, Collapse, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { Badge as BadgeIcon, Add as AddIcon, Star as StarIcon } from "@mui/icons-material";
import { CountChip, StatusChip, PageBreadcrumbs } from "../components/ui";
import { canManageOrdinationTypes, parseApiError } from "../helpers/OrdinationHelper";
import { useLicenseTemplates } from "../hooks/useLicenseTemplates";
import { useOrdinationTypes } from "../hooks/useOrdinationTypes";
import { type LicenseTemplateInterface } from "./LicenseTemplateInterface";

// Template management list + lifecycle (TPL-04). Mirrors the OrdinationTypes settings
// screen: any settings user may VIEW, while write affordances (new/edit/set-default/
// activate/soft-delete) sit behind canManageOrdinationTypes() — the SAME Leadership-Admin
// dual gate the 05-02 server enforces (templates are church-wide like ordination types;
// we deliberately do NOT invent a new client gate). Reads/mutations use the BARE
// /licenseTemplates path (MembershipApi base already ends in /membership).
export const LicenseTemplatesPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const templates = useLicenseTemplates();
  const ordinationTypes = useOrdinationTypes();
  const canManage = canManageOrdinationTypes();

  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const typeMap = React.useMemo(() => Object.fromEntries(ordinationTypes.map((t) => [t.id, t.name])), [ordinationTypes]);

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["/licenseTemplates", "MembershipApi"] });

  // Translate the 409 codes the 05-02 controller emits into clear admin-facing copy.
  const reportError = (e: any) => {
    const code = parseApiError(e);
    if (code === "version_conflict") setError("That template changed elsewhere — reload and try again.");
    else if (code === "duplicate_default") setError("Another template is already the default.");
    else if (code === "duplicate_active_type") setError("Another active template is already bound to that ordination type.");
    else setError(e?.message || "Action failed.");
  };

  // Lifecycle mutations re-POST the loaded row (id present → server routes to update
  // under OCC); the DB unique flags enforce one-default / one-active-per-type.
  const mutate = async (row: LicenseTemplateInterface, patch: Partial<LicenseTemplateInterface>) => {
    if (!canManage || !row.id) return;
    setBusyId(row.id);
    setError(null);
    try {
      await ApiHelper.post("/licenseTemplates", { ...row, ...patch }, "MembershipApi");
      await refetch();
    } catch (e) {
      reportError(e);
    } finally {
      setBusyId(null);
    }
  };

  const handleSetDefault = (row: LicenseTemplateInterface) => mutate(row, { isDefault: true });
  const handleToggleActive = (row: LicenseTemplateInterface) => mutate(row, { active: !row.active });

  const handleDelete = async (row: LicenseTemplateInterface) => {
    if (!canManage || !row.id) return;
    setBusyId(row.id);
    setError(null);
    try {
      await ApiHelper.post("/licenseTemplates/" + row.id + "/delete", { version: row.version }, "MembershipApi");
      await refetch();
    } catch (e) {
      reportError(e);
    } finally {
      setBusyId(null);
    }
  };

  const bindingLabel = (row: LicenseTemplateInterface): string =>
    row.ordinationTypeId ? (typeMap[row.ordinationTypeId] || "Unknown type") : "All types / Global default";

  const rows = templates.map((t) => {
    const busy = busyId === t.id;
    return (
      <TableRow key={t.id} hover sx={{ cursor: "pointer" }} onClick={() => navigate("/license-templates/" + t.id)} data-testid={`license-template-row-${t.id}`}>
        <TableCell>
          <Stack direction="row" spacing={1} alignItems="center">
            <BadgeIcon sx={{ color: "primary.main", fontSize: 20 }} />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>{t.name || "(untitled)"}</Typography>
          </Stack>
        </TableCell>
        <TableCell>
          <Typography variant="body2" color="text.secondary">{bindingLabel(t)}</Typography>
        </TableCell>
        <TableCell>
          {t.isDefault ? <Chip size="small" color="primary" icon={<StarIcon />} label="Default" /> : <Typography variant="body2" color="text.secondary">—</Typography>}
        </TableCell>
        <TableCell>
          <StatusChip status={t.active ? "active" : "inactive"} />
        </TableCell>
        <TableCell>
          <Typography variant="body2" color="text.secondary">v{t.currentVersion ?? "—"}</Typography>
        </TableCell>
        {canManage && (
          <TableCell align="right" onClick={(e) => e.stopPropagation()}>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button size="small" disabled={busy || t.isDefault} onClick={() => handleSetDefault(t)}>Set default</Button>
              <Button size="small" disabled={busy} onClick={() => handleToggleActive(t)}>{t.active ? "Deactivate" : "Activate"}</Button>
              <Button size="small" onClick={() => navigate("/license-templates/" + t.id)}>Edit</Button>
              <Button size="small" color="error" disabled={busy} onClick={() => handleDelete(t)}>Delete</Button>
            </Stack>
          </TableCell>
        )}
      </TableRow>
    );
  });

  return (
    <>
      <PageBreadcrumbs items={[{ label: "Settings", path: "/settings" }, { label: "License Templates" }]} />
      <PageHeader title="License Templates" subtitle="Design and manage CR80 ministerial-license card templates." />
      <Box sx={{ p: 3 }}>
        <Collapse in={!!error}>
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>
        </Collapse>

        <Card sx={{ borderRadius: 2, border: "1px solid", borderColor: "grey.200" }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2, borderBottom: 1, borderColor: "var(--border-light)" }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <BadgeIcon sx={{ color: "primary.main", fontSize: 20 }} />
              <Typography variant="h6">License Templates</Typography>
              {templates.length > 0 && <CountChip count={templates.length} />}
            </Stack>
            {canManage && (
              <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => navigate("/license-templates/new")} data-testid="add-license-template-button">
                New template
              </Button>
            )}
          </Stack>

          {templates.length > 0 ? (
            <Table>
              <TableHead sx={{ backgroundColor: "var(--bg-sub)" }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Binding</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Default</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Version</TableCell>
                  {canManage && <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>{rows}</TableBody>
            </Table>
          ) : (
            <Box sx={{ p: 5, textAlign: "center" }}>
              <BadgeIcon sx={{ fontSize: 48, color: "grey.400", mb: 1 }} />
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>No license templates yet.</Typography>
              {canManage && (
                <Button variant="outlined" startIcon={<AddIcon />} onClick={() => navigate("/license-templates/new")} data-testid="add-license-template-button-empty">
                  New template
                </Button>
              )}
            </Box>
          )}
        </Card>
      </Box>
    </>
  );
};

export default LicenseTemplatesPage;
