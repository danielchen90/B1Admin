import React from "react";
import { Box, Button, Divider, Typography } from "@mui/material";

// Mary Banks ID sign-in for church staff. The public church site runs the whole sign-in
// (Keycloak code exchange + the Api's mbidLogin) and then sends the browser back to this
// app's /login?jwt=..., where the stock ChurchApps login finishes the session.
const DEFAULT_SITE = "https://church.chensolutions.com";

export const mbidStartUrl = (): string => {
  const site = (process.env.REACT_APP_MBID_SITE_URL || DEFAULT_SITE).replace(/\/+$/, "");
  return site + "/api/auth/mbid/start?target=admin";
};

export const MaryBanksIdButton: React.FC = () => (
  <Box sx={{ width: "100%", maxWidth: 420, mx: "auto", px: 3, pt: { xs: 4, md: 8 } }} data-testid="mbid-signin">
    <Button
      component="a"
      href={mbidStartUrl()}
      variant="contained"
      size="large"
      fullWidth
      sx={{
        py: 1.6,
        fontSize: "1.05rem",
        fontWeight: 700,
        textTransform: "none",
        borderRadius: 2,
        bgcolor: "primary.main",
        color: "primary.contrastText",
        boxShadow: 3,
        "&:hover": { bgcolor: "primary.dark" }
      }}
    >
      Sign in with Mary Banks ID
    </Button>
    <Typography variant="body2" sx={{ color: "text.secondary", textAlign: "center", mt: 1.2 }}>
      One account for the church site, the Global Training Center and the Bible Teacher app.
    </Typography>
    <Divider sx={{ mt: 3, color: "text.secondary", fontSize: ".85rem" }}>or sign in with email and password</Divider>
  </Box>
);
