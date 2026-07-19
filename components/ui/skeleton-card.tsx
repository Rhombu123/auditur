import { MotiView } from "moti";
import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "@/constants/theme";

function SkeletonBlock({
  width,
  height,
}: {
  width: `${number}%` | number;
  height: number;
}) {
  return (
    <MotiView
      from={{ opacity: 0.42 }}
      animate={{ opacity: 0.9 }}
      transition={{
        type: "timing",
        duration: 700,
        loop: true,
        repeatReverse: true,
      }}
      style={[styles.block, { width, height }]}
    />
  );
}

export function SkeletonCards({
  count = 4,
  showSummary = false,
}: {
  count?: number;
  showSummary?: boolean;
}) {
  return (
    <View style={styles.container} accessibilityLabel="Loading content">
      {showSummary ? (
        <View style={[styles.card, styles.summary]}>
          <View style={styles.row}>
            <SkeletonBlock width={44} height={44} />
            <View style={styles.copy}>
              <SkeletonBlock width="42%" height={11} />
              <SkeletonBlock width="72%" height={18} />
            </View>
            <SkeletonBlock width={54} height={30} />
          </View>
          <SkeletonBlock width="100%" height={10} />
          <SkeletonBlock width="62%" height={12} />
        </View>
      ) : null}
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={styles.card}>
          <View style={styles.row}>
            <SkeletonBlock width="46%" height={16} />
            <SkeletonBlock width={70} height={24} />
          </View>
          <SkeletonBlock width="66%" height={14} />
          <SkeletonBlock width="88%" height={11} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  card: {
    minHeight: 108,
    gap: spacing.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  summary: {
    minHeight: 148,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  copy: {
    flex: 1,
    gap: spacing.sm,
  },
  block: {
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
});
