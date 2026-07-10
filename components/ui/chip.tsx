import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";

import { colors, radius, spacing } from "@/constants/theme";

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

export function Chip({ label, selected, onPress, style }: Props) {
  const content = (
    <View style={[styles.chip, selected && styles.chipSelected, style]}>
      <Text style={[styles.text, selected && styles.textSelected]}>{label}</Text>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
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
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
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
  pressed: { opacity: 0.85 },
});
