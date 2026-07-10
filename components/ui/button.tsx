import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from "react-native";

import { colors, radius, spacing } from "@/constants/theme";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
  style?: ViewStyle;
};

const variantStyles: Record<
  Variant,
  { button: ViewStyle; text: { color: string; fontWeight: "600" | "700" } }
> = {
  primary: {
    button: { backgroundColor: colors.primary, borderColor: colors.primary },
    text: { color: colors.onPrimary, fontWeight: "700" },
  },
  secondary: {
    button: { backgroundColor: colors.surface, borderColor: colors.border },
    text: { color: colors.text, fontWeight: "600" },
  },
  ghost: {
    button: { backgroundColor: "transparent", borderColor: colors.border },
    text: { color: colors.textSecondary, fontWeight: "600" },
  },
  danger: {
    button: { backgroundColor: colors.dangerLight, borderColor: colors.dangerBorder },
    text: { color: colors.danger, fontWeight: "600" },
  },
  success: {
    button: { backgroundColor: colors.successLight, borderColor: colors.primaryBorder },
    text: { color: colors.primaryDark, fontWeight: "600" },
  },
};

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  compact,
  style,
}: Props) {
  const v = variantStyles[variant];

  return (
    <Pressable
      style={[
        styles.base,
        compact && styles.compact,
        v.button,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={v.text.color} size="small" />
      ) : (
        <Text style={[styles.text, v.text]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  compact: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 36,
  },
  disabled: { opacity: 0.55 },
  text: { fontSize: 14 },
});
