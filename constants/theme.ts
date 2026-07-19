/**
 * High-contrast field palette for bright outdoor use. Warm, low-glare
 * surfaces sit under deep navy type, teal actions, and orange alerts.
 */
export const palette = {
  slate50: "#F4F7F5",
  slate100: "#E8EFEC",
  slate200: "#D2DED9",
  slate300: "#B6C6BF",
  slate400: "#6B7C75",
  slate500: "#4A5D55",
  slate600: "#344A42",
  slate700: "#243D35",
  slate800: "#17332D",
  slate900: "#102A43",
  teal50: "#EAF8F5",
  teal100: "#D1F0EA",
  teal200: "#9DDDD2",
  teal500: "#009B94",
  teal600: "#007C78",
  teal700: "#006561",
  teal800: "#004E4B",
  amber500: "#F59E0B",
  red50: "#FFF1F0",
  red100: "#FFD6D2",
  red600: "#C62828",
  orange50: "#FFF4E8",
  orange200: "#FFD09B",
  orange600: "#C2410C",
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
  tabBar: palette.slate900,
  tabActive: palette.white,
  tabInactive: "#B8C7D4",
  mapPin: palette.teal600,
  mapPinSelected: palette.teal800,
  mapPinHistory: palette.teal200,
  overlay: "rgba(16, 42, 67, 0.72)",
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
