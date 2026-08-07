// Sendy design tokens (TS) — for places that can't take a className:
// navigation options, StatusBar, SVG fills, gradient stops.
// Keep in sync with tailwind.config.js.

export const colors = {
  pink: {
    50: '#FFF1F7',
    100: '#FFE1EE',
    200: '#FFC4DC',
    400: '#F569A6',
    600: '#E6297A', // primary
    700: '#C21E63',
    900: '#7A1140',
  },
  ink: '#191420',
  body: '#4A4652',
  muted: '#8A8690',
  surface: '#F7F7F8',
  hairline: '#ECEBEE',
  white: '#FFFFFF',
  success: '#12A150',
  star: '#F5A623',
  savings: '#FF8A00',
  error: '#E5484D',
  info: '#2E90FA',
} as const;

export const primary = colors.pink[600];

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 12, base: 16, lg: 20, xl: 24, '2xl': 32 } as const;

// design.md §7 — soft, low-contrast elevation.
export const shadow = {
  card: {
    shadowColor: '#191420',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  float: {
    shadowColor: '#191420',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
} as const;

// Splash / promo gradient (pink-600 → pink-900).
export const brandGradient = [colors.pink[600], colors.pink[900]] as const;

export const fonts = {
  display: 'PlusJakartaSans_700Bold',
  displaySemi: 'PlusJakartaSans_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
} as const;
