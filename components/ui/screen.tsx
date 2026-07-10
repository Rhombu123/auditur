import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { colors, spacing } from "@/constants/theme";

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function ScreenSubtitle({
  children,
  style,
}: {
  children: string;
  style?: import("react-native").TextStyle;
}) {
  return <Text style={[styles.subtitle, style]}>{children}</Text>;
}

export function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function EmptyState({ children }: { children: string }) {
  return <Text style={styles.empty}>{children}</Text>;
}

export function ErrorText({ children }: { children: string }) {
  return <Text style={styles.error}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  subtitle: {
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    fontSize: 11,
    fontWeight: "700",
    color: colors.primaryDark,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  empty: {
    textAlign: "center",
    color: colors.textMuted,
    marginTop: spacing.xxl,
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: spacing.xxl,
  },
  error: {
    color: colors.danger,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    fontSize: 14,
  },
});
