import React, { useMemo, useState } from "react";
import { UniqueIdHelper, Loading, type PersonInterface } from "@churchapps/apphelper";
import { useQuery } from "@tanstack/react-query";
import { Button, Stack, Typography, List, ListItem, ListItemText, ListItemButton, Dialog, DialogTitle } from "@mui/material";
import { WorkspacePremium as OrdinationIcon, Add as AddIcon, Print as PrintIcon } from "@mui/icons-material";
import { EmptyState } from "../../components/ui/EmptyState";
import { CardWithHeader } from "../../components/ui/CardWithHeader";
import { CountChip } from "../../components/ui/CountChip";
import { StatusChip } from "../../components/ui/StatusChip";
import { useOrdinationTypes } from "../../hooks/useOrdinationTypes";
import { useCampuses } from "../../hooks/useCampuses";
import { canWriteOrdinations } from "../../helpers/OrdinationHelper";
import { PrintLicenseDialog } from "../../licenseTemplates/render/PrintLicenseDialog";
import { type PersonOrdinationInterface } from "./PersonOrdinationInterface";
import { OrdinationIssueDialog } from "./OrdinationIssueDialog";
import { OrdinationStatusDialog } from "./OrdinationStatusDialog";

interface Props {
  personId: string;
  updatedFunction?: () => void;
}

const EM_DASH = "—";

// Render a date-ish value as a plain date string, em-dash when null/empty.
const fmtDate = (v?: string | null): string => {
  if (!v) return EM_DASH;
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString();
};

