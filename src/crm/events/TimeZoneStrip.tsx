import React, { useMemo } from "react";
import { Box, Chip, Stack, Tooltip, Typography } from "@mui/material";
import { MAJOR_ZONES, localHour, offsetLabel, wallTime } from "../zones";

// "What time is that for everyone?" Shows the event's start in the time zones of the people the
// ministry actually serves (registrants first, then the CRM's most common zones, then a fixed list
// of the main mission fields), and flags hours that are hard to attend (night or very early).

interface Props {
  startsAt: Date | null;
  hostZone: string;
  registrantZones?: { timezone: string; people: number }[];
  crmZones?: { timezone: string; people: number }[];
}

const city = (tz: string) => tz.split("/").pop()!.replace(/_/g, " ");

export function hourRating(h: number): "good" | "early" | "late" | "night" {
  if (h >= 8 && h <= 20) return "good";
  if (h >= 6 && h < 8) return "early";
  if (h > 20 && h <= 22) return "late";
  return "night";
}

const COLORS: Record<string, string> = { good: "#16794C", early: "#B26A00", late: "#B26A00", night: "#C62828" };
const LABEL: Record<string, string> = { good: "good time", early: "early morning", late: "late evening", night: "night: hard to attend" };

export const TimeZoneStrip: React.FC<Props> = ({ startsAt, hostZone, registrantZones = [], crmZones = [] }) => {
  const zones = useMemo(() => {
    const seen = new Set<string>([hostZone]);
    const out: { tz: string; label: string; people?: number; who?: string }[] = [];
    for (const z of registrantZones) if (!seen.has(z.timezone)) { seen.add(z.timezone); out.push({ tz: z.timezone, label: city(z.timezone), people: z.people, who: "registered" }); }
    for (const z of crmZones.slice(0, 12)) if (!seen.has(z.timezone)) { seen.add(z.timezone); out.push({ tz: z.timezone, label: city(z.timezone), people: z.people, who: "in the CRM" }); }
    for (const z of MAJOR_ZONES) if (!seen.has(z.tz) && out.length < 16) { seen.add(z.tz); out.push({ tz: z.tz, label: z.label }); }
    return out;
  }, [hostZone, registrantZones, crmZones]);

  if (!startsAt || isNaN(startsAt.getTime())) return <Typography variant="body2" sx={{ color: "var(--text-muted)" }}>Pick a date and time to see it around the world.</Typography>;
  const night = zones.filter((z) => hourRating(localHour(z.tz, startsAt)) === "night");

  return (
    <Box>
      <Typography variant="body2" sx={{ mb: 1 }}>
        <b>{wallTime(hostZone, startsAt, { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</b> in {city(hostZone)} ({offsetLabel(hostZone, startsAt)}) is:
      </Typography>
      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
        {zones.map((z) => {
          const rating = hourRating(localHour(z.tz, startsAt));
          return (
            <Tooltip key={z.tz} title={`${z.tz} (${offsetLabel(z.tz, startsAt)}): ${LABEL[rating]}${z.people ? `, ${z.people} ${z.who}` : ""}`}>
              <Chip
                size="small" variant="outlined"
                label={<span><b>{z.label}</b> {wallTime(z.tz, startsAt)}{z.people ? ` · ${z.people}` : ""}</span>}
                sx={{ borderColor: COLORS[rating], color: COLORS[rating], bgcolor: rating === "night" ? "rgba(198,40,40,0.06)" : "transparent" }}
              />
            </Tooltip>
          );
        })}
      </Stack>
      {night.length > 0 && (
        <Typography variant="caption" sx={{ display: "block", mt: 1, color: COLORS.night }}>
          Night time for {night.map((z) => z.label).join(", ")}. Consider a second session or a replay for them.
        </Typography>
      )}
    </Box>
  );
};
