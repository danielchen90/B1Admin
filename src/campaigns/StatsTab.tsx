// The campaign Stats tab (Plan 13-04, TRK-02 + TRK-05).
//
// Reads the 13-03 compute-on-read endpoint via campaignApi.getCampaignStats and
// renders a Mailchimp/SendGrid-style scan: a responsive grid of big-number stat
// cards (count + a % rate) followed by a ranked per-link click table.
//
// NO auto-polling (12-CONTEXT lock): the tab fetches once on mount and re-fetches
// ONLY when the operator clicks Refresh. Rate denominators (RESEARCH Pattern 8):
//   Delivered / Bounced  → over Sent
//   Opened / Clicked     → over Delivered
//   Complained / Unsubscribed → over Delivered
// Divide-by-zero is guarded (shows "—"). Unsubscribed is 0 this phase and renders
// gracefully. The Opened card carries the Apple-MPP approximate-open footnote
// (Pitfall 8): Apple Mail privacy features pre-fetch pixels and inflate opens.
//
// Each card that maps to a recipient filter is clickable → onDrill(status) so the
// parent (EmailEditorPage) opens the RecipientDrilldown pre-filtered to that
// status. The `total` card is informational and not clickable.

import React from "react";
import {
  Box, Grid, Card, CardActionArea, CardContent, Typography, Button, Tooltip, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Alert,
  CircularProgress, Link,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { getCampaignStats } from "./campaignApi";
import { type CampaignStats } from "./emailTypes";
import { parseApiError } from "./apiError";

export interface StatsTabProps {
  // The persisted campaign id whose stats to show. Only rendered for sent/sending
  // campaigns (EmailEditorPage gates the tab), so this is always present in practice.
  campaignId: string;
  // Invoked when the operator clicks a stat card — the status key the drill-down
  // filters to (e.g. "opened", "clicked", "bounced", "delivered", "sent").
  onDrill: (status: string) => void;
}

// A card definition: which count + which denominator it divides by for the rate.
type Denominator = "sent" | "delivered";
interface CardDef {
  key: keyof CampaignStats & string; // the count field
  label: string;
  denom: Denominator;
  // The status the drill-down filters to (omitted → card not clickable).
  drill?: string;
  note?: string; // an extra footnote (Apple-MPP on Opened)
}

const CARDS: CardDef[] = [
  { key: "sent", label: "Sent", denom: "sent", drill: "sent" },
  { key: "delivered", label: "Delivered", denom: "sent", drill: "delivered" },
  {
    key: "opened",
    label: "Opened",
    denom: "delivered",
    drill: "opened",
    note: "Open rates are approximate — Apple Mail privacy features can pre-load the tracking pixel and inflate them.",
  },
  { key: "clicked", label: "Clicked", denom: "delivered", drill: "clicked" },
  { key: "bounced", label: "Bounced", denom: "sent", drill: "bounced" },
  { key: "complained", label: "Complained", denom: "delivered", drill: "complained" },
  { key: "unsubscribed", label: "Unsubscribed", denom: "delivered", drill: "unsubscribed" },
];

// Format a rate as a whole-percent string, guarding divide-by-zero with "—".
const rate = (count: number, denom: number): string => {
  if (!denom || denom <= 0) return "—";
  return `${Math.round((count / denom) * 100)}%`;
};

export const StatsTab: React.FC<StatsTabProps> = ({ campaignId, onDrill }) => {
  const [stats, setStats] = React.useState<CampaignStats | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    setError("");
    try {
      const res = await getCampaignStats(campaignId);
      setStats(res);
    } catch (err: unknown) {
      const body = parseApiError(err);
      setError(body.error || "Couldn't load campaign stats.");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  // Fetch once on mount. NO interval / polling — manual Refresh only (CONTEXT lock).
  React.useEffect(() => {
    load();
  }, [load]);

  const denomValue = (stats: CampaignStats, d: Denominator): number =>
    d === "sent" ? stats.sent : stats.delivered;

  return (
    <Box data-testid="stats-tab">
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Engagement
          {stats && (
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              {stats.total} recipient{stats.total === 1 ? "" : "s"}
            </Typography>
          )}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
          onClick={load}
          disabled={loading}
          data-testid="stats-refresh"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} data-testid="stats-error">{error}</Alert>}

      {/* Big-number stat cards (count + rate). Clicking a card drills into the
          recipient list pre-filtered to that status. */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {CARDS.map((card) => {
          const count = stats ? (stats[card.key] as number) : 0;
          const pct = stats ? rate(count, denomValue(stats, card.denom)) : "—";
          const denomLabel = card.denom === "sent" ? "of sent" : "of delivered";
          const inner = (
            <CardContent data-testid={`stat-card-${card.key}`}>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Typography variant="overline" color="text.secondary">
                  {card.label}
                </Typography>
                {card.note && (
                  <Tooltip title={card.note} arrow>
                    <InfoOutlinedIcon
                      fontSize="inherit"
                      sx={{ color: "text.disabled", fontSize: 14 }}
                      data-testid="opened-mpp-footnote"
                    />
                  </Tooltip>
                )}
              </Stack>
              <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
                {stats ? count : "—"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {pct} <Box component="span" sx={{ fontSize: 12 }}>{denomLabel}</Box>
              </Typography>
              {card.key === "opened" && (
                <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 0.5 }}>
                  Approximate — see tooltip
                </Typography>
              )}
            </CardContent>
          );
          return (
            <Grid key={card.key} size={{ xs: 6, sm: 4, md: 3 }}>
              <Card variant="outlined" sx={{ height: "100%" }}>
                {card.drill ? (
                  <CardActionArea
                    onClick={() => onDrill(card.drill!)}
                    data-testid={`stat-card-drill-${card.drill}`}
                    sx={{ height: "100%" }}
                  >
                    {inner}
                  </CardActionArea>
                ) : (
                  inner
                )}
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Ranked per-link click table (TRK-05). */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Top links</Typography>
      <TableContainer component={Paper} variant="outlined" data-testid="link-click-table">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Link</TableCell>
              <TableCell align="right">Clicks</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {stats && stats.linkClicks.length > 0 ? (
              stats.linkClicks.map((row, i) => (
                <TableRow key={`${row.link}-${i}`} data-testid={`link-row-${i}`}>
                  <TableCell sx={{ maxWidth: 480, wordBreak: "break-all" }}>
                    <Link href={row.link} target="_blank" rel="noopener noreferrer">
                      {row.link}
                    </Link>
                  </TableCell>
                  <TableCell align="right">{row.count}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={2}>
                  <Typography variant="body2" color="text.secondary" data-testid="link-clicks-empty">
                    No link clicks yet.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default StatsTab;
