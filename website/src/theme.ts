export const palette = {
  slate50: "#F8FAFC",
  slate100: "#F1F5F9",
  slate200: "#E2E8F0",
  slate400: "#94A3B8",
  slate500: "#64748B",
  slate700: "#334155",
  slate900: "#0F172A",
  teal50: "#F0FDFA",
  teal100: "#CCFBF1",
  teal200: "#99F6E4",
  teal600: "#0D9488",
  teal700: "#0F766E",
  teal800: "#115E59",
  amber500: "#F59E0B",
  white: "#FFFFFF",
} as const;

export const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export const stagger = {
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 0.08 },
  },
};
