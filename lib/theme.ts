// Sendy design tokens (TS) — for places that can't use Tailwind classes,
// e.g. navigation options, StatusBar, chart libs. Keep in sync with tailwind.config.js.

export const colors = {
  pink: {
    50: "#FFF1F7",
    100: "#FFE1EE",
    200: "#FFC4DC",
    400: "#F569A6",
    600: "#E6297A", // primary
    700: "#C21E63",
    900: "#7A1140",
  },
  ink: "#191420",
  body: "#4A4652",
  muted: "#8A8690",
  surface: "#F7F7F8",
  hairline: "#ECEBEE",
  white: "#FFFFFF",
  success: "#12A150",
  star: "#F5A623",
  savings: "#FF8A00",
  error: "#E5484D",
  info: "#2E90FA",
} as const;

export const primary = colors.pink[600];

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 12, base: 16, lg: 20, xl: 24, "2xl": 32 } as const;

// Type scale (size / lineHeight) — see design.md §6
export const type = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: "700" },
  h1: { fontSize: 24, lineHeight: 30, fontWeight: "700" },
  h2: { fontSize: 20, lineHeight: 26, fontWeight: "600" },
  h3: { fontSize: 17, lineHeight: 22, fontWeight: "600" },
  body: { fontSize: 15, lineHeight: 22, fontWeight: "400" },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "400" },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: "600" },
} as const;
