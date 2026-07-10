import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";

import { colors, radius, spacing } from "@/constants/theme";

type Props = TextInputProps & {
  style?: ViewStyle;
};

export function VinSearchInput({ style, placeholder, ...props }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <Ionicons name="search" size={18} color={colors.textMuted} style={styles.icon} />
      <TextInput
        {...props}
        style={styles.input}
        placeholder={placeholder ?? "Search last 6, 8, or full VIN…"}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="characters"
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    ...{
      shadowColor: colors.text,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 1,
    },
  },
  icon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
});
