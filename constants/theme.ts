/**
 * Auditur design system — Mobbin-inspired inventory/field-app patterns:
 * slate neutrals, teal primary, white elevated cards, pill chips & status badges.
 */
export const palette = {
  slate50: "#F8FAFC",
  slate100: "#F1F5F9",
  slate200: "#E2E8F0",
  slate300: "#CBD5E1",
  slate400: "#94A3B8",
  slate500: "#64748B",
  slate600: "#475569",
  slate700: "#334155",
  slate800: "#1E293B",
  slate900: "#0F172A",
  teal50: "#F0FDFA",
  teal100: "#CCFBF1",
  teal200: "#99F6E4",
  teal500: "#14B8A6",
  teal600: "#0D9488",
  teal700: "#0F766E",
  teal800: "#115E59",
  amber500: "#F59E0B",
  red50: "#FEF2F2",
  red100: "#FEE2E2",
  red600: "#DC2626",
  orange50: "#FFF7ED",
  orange200: "#FED7AA",
  orange600: "#EA580C",
  white: "#FFFFFF",
  black: "#000000",
} as const;

export const colors = {
  background: palette.slate50,
  surface: palette.white,
  surfaceMuted: palette.slate100,
  surfaceActive: palette.teal50,
  border: palette.slate200,
  borderStrong: palette.slate300,
  text: palette.slate900,
  textSecondary: palette.slate500,
  textMuted: palette.slate400,
  textInverse: palette.white,
  primary: palette.teal600,
  primaryDark: palette.teal700,
  primaryLight: palette.teal50,
  primaryBorder: palette.teal200,
  onPrimary: palette.white,
  accent: palette.amber500,
  success: palette.teal600,
  successLight: palette.teal50,
  danger: palette.red600,
  dangerLight: palette.red50,
  dangerBorder: palette.red100,
  warning: palette.orange600,
  warningLight: palette.orange50,
  warningBorder: palette.orange200,
  tabInactive: palette.slate400,
  mapPin: palette.teal600,
  mapPinSelected: palette.teal800,
  mapPinHistory: palette.teal200,
  overlay: "rgba(15, 23, 42, 0.5)",
  cameraBg: palette.slate900,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 16,
  xl: 20,
  sheet: 24,
  pill: 999,
} as const;

export const typography = {
  vin: {
    fontFamily: "Menlo",
    letterSpacing: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.6,
    color: colors.primaryDark,
  },
} as const;

export const shadow = {
  card: {
    shadowColor: palette.slate900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  sheet: {
    shadowColor: palette.slate900,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;
