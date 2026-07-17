// TemplateEditor.tsx — the editing surface orchestrator (RESEARCH §Editor Shell).
//
// This is the SINGLE SOURCE OF TRUTH for the in-memory LicenseTemplateLayout. The
// Canvas + CanvasElement (05-04) are dumb/controlled and receive layout + zoom + the
// mutation callbacks defined here. mm geometry + pt font size are authoritative; px is
// only ever derived inside CanvasElement via the one PX_PER_MM bridge.
//
// Add paths (TPL-01):
//   - PRIMARY: pick a binding from the BindingList → drops a pre-configured boundText.
//   - SEPARATE toolbar controls add static text, a logo image, a photo placeholder, and
//     open the (named) background slot for upload.
// The PropertyPanel edits exact mm geometry + text styling + image/background upload.
// The LayersPanel reorders explicit z-order (background stays at the back — it is a
// NAMED slot, not a reorderable element).
//
// Persistence (05-06, TPL-03/TPL-04):
//   - Route :id === "new" opens newLayout(); any other id loads that template row.
//   - Save POSTs the single template object; OMITTING id when creating (server's
//     isNew = !item.id routes to create) and SENDING the loaded id on edit (routes to
//     update under OCC). The reloaded bumped row updates state and the URL.
//   - parseApiError classifies version_conflict / duplicate_default / duplicate_active_type.
//   - Preview runs against SAMPLE_BINDINGS or a picked real person's resolved data.
//
// PATH CONTRACT (cross-plan, Rule 1): the apphelper MembershipApi base ALREADY ends in
// /membership, so every resource path here is BARE "/licenseTemplates" — the plan's
// literal "/membership/licenseTemplates" would double to .../membership/membership/...
// and 404 (Phase 3 commit b113676d; reaffirmed in 04-02; matches useLicenseTemplates
// and the 05-01/05-03 notes).

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, Box, Button, Checkbox, CircularProgress, Collapse, FormControlLabel, MenuItem, Select, Slider, Snackbar, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { ApiHelper, PageHeader, PersonHelper, UniqueIdHelper, UserHelper } from "@churchapps/apphelper";
import type { PersonInterface } from "@churchapps/helpers";
import type { LayoutElement, LicenseTemplateInterface, LicenseTemplateLayout, TemplateFormat } from "../LicenseTemplateInterface";
import { newLayout } from "../helpers/coords";
import { PageBreadcrumbs } from "../../components/ui";
import { BINDING_CATALOG, SAMPLE_BINDINGS, formatCampusAddress } from "../helpers/bindings";
import { loadEditorFonts } from "../helpers/fonts";
import { useOrdinationTypes } from "../../hooks/useOrdinationTypes";
import { useCampuses } from "../../hooks/useCampuses";
import type { CampusInterface } from "../../settings/components/CampusInterface";
import { parseApiError } from "../../helpers/OrdinationHelper";
import { PersonAdd } from "../../components/PersonAdd";
import type { PersonOrdinationInterface } from "../../people/components/PersonOrdinationInterface";
import { Canvas } from "./Canvas";
import { CanvasElement } from "./CanvasElement";
import { PropertyPanel } from "./PropertyPanel";
import { BindingList } from "./BindingList";
import { LayersPanel } from "./LayersPanel";

interface Props {
  initialLayout?: LicenseTemplateLayout; // optional override; the route normally loads by :id
}

// Default text styling for newly-added text elements (whitelist key + bundled weight).
const DEFAULT_TEXT_STYLE = { family: "sans", sizePt: 10, weight: 400 as const, color: "#000000", align: "left" as const };

