import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { type PersonInterface } from "@churchapps/helpers";
import { Locale, PageHeader } from "@churchapps/apphelper";
import { Grid, Box, Typography, Card, Stack, Button, Snackbar, Alert, Chip } from "@mui/material";
import { Print as PrintIcon, Warning as WarningIcon } from "@mui/icons-material";
import { PeopleSearchResults } from "../../people/components";
import { PeopleSearch } from "../../people/components/PeopleSearch";
import { type ListConditions } from "../../people/components/SavedLists";
import { HuroPersonHelper } from "../../helpers";
import { canWriteOrdinations } from "../../helpers/OrdinationHelper";
import { CountChip } from "../../components/ui";
import { useQuery } from "@tanstack/react-query";
import * as printBatchApi from "./printBatchApi";

// Past this many selected people the batch still proceeds, but we warn the operator that
// rendering may take a while (RESEARCH ~150 soft cap — bounded memory is enforced
// server-side regardless, so this is advisory only, never a hard block).
const SOFT_CAP = 150;
const INITIAL_PAGE_SIZE = 50;

// The "build a batch" half of the print station (PRT-02): reuse the SCOPED people roster
// (PeopleSearch filters + PeopleSearchResults checkbox selection incl. select-all-matching)
// and send the RESOLVED selectedPersonIds — plus the filter as filterJson for provenance,
// NOT as the batch — to a new print batch, navigating the operator to it.
//
// The roster is already campus-scoped per the operator's role (it inherits the Phase-1
// server scoping on /people); the selectable set is exactly whatever that scoped roster
// returns. 07-06 mounts this as the batch-launch entry of the print-station page.
export const BatchSelectionPanel = React.memo(() => {
  const navigate = useNavigate();
  const [searchResults, setSearchResults] = React.useState<PersonInterface[] | null>(null);
  const [isSearchPerformed, setIsSearchPerformed] = React.useState(false);
  const [selectedPersonIds, setSelectedPersonIds] = React.useState<string[]>([]);
  // The criteria behind the current results (advanced filter spec or simple conditions),
  // stored verbatim as the batch's filterJson provenance. LOCKED "store BOTH" — provenance
  // here, resolved personIds on the batch.
  const [currentCriteria, setCurrentCriteria] = React.useState<ListConditions | null>(null);
  const [isSending, setIsSending] = React.useState(false);
  const [toast, setToast] = React.useState<{ open: boolean; message: string; severity: "success" | "error" | "warning" }>({ open: false, message: "", severity: "success" });

  const canWrite = canWriteOrdinations();
  const overCap = selectedPersonIds.length > SOFT_CAP;

  const columns = [
    { key: "photo", label: Locale.label("people.peoplePage.photo"), shortName: "" },
    { key: "displayName", label: Locale.label("person.displayName"), shortName: Locale.label("common.name") },
    { key: "campus", label: Locale.label("person.campus"), shortName: Locale.label("person.campus") }
  ];
  const selectedColumns = ["photo", "displayName", "campus"];

  // Seed the roster with the scoped people list (same source PeoplePage uses); a search
  // narrows it. The scope is applied server-side, so this is the operator's selectable set.
  const peopleQuery = useQuery<PersonInterface[]>({
    queryKey: [`/people/list?pageSize=${INITIAL_PAGE_SIZE}`, "MembershipApi"],
    placeholderData: []
  });

  React.useEffect(() => {
    if (isSearchPerformed) return;
    if (peopleQuery.isPlaceholderData) return;
    const data = peopleQuery.data;
    if (!data) return;
    setSearchResults(data.map((d: PersonInterface) => HuroPersonHelper.getExpandedPersonObject(d)));
  }, [peopleQuery.data, peopleQuery.isPlaceholderData, isSearchPerformed]);

  // Prune any selected id no longer visible in the current results (mirrors PeoplePage).
  React.useEffect(() => {
    if (!searchResults) return;
    const visibleIds = new Set(searchResults.map((p) => p.id).filter((id): id is string => !!id));
    setSelectedPersonIds((current) => current.filter((id) => visibleIds.has(id)));
  }, [searchResults]);

  const togglePersonSelection = useCallback((personId: string) => {
    setSelectedPersonIds((current) => (current.includes(personId) ? current.filter((id) => id !== personId) : [...current, personId]));
  }, []);

  // LOCKED "select all matching" — select/deselect every currently-visible person.
  const toggleAllVisiblePeople = useCallback(() => {
    if (!searchResults) return;
    const visibleIds = searchResults.map((p) => p.id).filter((id): id is string => !!id);
    if (visibleIds.length === 0) return;
    setSelectedPersonIds((current) => {
      const allVisibleSelected = visibleIds.every((id) => current.includes(id));
      if (allVisibleSelected) return current.filter((id) => !visibleIds.includes(id));
      return Array.from(new Set([...current, ...visibleIds]));
    });
  }, [searchResults]);

  const resetSearchResults = useCallback(() => {
    setIsSearchPerformed(false);
    setCurrentCriteria(null);
    const data = peopleQuery.data;
    if (data) setSearchResults(data.map((d: PersonInterface) => HuroPersonHelper.getExpandedPersonObject(d)));
  }, [peopleQuery.data]);

  const handleSendToPrintStation = useCallback(async () => {
    if (selectedPersonIds.length === 0 || isSending) return;
    setIsSending(true);
    try {
      const result = await printBatchApi.createBatch({
        personIds: selectedPersonIds,
        // Store the criteria verbatim as provenance; the batch itself is the resolved ids.
        filterJson: currentCriteria ? JSON.stringify(currentCriteria) : undefined
      });
      const skipped = result.skipped || [];
      if (skipped.length > 0) {
        // Report un-renderable people up front, but still proceed to the batch that WAS built.
        setToast({ open: true, message: `${skipped.length} ${skipped.length === 1 ? "person" : "people"} skipped (no active credential, template, or cropped photo). Building ${result.cardCount} card${result.cardCount === 1 ? "" : "s"}.`, severity: "warning" });
      }
      navigate("/ordinations/print-station/" + result.batchId);
    } catch (e) {
      setToast({ open: true, message: e instanceof Error ? e.message : "Unable to create the print batch", severity: "error" });
      setIsSending(false);
    }
  }, [selectedPersonIds, currentCriteria, isSending, navigate]);

  return (
    <>
      <PageHeader title={Locale.label("ordinations.printStation.title") || "Print Station"} subtitle="Filter the roster, select the ministers to print, and send them to a new batch." />

      <Box sx={{ p: 3 }}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 3 }}>
            <PeopleSearch
              updateSearchResults={(people) => {
                setSearchResults(people);
                setIsSearchPerformed(true);
              }}
              resetSearchResults={resetSearchResults}
              updatedFunction={() => peopleQuery.refetch()}
              onReportCriteria={(criteria) => setCurrentCriteria(criteria as ListConditions | null)}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 9 }}>
            <Card>
              <Box sx={{ p: 2, borderBottom: 1, borderColor: "var(--border-light)" }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PrintIcon sx={{ color: "primary.main", fontSize: 20 }} />
                    <Typography variant="h6">{isSearchPerformed ? "Search Results" : "All Ministers"}</Typography>
                    {searchResults && searchResults.length > 0 && <CountChip count={searchResults.length} />}
                    {selectedPersonIds.length > 0 && <Chip size="small" color="primary" label={`${selectedPersonIds.length} selected`} />}
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {selectedPersonIds.length > 0 && <Button size="small" onClick={() => setSelectedPersonIds([])}>Clear selection</Button>}
                    {canWrite && (
                      <Button variant="contained" startIcon={<PrintIcon />} disabled={selectedPersonIds.length === 0 || isSending} onClick={handleSendToPrintStation}>
                        {isSending ? "Sending…" : "Send to Print Station"}
                      </Button>
                    )}
                  </Stack>
                </Stack>
                {overCap && (
                  <Alert severity="warning" icon={<WarningIcon />} sx={{ mt: 2 }}>
                    Large batch ({selectedPersonIds.length} selected) — rendering may take a while. You can still proceed.
                  </Alert>
                )}
              </Box>
              <Box>
                <PeopleSearchResults
                  people={searchResults}
                  columns={columns}
                  selectedColumns={selectedColumns}
                  updateSearchResults={(people) => setSearchResults(people)}
                  updatedFunction={() => peopleQuery.refetch()}
                  canSelectPeople={canWrite}
                  selectedPersonIds={selectedPersonIds}
                  togglePersonSelection={togglePersonSelection}
                  toggleAllVisiblePeople={toggleAllVisiblePeople}
                />
              </Box>
            </Card>
          </Grid>
        </Grid>
      </Box>

      <Snackbar open={toast.open} autoHideDuration={6000} onClose={() => setToast((c) => ({ ...c, open: false }))} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={toast.severity} onClose={() => setToast((c) => ({ ...c, open: false }))} sx={{ width: "100%" }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </>
  );
});
