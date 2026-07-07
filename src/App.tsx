import React, { useMemo } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ControlPanel } from "./ControlPanel";
import { UserProvider } from "./UserContext";
import { ThemeContextProvider, useThemeMode } from "./ThemeContext";
import { CookiesProvider } from "react-cookie";
import { createTheme, CssBaseline, ThemeProvider, type PaletteMode } from "@mui/material";
import "@churchapps/apphelper/dist/markdown/components/markdownEditor/editor.css";
//TODO export the css from apphelper
import { EnvironmentHelper } from "./helpers";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./queryClient";

declare module "@mui/material/styles" {
  interface Palette {
    InputBox: {
      headerText: string;
    };
  }
  interface PaletteOptions {
    InputBox?: {
      headerText?: string;
    };
  }
  interface TypeBackground {
    subtle: string;
  }
}

const createMdTheme = (mode: PaletteMode) =>
  createTheme({
    palette: {
      mode,
      // HURO Deep Navy — the structural foundation (app bar, headings, primary buttons).
      primary: {
        main: "#0B1D3A",
        light: "#1E4675",
        dark: "#071228",
        contrastText: "#FFFFFF"
      },
      // Warm Gold — the honored accent, used sparingly for calls-to-action and emphasis.
      secondary: {
        main: "#D4A23A",
        light: "#E4BD6A",
        dark: "#B4842A",
        contrastText: "#0B1D3A"
      },
      text: {
        primary: mode === "light" ? "#1F2A3D" : "#E6EBF2",
        secondary: mode === "light" ? "#6B7280" : "#9DB0CC"
      },
      InputBox: { headerText: mode === "light" ? "#0B1D3A" : "#E6EBF2" },
      background: {
        default: mode === "light" ? "#F5F6F7" : "#0A1526",
        paper: mode === "light" ? "#ffffff" : "#10203B",
        subtle: mode === "light" ? "#FAFBFC" : "#14294A"
      },
      divider: mode === "light" ? "#E2E5EA" : "#1E3355"
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          "body.dark-theme #banner": {
            backgroundColor: "#1e1e1e",
            borderBottom: "1px solid #333"
          }
        }
      },
      MuiTextField: {
        defaultProps: { margin: "normal" },
        styleOverrides: { root: { "& .MuiOutlinedInput-root": { "&:hover fieldset": { borderColor: mode === "light" ? "rgba(0, 0, 0, 0.23)" : "rgba(255, 255, 255, 0.23)" } } } }
      },
      MuiFormControl: { defaultProps: { margin: "normal" } },
      // always-shrunk labels: react-hook-form reset() fills inputs without events, so MUI's filled-state detection misses them
      MuiInputLabel: { defaultProps: { shrink: true } },
      MuiOutlinedInput: { defaultProps: { notched: true } },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { textTransform: "none", fontWeight: 600, borderRadius: 8, letterSpacing: "0.01em" },
          // Gold CTA: a filled secondary button reads as the "important action" the brand calls for.
          containedSecondary: {
            color: "#0B1D3A",
            "&:hover": { backgroundColor: "#C6942F" }
          },
          outlinedPrimary: { borderColor: "rgba(11,29,58,0.28)" }
        }
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600, letterSpacing: "0.01em" }
        }
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            border: mode === "light" ? "1px solid #E2E5EA" : "1px solid #1E3355",
            boxShadow: mode === "light" ? "0 1px 2px rgba(11,29,58,0.04), 0 6px 20px rgba(11,29,58,0.06)" : "0 2px 8px rgba(0,0,0,0.4)"
          }
        }
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-light)"
          }
        }
      }
    },
    typography: {
      // Inter carries the interface; Sora (via the HuroLogo + brand moments) carries the identity.
      fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
      h1: { fontSize: "2.5rem", fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.02em" },
      h2: { fontSize: "2.25rem", fontWeight: 700, lineHeight: 1.25, letterSpacing: "-0.02em" },
      h3: { fontSize: "clamp(1.75rem, 3vw, 2.25rem)", fontWeight: 700, lineHeight: 1.3, letterSpacing: "-0.015em" },
      h4: { fontSize: "1.75rem", fontWeight: 600, lineHeight: 1.35, letterSpacing: "-0.01em" },
      h5: { fontSize: "1.5rem", fontWeight: 600, lineHeight: 1.4, letterSpacing: "-0.01em" },
      h6: { fontSize: "1.25rem", fontWeight: 600, lineHeight: 1.45 },
      subtitle1: { fontSize: "1rem", fontWeight: 600, lineHeight: 1.5 },
      subtitle2: { fontSize: "0.875rem", fontWeight: 600, lineHeight: 1.5 },
      body1: { fontSize: "1rem", fontWeight: 400, lineHeight: 1.55 },
      body2: { fontSize: "0.875rem", fontWeight: 400, lineHeight: 1.55 },
      button: { fontWeight: 600, letterSpacing: "0.01em" },
      caption: { fontSize: "0.75rem", fontWeight: 400, lineHeight: 1.4 },
      overline: { fontSize: "0.72rem", fontWeight: 600, lineHeight: 1.4, letterSpacing: "0.12em", textTransform: "uppercase" }
    },
    shape: { borderRadius: 8 }
  });

const ThemedApp: React.FC = () => {
  const { mode } = useThemeMode();
  const theme = useMemo(() => createMdTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <CookiesProvider defaultSetOptions={{ path: "/" }}>
          <UserProvider>
            <Router>
              <Routes>
                <Route path="/*" element={<ControlPanel />} />
              </Routes>
            </Router>
          </UserProvider>
        </CookiesProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

const App: React.FC = () => (
  <>
    {EnvironmentHelper.Common.GoogleAnalyticsTag && (
      <>
        <script async src={`https://www.googletagmanager.com/gtag/js?id=${EnvironmentHelper.Common.GoogleAnalyticsTag}`} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${EnvironmentHelper.Common.GoogleAnalyticsTag}', {
              page_path: window.location.pathname,
            });
          `
          }}
        />
      </>
    )}

    <ThemeContextProvider>
      <ThemedApp />
    </ThemeContextProvider>
  </>
);
export default App;