// Person credential tab. Models the Groups tab look (Card/List/CountChip/EmptyState)
// and assembles the two 03-03 lifecycle dialogs. Pitfall 2: the list endpoint
// returns raw rows (no joins), so ordinationTypeId/campusId are resolved to NAMES
// via the shared useOrdinationTypes + useCampuses caches — never the GUIDs.
export const PersonOrdinations: React.FC<Props> = (props) => {
  const ordinations = useQuery<PersonOrdinationInterface[]>({
    // SAME key PersonPage uses for the count -> one shared cache.
    queryKey: ["/personOrdinations?personId=" + props.personId, "MembershipApi"],
    enabled: !UniqueIdHelper.isMissing(props.personId),
    placeholderData: []
  });

  // Load the person (photo info) so the print dialog can warn on a missing license photo.
  // Shares PersonPage's cache key so this is usually a cache hit, not a second fetch.
  const person = useQuery<PersonInterface>({
    queryKey: ["/people/" + props.personId, "MembershipApi"],
    enabled: !UniqueIdHelper.isMissing(props.personId)
  });

  const types = useOrdinationTypes();
  const campuses = useCampuses();
  const canWrite = canWriteOrdinations();

  const [issueOpen, setIssueOpen] = useState(false);
  const [statusRow, setStatusRow] = useState<PersonOrdinationInterface | null>(null);
  // Print License: the credential currently in the print dialog, and the which-credential
  // picker for a person-level print when they hold more than one credential.
  const [printRow, setPrintRow] = useState<PersonOrdinationInterface | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const typeNames = useMemo(() => {
    const map: Record<string, string> = {};
    types.forEach((t) => { if (t.id) map[t.id] = t.name; });
    return map;
  }, [types]);

  const campusNames = useMemo(() => {
    const map: Record<string, string> = {};
    campuses.forEach((c) => { if (c.id) map[c.id] = c.name || ""; });
    return map;
  }, [campuses]);

  // Object maps (not just names) so the dialog gets the full type/campus records it binds.
  const typeMap = useMemo(() => Object.fromEntries(types.map((t) => [t.id, t])), [types]);
  const campusMap = useMemo(() => Object.fromEntries(campuses.map((c) => [c.id, c])), [campuses]);

  // Person-level Print License: go straight to the single credential, else prompt which.
  const openPrint = () => {
    if (rows.length === 1) setPrintRow(rows[0]);
    else if (rows.length > 1) setPickerOpen(true);
  };

  const rows = ordinations.data || [];
  const count = rows.length;

  // Success from either dialog: refresh the shared list and let PersonPage
  // recompute the count/tab visibility.
  const handleChanged = () => {
    ordinations.refetch();
    props.updatedFunction?.();
  };

  // Pitfall 5: version_conflict means the row moved on. Refetch, then reopen the
  // status dialog with the fresh row so the retry carries the bumped version.
  const handleVersionConflict = async () => {
    const result = await ordinations.refetch();
    const fresh = (result.data || []).find((o) => o.id === statusRow?.id);
    if (fresh) setStatusRow(fresh);
  };

  const recordsContent = () => {
    if (ordinations.isLoading) return <Loading size="sm" />;
    if (count === 0) {
      return <EmptyState icon={<OrdinationIcon />} title="No credentials on file" />;
    }
    return (
      <List disablePadding>
        {rows.map((o, index) => (
          <ListItem
            key={o.id}
            divider={index < count - 1}
            secondaryAction={canWrite ? (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Button variant="text" size="small" startIcon={<PrintIcon />} onClick={() => setPrintRow(o)} data-testid="ordination-print-button">Print License</Button>
                <Button variant="text" size="small" onClick={() => setStatusRow(o)} data-testid="ordination-manage-button">Manage</Button>
              </Stack>
            ) : undefined}
            sx={{ px: 1, py: 1 }}>
            <ListItemText
              primary={
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography sx={{ fontWeight: 600, color: "primary.main", fontSize: "0.95rem" }}>
                    {(o.ordinationTypeId && typeNames[o.ordinationTypeId]) || "Unknown type"}
                  </Typography>
                  <StatusChip status={o.status || ""} />
                </Stack>
              }
              secondary={
                <Typography variant="body2" color="text.secondary" component="span">
                  {(o.campusId && campusNames[o.campusId]) || EM_DASH}
                  {"  •  #"}{o.credentialNumber || EM_DASH}
                  {"  •  Granted "}{fmtDate(o.grantedDate)}
                  {"  •  Expires "}{fmtDate(o.expirationDate)}
                </Typography>
              }
              slotProps={{ primary: { component: "div" }, secondary: { component: "div" } }}
            />
          </ListItem>
        ))}
      </List>
    );
  };

  return (
    <>
      <CardWithHeader
        title="Ordinations"
        icon={<OrdinationIcon sx={{ color: "primary.main", fontSize: 20 }} />}
        actions={
          <Stack direction="row" spacing={1} alignItems="center">
            {count > 0 && <CountChip count={count} />}
            {canWrite && count > 0 && (
              <Button variant="outlined" size="small" startIcon={<PrintIcon />} onClick={openPrint} data-testid="ordination-print-person-button">Print License</Button>
            )}
            {canWrite && (
              <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => setIssueOpen(true)} data-testid="ordination-add-button">Add ordination</Button>
            )}
          </Stack>
        }>
        {recordsContent()}
      </CardWithHeader>

      {canWrite && (
        <OrdinationIssueDialog
          open={issueOpen}
          personId={props.personId}
          onClose={() => setIssueOpen(false)}
          onIssued={handleChanged}
        />
      )}

      {canWrite && statusRow && (
        <OrdinationStatusDialog
          open={!!statusRow}
          ordination={statusRow}
          onClose={() => setStatusRow(null)}
          onChanged={handleChanged}
          onVersionConflict={handleVersionConflict}
        />
      )}

      {/* Person-level Print License with >1 credential: pick which one to print. */}
      {canWrite && pickerOpen && (
        <Dialog open onClose={() => setPickerOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Which credential?</DialogTitle>
          <List disablePadding>
            {rows.map((o) => (
              <ListItemButton key={o.id} onClick={() => { setPickerOpen(false); setPrintRow(o); }}>
                <ListItemText
                  primary={(o.ordinationTypeId && typeNames[o.ordinationTypeId]) || "Unknown type"}
                  secondary={`${(o.campusId && campusNames[o.campusId]) || EM_DASH}  •  #${o.credentialNumber || EM_DASH}`}
                />
              </ListItemButton>
            ))}
          </List>
        </Dialog>
      )}

      {canWrite && printRow && (
        <PrintLicenseDialog
          open={!!printRow}
          person={person.data || undefined}
          ordination={printRow}
          ordinationType={printRow.ordinationTypeId ? typeMap[printRow.ordinationTypeId] : undefined}
          campus={printRow.campusId ? campusMap[printRow.campusId] : undefined}
          onClose={() => setPrintRow(null)}
        />
      )}
    </>
  );
};
