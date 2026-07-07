import React from "react";
import { Box } from "@mui/material";

/**
 * HURO brand marks. The icon is the architectural "H" monogram: two navy pillars
 * upholding a gold beam — "the structure behind the ministry." Rendered inline as
 * vector SVG so it stays crisp at any size and recolors per surface.
 */

const GOLD = "#D4A23A";

interface MarkProps {
  /** Pillar color. Use white on navy surfaces, navy on light surfaces. */
  pillar?: string;
  size?: number | string;
  title?: string;
}

export const HuroMark: React.FC<MarkProps> = ({ pillar = "#0B1D3A", size = 40, title = "Huro" }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={title} focusable="false">
    <rect x="22" y="14" width="15" height="72" rx="3" fill={pillar} />
    <rect x="63" y="14" width="15" height="72" rx="3" fill={pillar} />
    <rect x="22" y="43" width="56" height="13" rx="2.5" fill={GOLD} />
  </svg>
);

interface LockupProps {
  /** "light" = navy marks for light backgrounds; "dark" = white marks for navy backgrounds. */
  variant?: "light" | "dark";
  markSize?: number;
  /** Show the CHURCH ADMIN PLATFORM descriptor under the wordmark. */
  descriptor?: boolean;
  wordSize?: number;
}

export const HuroLogo: React.FC<LockupProps> = ({ variant = "light", markSize = 44, descriptor = false, wordSize = 30 }) => {
  const pillar = variant === "dark" ? "#FFFFFF" : "#0B1D3A";
  const wordColor = variant === "dark" ? "#FFFFFF" : "#0B1D3A";
  const descColor = variant === "dark" ? "#9DB0CC" : "#6B7280";
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: `${markSize * 0.34}px` }}>
      <HuroMark pillar={pillar} size={markSize} />
      <Box>
        <Box
          component="span"
          sx={{
            display: "block",
            fontFamily: '"Sora", "Inter", sans-serif',
            fontWeight: 800,
            fontSize: `${wordSize}px`,
            letterSpacing: "0.14em",
            lineHeight: 1,
            color: wordColor
          }}>
          HURO
        </Box>
        {descriptor && (
          <Box
            component="span"
            sx={{
              display: "block",
              fontFamily: '"Inter", sans-serif',
              fontWeight: 500,
              fontSize: `${Math.max(9, wordSize * 0.31)}px`,
              letterSpacing: "0.34em",
              marginTop: `${wordSize * 0.22}px`,
              color: descColor,
              whiteSpace: "nowrap"
            }}>
            CHURCH&nbsp;ADMIN&nbsp;PLATFORM
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default HuroLogo;
