import React, { useMemo } from "react";
import { Box, Chip, Stack, Typography, LinearProgress } from "@mui/material";
import { Male as MaleIcon, Female as FemaleIcon } from "@mui/icons-material";
import { type PersonInterface } from "@churchapps/helpers";
import { computeCampusDemographics } from "../helpers/campusDemographics";

interface Props {
  people: PersonInterface[];
  dense?: boolean; // list-card variant: tighter, fewer rows
}

const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

// Compact, self-contained demographic summary: gender split, age buckets, and
// the top membership statuses. Shared by the list cards (dense) and the campus
// detail People tab (full).
export const CampusDemographicsSummary: React.FC<Props> = ({ people, dense = false }) => {
  const demo = useMemo(() => computeCampusDemographics(people), [people]);

  if (demo.total === 0) return <Typography variant="body2" color="text.secondary">No members assigned to this campus yet.</Typography>;

  const statuses = dense ? demo.membershipStatus.slice(0, 3) : demo.membershipStatus;

  return (
    <Stack spacing={dense ? 1 : 1.5}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
        <Chip size="small" icon={<MaleIcon />} label={`${demo.gender.male} (${pct(demo.gender.male, demo.total)}%)`} sx={{ bgcolor: "#e3f2fd" }} />
        <Chip size="small" icon={<FemaleIcon />} label={`${demo.gender.female} (${pct(demo.gender.female, demo.total)}%)`} sx={{ bgcolor: "#fce4ec" }} />
        {demo.gender.unspecified > 0 && <Chip size="small" label={`Unspecified ${demo.gender.unspecified}`} variant="outlined" />}
      </Stack>

      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Age</Typography>
        <Stack direction="row" spacing={1.5} sx={{ mt: 0.5 }}>
          {demo.ageGroups.map((g) => (
            <Box key={g.label} sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" noWrap>{g.label}</Typography>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>{g.count}</Typography>
              </Stack>
              <LinearProgress variant="determinate" value={pct(g.count, demo.total)} sx={{ height: 6, borderRadius: 3 }} />
            </Box>
          ))}
        </Stack>
      </Box>

      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Membership status</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
          {statuses.map((s) => <Chip key={s.label} size="small" variant="outlined" label={`${s.label}: ${s.count}`} />)}
        </Stack>
      </Box>
    </Stack>
  );
};
