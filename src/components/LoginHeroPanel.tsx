import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import PeopleIcon from "@mui/icons-material/People";
import EventIcon from "@mui/icons-material/Event";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import LinkIcon from "@mui/icons-material/Link";
import { Locale } from "@churchapps/apphelper";
import { HuroLogo } from "./ui/HuroLogo";

const GOLD = "#D4A23A";

const features: { id: string; icon: React.ReactNode; getLabel: () => string }[] = [
  { id: "people", icon: <PeopleIcon />, getLabel: () => Locale.label("components.loginHeroPanel.featurePeople") },
  { id: "planning", icon: <EventIcon />, getLabel: () => Locale.label("components.loginHeroPanel.featurePlanning") },
  { id: "donations", icon: <AttachMoneyIcon />, getLabel: () => Locale.label("components.loginHeroPanel.featureDonations") },
  { id: "website", icon: <LinkIcon />, getLabel: () => Locale.label("components.loginHeroPanel.featureWebsite") }
];

export const LoginHeroPanel: React.FC = () => (
  <Box
    sx={{
      flex: 1,
      display: { xs: "none", md: "flex" },
      flexDirection: "column",
      justifyContent: "space-between",
      p: 7,
      position: "relative",
      overflow: "hidden",
      background: "linear-gradient(160deg, #071228 0%, #0B1D3A 55%, #13315A 100%)",
      color: "#fff",
      // Signature: an architectural support system — faint navy pillars carrying a
      // single gold beam. The structure behind the ministry, made literal in the field.
      "&::before": {
        content: "''",
        position: "absolute",
        inset: 0,
        backgroundImage:
          "repeating-linear-gradient(90deg, rgba(255,255,255,0.045) 0 1px, transparent 1px 96px)",
        maskImage: "linear-gradient(to bottom, transparent, #000 22%, #000 82%, transparent)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 22%, #000 82%, transparent)"
      },
      "&::after": {
        content: "''",
        position: "absolute",
        left: 0,
        right: 0,
        top: "52%",
        height: 3,
        background: `linear-gradient(90deg, transparent, ${GOLD} 30%, ${GOLD} 70%, transparent)`,
        opacity: 0.5
      }
    }}>
    {/* Brand lockup, top-left */}
    <Box sx={{ position: "relative", zIndex: 1 }}>
      <HuroLogo variant="dark" markSize={46} wordSize={30} descriptor />
    </Box>

    {/* Message block, vertically centered */}
    <Box sx={{ position: "relative", zIndex: 1, maxWidth: 460 }}>
      <Box sx={{ width: 48, height: 3, background: GOLD, mb: 3, borderRadius: 1 }} />
      <Typography component="h1" sx={{ fontFamily: '"Sora","Inter",sans-serif', fontWeight: 700, fontSize: "2.3rem", lineHeight: 1.15, mb: 2 }}>
        {Locale.label("components.loginHeroPanel.title")}
      </Typography>
      <Typography sx={{ fontSize: "1.02rem", color: "rgba(255,255,255,0.78)", lineHeight: 1.65, mb: 4 }}>
        {Locale.label("components.loginHeroPanel.subtitle")}
      </Typography>
      <Stack spacing={1.75} sx={{ textAlign: "left" }}>
        {features.map((f) => (
          <Stack key={f.id} direction="row" spacing={1.75} alignItems="center" sx={{ color: "rgba(255,255,255,0.92)", fontSize: "0.92rem" }}>
            <Box
              sx={{
                width: 34,
                height: 34,
                minWidth: 34,
                background: "rgba(212,162,58,0.14)",
                border: "1px solid rgba(212,162,58,0.4)",
                borderRadius: 1.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: GOLD,
                "& svg": { fontSize: 18 }
              }}>
              {f.icon}
            </Box>
            <Box component="span">{f.getLabel()}</Box>
          </Stack>
        ))}
      </Stack>
    </Box>

    {/* Brand line, bottom */}
    <Box sx={{ position: "relative", zIndex: 1 }}>
      <Typography sx={{ fontFamily: '"Sora","Inter",sans-serif', fontWeight: 400, fontSize: "0.98rem", color: "rgba(255,255,255,0.72)" }}>
        Upholding ministry. <Box component="span" sx={{ color: GOLD }}>Strengthening leadership.</Box>
      </Typography>
    </Box>
  </Box>
);
