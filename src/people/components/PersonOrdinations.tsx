import React, { useMemo, useState } from "react";
import { UniqueIdHelper, Loading } from "@churchapps/apphelper";
import { useQuery } from "@tanstack/react-query";
import { Button, Stack, Typography, List, ListItem, ListItemText } from "@mui/material";
import { WorkspacePremium as OrdinationIcon, Add as AddIcon } from "@mui/icons-material";
import { EmptyState } from "../../components/ui/EmptyState";
import { CardWithHeader } from "../../components/ui/CardWithHeader";
import { CountChip } from "../../components/ui/CountChip";
import { StatusChip } from "../../components/ui/StatusChip";
import { useOrdinationTypes } from "../../hooks/useOrdinationTypes";
import { useCampuses } from "../../hooks/useCampuses";
import { canWriteOrdinations } from "../../helpers/OrdinationHelper";
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

  const types = useOrdinationTypes();
  const campuses = useCampuses();
  const canWrite = canWriteOrdinations();

  const [issueOpen, setIssueOpen] = useState(false);
  const [statusRow, setStatusRow] = useState<PersonOrdinationInterface | null>(null);

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
              <Button variant="text" size="small" onClick={() => setStatusRow(o)} data-testid="ordination-manage-button">Manage</Button>
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
    </>
  );
};
