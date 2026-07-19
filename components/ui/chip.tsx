import { MotiView } from "moti";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";

import { colors, radius, spacing } from "@/constants/theme";

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  accentColor?: string;
};

export function Chip({ label, selected, onPress, style, accentColor }: Props) {
  const [pressed, setPressed] = useState(false);
  const content = (
    <MotiView
      animate={{
        scale: pressed ? 0.97 : 1,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primaryLight : colors.surface,
      }}
      transition={{ type: "timing", duration: 170 }}
      style={[styles.chip, style]}
    >
      {accentColor ? (
        <View style={[styles.dot, { backgroundColor: accentColor }]} />
      ) : null}
      <Text style={[styles.text, selected && styles.textSelected]}>{label}</Text>
    </MotiView>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
    >
      {content}
    </Pressable>
  );
}

export function ChipRow({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  text: {
    color: colors.textSecondary,
    fontWeight: "600",
    fontSize: 13,
  },
  textSelected: {
    color: colors.primaryDark,
    fontWeight: "700",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
