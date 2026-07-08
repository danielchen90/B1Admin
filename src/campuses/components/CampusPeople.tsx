import React, { useMemo, useRef, useState } from "react";
import { Box, Card, Stack, Typography, TextField, InputAdornment, Table, TableBody, TableCell, TableHead, TableRow, Avatar, Button, CircularProgress, Link } from "@mui/material";
import { Search as SearchIcon, People as PeopleIcon, PictureAsPdf as PdfIcon } from "@mui/icons-material";
import { ApiHelper } from "@churchapps/apphelper";
import { type PersonInterface } from "@churchapps/helpers";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useReactToPrint } from "react-to-print";
import { CountChip, ExportButton } from "../../components/ui";
import { EnvironmentHelper } from "../../helpers";
import { type CampusInterface } from "../../settings/components/CampusInterface";
import { ageFromBirthDate } from "../helpers/campusDemographics";
import { toCampusPeopleCsv, CAMPUS_PEOPLE_HEADERS } from "../reports/campusPeopleCsv";
import { CampusDemographicsSummary } from "./CampusDemographicsSummary";
import { CampusRoster } from "./CampusRoster";

// People tab: everyone assigned to this campus, fetched via the existing
// advancedSearch campusId filter. Report-style list with per-campus CSV + PDF export.
export const CampusPeople: React.FC<{ campus?: CampusInterface }> = ({ campus }) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef, documentTitle: `${campus?.name || "campus"}-roster` });

  const peopleQuery = useQuery<PersonInterface[]>({
    queryKey: ["campusPeople", campus?.id],
    queryFn: () => ApiHelper.post("/people/advancedSearch", [{ field: "campusId", operator: "equals", value: campus?.id }], "MembershipApi"),
    enabled: !!campus?.id,
    placeholderData: []
  });
  const people = peopleQuery.data || [];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? people.filter((p) => (p.name?.display || "").toLowerCase().includes(term)) : people;
  }, [people, search]);

  const photoUrl = (p: PersonInterface) => (p.photo ? (p.photo.startsWith("http") ? p.photo : EnvironmentHelper.Common.ContentRoot + p.photo) : undefined);
  const fileBase = (campus?.name || "campus").replace(/\s+/g, "-").toLowerCase();

  return (
    <Box sx={{ p: 3 }}>
      <Card variant="outlined" sx={{ mb: 3, p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>Demographics</Typography>
        <CampusDemographicsSummary people={people} />
      </Card>

      <Card>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ sm: "center" }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <PeopleIcon color="primary" />
              <Typography variant="h6">People</Typography>
              <CountChip count={people.length} />
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField size="small" placeholder="Filter by name" value={search} onChange={(e) => setSearch(e.target.value)} InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }} />
              <ExportButton data={toCampusPeopleCsv(filtered)} customHeaders={CAMPUS_PEOPLE_HEADERS} filename={`${fileBase}-people.csv`} text="CSV" />
              <Button size="small" variant="outlined" startIcon={<PdfIcon />} onClick={() => handlePrint()} disabled={filtered.length === 0}>PDF</Button>
            </Stack>
          </Stack>
        </Box>

        {peopleQuery.isLoading ? (
          <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress /></Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center", color: "text.secondary" }}>No people {search ? "match your filter" : "assigned to this campus"}.</Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Gender</TableCell>
                <TableCell>Age</TableCell>
                <TableCell>Membership</TableCell>
                <TableCell>Contact</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Avatar src={photoUrl(p)} sx={{ width: 32, height: 32 }}>{(p.name?.first || "?").charAt(0)}</Avatar>
                      <Link component="button" underline="hover" onClick={() => navigate(`/people/${p.id}`)}>{p.name?.display}</Link>
                    </Stack>
                  </TableCell>
                  <TableCell>{p.gender || "—"}</TableCell>
                  <TableCell>{ageFromBirthDate(p.birthDate as any) ?? "—"}</TableCell>
                  <TableCell>{p.membershipStatus || "—"}</TableCell>
                  <TableCell>{p.contactInfo?.email || p.contactInfo?.mobilePhone || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Off-screen printable roster for the PDF export */}
      <Box sx={{ position: "absolute", left: -99999, top: 0 }} aria-hidden>
        <CampusRoster ref={contentRef} campus={campus} people={filtered} />
      </Box>
    </Box>
  );
};
