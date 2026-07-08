import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Card, CardContent, Stack, Typography, TextField, Select, MenuItem, FormControl, InputLabel, InputAdornment, Chip, Divider, Grid, Link } from "@mui/material";
import { Search as SearchIcon, Public as PublicIcon } from "@mui/icons-material";
import { PageHeader } from "@churchapps/apphelper";
import { type PersonInterface } from "@churchapps/helpers";
import { useQuery } from "@tanstack/react-query";
import { CountChip } from "../components/ui";
import { useCampuses } from "../hooks/useCampuses";
import { type CampusInterface } from "../settings/components/CampusInterface";
import { CampusMap } from "./components/CampusMap";
import { CampusDemographicsSummary } from "./components/CampusDemographicsSummary";
import { groupPeopleByCampus } from "./helpers/campusDemographics";

type SortBy = "name" | "members";

// Church-wide Campuses landing page: an interactive map of all locations, plus
// campuses grouped by country with per-campus membership counts and a compact
// demographic summary. Searchable + sortable. Each campus links to its detail page.
export const CampusesPage: React.FC = () => {
  const navigate = useNavigate();
  const campuses = useCampuses();
  const peopleQuery = useQuery<PersonInterface[]>({ queryKey: ["/people/list", "MembershipApi"], placeholderData: [] });

  const peopleByCampus = useMemo(() => groupPeopleByCampus(peopleQuery.data || []), [peopleQuery.data]);
  const countFor = useMemo(() => (id?: string) => peopleByCampus.get(id || "")?.length || 0, [peopleByCampus]);
  const totalAssigned = useMemo(() => campuses.reduce((sum, c) => sum + countFor(c.id), 0), [campuses, countFor]);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("name");

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = campuses.filter((c) => !term || [c.name, c.city, c.state, c.country].some((v) => (v || "").toLowerCase().includes(term)));
    const sorted = [...filtered].sort((a, b) => (sortBy === "members" ? countFor(b.id) - countFor(a.id) : (a.name || "").localeCompare(b.name || "")));
    const byCountry = new Map<string, CampusInterface[]>();
    for (const c of sorted) {
      const key = (c.country || "").trim() || "Other";
      if (!byCountry.has(key)) byCountry.set(key, []);
      byCountry.get(key)!.push(c);
    }
    // Order country groups by campus count (most first, least last); "Other"
    // always sinks to the bottom, ties broken alphabetically.
    return [...byCountry.entries()].sort((a, b) => {
      if ((a[0] === "Other") !== (b[0] === "Other")) return a[0] === "Other" ? 1 : -1;
      if (b[1].length !== a[1].length) return b[1].length - a[1].length;
      return a[0].localeCompare(b[0]);
    });
  }, [campuses, search, sortBy, countFor]);

  return (
    <>
      <PageHeader title="Campuses" subtitle={`${campuses.length} ${campuses.length === 1 ? "campus" : "campuses"} · ${totalAssigned} members assigned`}>
        <Chip label={`${totalAssigned} members`} sx={{ color: "#FFF", borderColor: "rgba(255,255,255,0.5)", bgcolor: "rgba(255,255,255,0.1)" }} variant="outlined" />
      </PageHeader>

      <Box sx={{ p: 3 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }} alignItems={{ sm: "center" }}>
          <TextField
            size="small"
            placeholder="Search campuses by name, city, or country"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flex: 1 }}
            InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }}
            data-testid="campus-search"
          />
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Sort by</InputLabel>
            <Select label="Sort by" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
              <MenuItem value="name">Name (A–Z)</MenuItem>
              <MenuItem value="members">Membership (high–low)</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <CampusMap campuses={campuses} height={360} interactive />
          </CardContent>
        </Card>

        {groups.map(([country, list]) => (
          <Box key={country} sx={{ mb: 3 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <PublicIcon fontSize="small" color="action" />
              <Typography variant="h6">{country}</Typography>
              <Chip size="small" label={list.length} />
            </Stack>
            <Grid container spacing={2}>
              {list.map((c) => {
                const ppl = peopleByCampus.get(c.id || "") || [];
                return (
                  <Grid key={c.id} size={{ xs: 12, md: 6 }}>
                    <Card variant="outlined" sx={{ height: "100%", cursor: "pointer", "&:hover": { boxShadow: 3 } }} onClick={() => navigate(`/campuses/${c.id}`)}>
                      <CardContent>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                          <Box sx={{ minWidth: 0 }}>
                            <Link component="button" underline="hover" onClick={(e) => { e.stopPropagation(); navigate(`/campuses/${c.id}`); }} sx={{ textAlign: "left" }}>
                              <Typography variant="h6" noWrap>{c.name}</Typography>
                            </Link>
                            <Typography variant="body2" color="text.secondary" noWrap>{[c.address1, c.city, c.state].filter(Boolean).join(", ") || "No address on file"}</Typography>
                          </Box>
                          <CountChip count={ppl.length} />
                        </Stack>
                        <Divider sx={{ my: 1.5 }} />
                        <CampusDemographicsSummary people={ppl} dense />
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        ))}

        {groups.length === 0 && <Typography color="text.secondary">No campuses match "{search}".</Typography>}
      </Box>
    </>
  );
};