// Build a flat preview map (same friendly keys as SAMPLE_BINDINGS) from a picked real
// person + their active ordination, resolving type/campus GUIDs to names. Mirrors the
// BINDING_REAL_PATHS contract from 05-03 (Person.name is a Name object; rest are flat).
const buildRealPreview = (
  person: PersonInterface,
  ord: PersonOrdinationInterface,
  typeName?: string,
  typeCode?: string,
  campus?: CampusInterface
): Record<string, string> => ({
  "person.fullName": [person.name?.first, person.name?.last].filter(Boolean).join(" "),
  "person.lastName": person.name?.last || "",
  "person.firstName": person.name?.first || "",
  "person.displayName": person.name?.display || "",
  "person.middleName": person.name?.middle || "",
  // The person's stored picture (the "license picture" — Phase 6 applies the saved crop transform).
  "person.photoUrl": PersonHelper.getPhotoUrl(person) || "",
  "ordinationType.name": typeName || "",
  "ordinationType.code": typeCode || "",
  "campus.name": campus?.name || "",
  "campus.address": formatCampusAddress(campus),
  "campus.city": campus?.city || "",
  "campus.state": campus?.state || "",
  credentialNumber: ord.credentialNumber || "",
  "ordination.grantedDate": ord.grantedDate || "",
  "ordination.expirationDate": ord.expirationDate || "",
  "ordination.status": ord.status || "",
  "church.name": (UserHelper.currentUserChurch as any)?.church?.name || ""
});

