"use client";

import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: "class" },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#4f46e5" },
        background: { default: "#f8fafc", paper: "#ffffff" },
        success: { main: "#16a34a" },
        error: { main: "#dc2626" },
        warning: { main: "#d97706" },
      },
    },
    dark: {
      palette: {
        primary: { main: "#818cf8" },
        background: { default: "#0b1120", paper: "#111827" },
        success: { main: "#22c55e" },
        error: { main: "#f87171" },
        warning: { main: "#fbbf24" },
      },
    },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { backgroundImage: "none" } } },
    MuiCard: { defaultProps: { variant: "outlined" } },
    MuiTextField: { defaultProps: { size: "small", fullWidth: true } },
    MuiSelect: { defaultProps: { size: "small" } },
  },
});