export const TemplateEditor: React.FC<Props> = ({ initialLayout }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [layout, setLayout] = useState<LicenseTemplateLayout>(() => initialLayout ?? newLayout());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Creation-time page format (card / letter certificate). Only offered while creating a
  // brand-new, empty template — switching re-seeds the canvas via newLayout(format), which
  // resets geometry (acceptable when empty). Not shown once elements exist or a row loaded.
  const [format, setFormat] = useState<TemplateFormat>(() => (initialLayout?.canvas.format ?? "card"));
  const [zoom, setZoom] = useState<number>(3); // fit-to-screen default (manual zoom, no snapping)
  const [previewData, setPreviewData] = useState<Record<string, string>>(SAMPLE_BINDINGS);
  const [previewMode, setPreviewMode] = useState<"sample" | "person">("sample");

  // ----- template row state (persisted alongside the layout) --------------------------
  const [templateId, setTemplateId] = useState<string | undefined>(undefined);
  const [name, setName] = useState<string>("");
  const [ordinationTypeId, setOrdinationTypeId] = useState<string | null>(null);
  const [isDefault, setIsDefault] = useState<boolean>(false);
  const [active, setActive] = useState<boolean>(true);
  const [currentVersion, setCurrentVersion] = useState<number | undefined>(undefined);
  const [version, setVersion] = useState<number | undefined>(undefined);

  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Caches for resolving type/campus names in the real-person preview + the binding Select.
  const ordinationTypes = useOrdinationTypes();
  const campuses = useCampuses();
  const ordinationTypeMap = useMemo(() => Object.fromEntries(ordinationTypes.map((t) => [t.id, t])), [ordinationTypes]);
  const campusMap = useMemo(() => Object.fromEntries(campuses.map((c) => [c.id, c])), [campuses]);

  // Load the curated families once so preview metrics match the Phase 6 render.
  useEffect(() => { loadEditorFonts(); }, []);

  // ----- load-by-id (TPL-03) ---------------------------------------------------------
  const applyRow = (row: LicenseTemplateInterface) => {
    setTemplateId(row.id);
    setName(row.name || "");
    setOrdinationTypeId(row.ordinationTypeId ?? null);
    setIsDefault(!!row.isDefault);
    setActive(row.active !== false);
    setCurrentVersion(row.currentVersion);
    setVersion(row.version);
    if (row.layoutJson) {
      try {
        const parsed = JSON.parse(row.layoutJson) as LicenseTemplateLayout;
        setLayout(parsed);
        setFormat(parsed.canvas.format ?? "card");
      } catch { /* keep current layout on parse failure */ }
    }
  };

  // Re-seed a brand-new empty template to the chosen page format (resets geometry — safe
  // while empty). Guarded by the picker's own visibility (no id, no elements).
  const handleFormatChange = (next: TemplateFormat | null) => {
    if (!next) return;
    setFormat(next);
    setLayout(newLayout(next));
    setSelectedId(null);
  };

  // The format picker is only meaningful for a brand-new, empty template: re-seeding
  // would discard element geometry, so hide it once a row loaded or any element exists.
  const canChooseFormat = !templateId && (!id || id === "new") && layout.elements.length === 0;

  const loadRow = (rowId: string) => {
    setLoading(true);
    ApiHelper.get("/licenseTemplates/" + rowId, "MembershipApi")
      .then((row) => { if (row && row.id) applyRow(row); })
      .catch((e: any) => setError(e?.message || "Failed to load template."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!id || id === "new") return;
    loadRow(id);

  }, [id]);

  // ----- save (TPL-03 + TPL-04) ------------------------------------------------------
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    // CRITICAL id contract: OMIT id entirely when creating (server isNew = !item.id →
    // create); SEND the loaded id on edit (→ update under OCC). churchId is server-derived.
    const payload: LicenseTemplateInterface = {
      ...(templateId ? { id: templateId } : {}),
      name,
      ordinationTypeId, // null = global default (applies to all types)
      isDefault,
      active,
      currentVersion,
      version,
      layoutJson: JSON.stringify(layout)
    };
    try {
      const result = await ApiHelper.post("/licenseTemplates", payload, "MembershipApi");
      const row: LicenseTemplateInterface = Array.isArray(result) ? result[0] : result;
      applyRow(row);
      setSuccess("Template saved (version " + (row?.currentVersion ?? "?") + ").");
      // Stay on the editor but reflect the saved id in the URL so reloads/edits route right.
      if (row?.id && row.id !== id) navigate("/license-templates/" + row.id, { replace: true });
    } catch (e: any) {
      const code = parseApiError(e);
      if (code === "version_conflict") {
        setError("This template changed elsewhere; reload to get the latest.");
        if (templateId) loadRow(templateId);
      } else if (code === "duplicate_default") {
        setError("Another template is already the default.");
      } else if (code === "duplicate_active_type") {
        setError("Another active template is already bound to this ordination type.");
      } else {
        setError(e?.message || "Save failed.");
      }
    } finally {
      setSaving(false);
    }
  };

  // ----- element mutation helpers (passed to children) -------------------------------
  const addElement = (partial: Omit<LayoutElement, "id" | "z">) => {
    const newId = UniqueIdHelper.shortId();
    setLayout((prev) => {
      const z = prev.elements.reduce((m, e) => Math.max(m, e.z), 0) + 1;
      return { ...prev, elements: [...prev.elements, { ...partial, id: newId, z } as LayoutElement] };
    });
    setSelectedId(newId);
  };

  const updateElement = (elId: string, patch: Record<string, any>) =>
    setLayout((prev) => ({
      ...prev,
      elements: prev.elements.map((e) => (e.id === elId ? ({ ...e, ...patch } as LayoutElement) : e))
    }));

  const removeElement = (elId: string) => {
    setLayout((prev) => ({ ...prev, elements: prev.elements.filter((e) => e.id !== elId) }));
    setSelectedId((cur) => (cur === elId ? null : cur));
  };

  const selectElement = (elId: string | null) => setSelectedId(elId);

  const setBackground = (src: string | undefined, fit: "cover" | "contain") =>
    setLayout((prev) => ({ ...prev, background: src ? { src, fit } : undefined }));

  // z-order ops for the LayersPanel. reorder rewrites each element's z to its index in
  // the supplied back→front ordering; bringToFront bumps one element above the rest.
  const reorder = (orderedIds: string[]) =>
    setLayout((prev) => ({ ...prev, elements: prev.elements.map((e) => ({ ...e, z: orderedIds.indexOf(e.id) })) }));

  const bringToFront = (elId: string) =>
    setLayout((prev) => {
      const maxZ = prev.elements.reduce((m, e) => Math.max(m, e.z), 0);
      return { ...prev, elements: prev.elements.map((e) => (e.id === elId ? { ...e, z: maxZ + 1 } : e)) };
    });

  // ----- toolbar add controls (distinct from the binding list) -----------------------
  const addStaticText = () =>
    addElement({ type: "staticText", text: "Text", xMm: 10, yMm: 10, wMm: 30, hMm: 8, font: { ...DEFAULT_TEXT_STYLE } });

  const addLogo = () => addElement({ type: "image", src: "", fit: "contain", xMm: 10, yMm: 10, wMm: 25, hMm: 15 });

  const addPhoto = () =>
    addElement({ type: "photo", fit: "cover", shape: "rounded", xMm: 10, yMm: 10, wMm: 20, hMm: 26 });

  // Clearing the selection surfaces the background controls in the PropertyPanel.
  const editBackground = () => setSelectedId(null);

  const addBinding = (binding: string) => {
    const def = BINDING_CATALOG.find((b) => b.key === binding);
    addElement({
      type: "boundText",
      binding,
      xMm: 10,
      yMm: 10,
      wMm: 30,
      hMm: 8,
      font: { ...DEFAULT_TEXT_STYLE },
      ...(def?.isDate ? { dateFormat: "MMM D, YYYY" } : {})
    });
  };

  // ----- real-person preview ---------------------------------------------------------
  const handlePreviewMode = (mode: "sample" | "person" | null) => {
    if (!mode) return;
    setPreviewMode(mode);
    if (mode === "sample") setPreviewData(SAMPLE_BINDINGS);
  };

  const handlePickPerson = async (person: PersonInterface) => {
    try {
      const ords = await ApiHelper.get("/personOrdinations?personId=" + person.id, "MembershipApi");
      const list: PersonOrdinationInterface[] = Array.isArray(ords) ? ords : [];
      const ord = list.find((o) => o.status === "active") || list[0];
      if (!ord) {
        setPreviewData(SAMPLE_BINDINGS);
        setError("That person has no ordination on record — showing sample data instead.");
        return;
      }
      const type = ord.ordinationTypeId ? ordinationTypeMap[ord.ordinationTypeId] : undefined;
      const campus = ord.campusId ? campusMap[ord.campusId] : undefined;
      setPreviewData(buildRealPreview(person, ord, type?.name, type?.code, campus));
    } catch (e: any) {
      setPreviewData(SAMPLE_BINDINGS);
      setError(e?.message || "Could not load that person's data — showing sample data.");
    }
  };

  const selectedEl = useMemo(() => layout.elements.find((e) => e.id === selectedId) ?? null, [layout.elements, selectedId]);
  const sortedElements = useMemo(() => [...layout.elements].sort((a, b) => a.z - b.z), [layout.elements]);

  return (
    <>
      <PageBreadcrumbs
        items={[
          { label: "Settings", path: "/settings" },
          { label: "License Templates", path: "/settings/license-templates" },
          { label: name || "Template" }
        ]}
      />
      <PageHeader title="License Template Editor" subtitle="Design a CR80 ministerial-license card: bound fields, logo, background, photo, and fonts." />

      <Collapse in={!!error}>
        <Alert severity="error" onClose={() => setError(null)} sx={{ m: 1.5 }}>{error}</Alert>
      </Collapse>

      {/* Lifecycle row: name + default/active + ordination-type binding (TPL-04). */}
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
        <TextField size="small" label="Template name" value={name} onChange={(e) => setName(e.target.value)} sx={{ minWidth: 220 }} />
        {canChooseFormat && (
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption">Size</Typography>
            <Select
              size="small"
              value={format}
              onChange={(e) => handleFormatChange(e.target.value as TemplateFormat)}
              sx={{ minWidth: 240 }}>
              <MenuItem value="card">ID Card (CR80)</MenuItem>
              <MenuItem value="letter-portrait">Certificate — Portrait (8.5×11)</MenuItem>
              <MenuItem value="letter-landscape">Certificate — Landscape (11×8.5)</MenuItem>
            </Select>
          </Stack>
        )}
        <FormControlLabel control={<Checkbox checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />} label="Default" />
        <FormControlLabel control={<Checkbox checked={active} onChange={(e) => setActive(e.target.checked)} />} label="Active" />
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="caption">Type binding</Typography>
          <Select
            size="small"
            value={ordinationTypeId ?? ""}
            onChange={(e) => setOrdinationTypeId(e.target.value === "" ? null : (e.target.value as string))}
            displayEmpty
            sx={{ minWidth: 220 }}>
            <MenuItem value="">All types (global default)</MenuItem>
            {ordinationTypes.map((t) => (
              <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
            ))}
          </Select>
        </Stack>
        <Box sx={{ flexGrow: 1 }} />
        {loading && <CircularProgress size={20} />}
        {currentVersion != null && <Typography variant="caption" color="text.secondary">v{currentVersion}</Typography>}
        <Button size="small" variant="contained" onClick={handleSave} disabled={saving || loading}>{saving ? "Saving…" : "Save"}</Button>
      </Stack>

      {/* Toolbar: add controls, zoom, preview mode. */}
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
        <Button size="small" variant="outlined" onClick={addStaticText}>Add static text</Button>
        <Button size="small" variant="outlined" onClick={addLogo}>Add logo</Button>
        <Button size="small" variant="outlined" onClick={editBackground}>Background</Button>
        <Button size="small" variant="outlined" onClick={addPhoto}>Add person picture</Button>
        <Button size="small" color="error" variant="outlined" disabled={!selectedId} onClick={() => selectedId && removeElement(selectedId)}>Delete selected</Button>

        <Box sx={{ flexGrow: 1 }} />

        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 220 }}>
          <Typography variant="caption">Zoom</Typography>
          <Slider size="small" min={1} max={8} step={0.5} value={zoom} onChange={(_e, v) => setZoom(v as number)} sx={{ width: 140 }} />
          <Typography variant="caption">{zoom.toFixed(1)}×</Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary">{layout.canvas.widthMm.toFixed(1)} × {layout.canvas.heightMm.toFixed(1)} mm</Typography>

        <ToggleButtonGroup size="small" exclusive value={previewMode} onChange={(_e, v) => handlePreviewMode(v)}>
          <ToggleButton value="sample">Sample data</ToggleButton>
          <ToggleButton value="person">Pick a real person</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/* Real-person picker — shown only in person-preview mode (resolves real Phase-2 data). */}
      {previewMode === "person" && (
        <Box sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider", maxWidth: 420 }}>
          <PersonAdd getPhotoUrl={PersonHelper.getPhotoUrl} addFunction={handlePickPerson} actionLabel="Preview" />
        </Box>
      )}

      {/* Three-pane body: binding list + layers | canvas | property panel. */}
      <Box sx={{ display: "flex", alignItems: "stretch", height: "calc(100vh - 260px)" }}>
        <Box sx={{ width: 250, flexShrink: 0, overflow: "auto", borderRight: "1px solid", borderColor: "divider" }}>
          <BindingList onAdd={addBinding} />
          <LayersPanel elements={layout.elements} selectedId={selectedId} onSelect={selectElement} onReorder={reorder} onBringToFront={bringToFront} />
        </Box>

        <Box sx={{ flexGrow: 1, overflow: "auto", backgroundColor: "grey.100" }}>
          <Canvas layout={layout} zoom={zoom} selectedId={selectedId} previewData={previewData} onSelect={selectElement}>
            {sortedElements.map((el) => (
              <CanvasElement key={el.id} el={el} zoom={zoom} selected={el.id === selectedId} previewData={previewData} onSelect={selectElement} onChange={updateElement} />
            ))}
          </Canvas>
        </Box>

        <Box sx={{ width: 320, flexShrink: 0, overflow: "auto", borderLeft: "1px solid", borderColor: "divider" }}>
          <PropertyPanel
            el={selectedEl}
            onChange={updateElement}
            onBackgroundChange={setBackground}
            background={layout.background}
            canvas={{ widthMm: layout.canvas.widthMm, heightMm: layout.canvas.heightMm }}
          />
        </Box>
      </Box>

      <Snackbar open={!!success} autoHideDuration={3000} onClose={() => setSuccess(null)} message={success ?? ""} anchorOrigin={{ vertical: "bottom", horizontal: "center" }} />
    </>
  );
};

export default TemplateEditor;
