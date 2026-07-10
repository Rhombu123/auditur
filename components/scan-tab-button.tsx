import Ionicons from "@expo/vector-icons/Ionicons";
import { MotiView } from "moti";
import { Pressable, StyleSheet } from "react-native";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";

import { colors, palette, shadow, spacing } from "@/constants/theme";

export function ScanTabButton({
  onPress,
  accessibilityState,
}: BottomTabBarButtonProps) {
  const focused = accessibilityState?.selected ?? false;

  return (
    <Pressable
      onPress={onPress}
      style={styles.wrap}
      accessibilityRole="button"
      accessibilityState={accessibilityState}
    >
      <MotiView
        from={{ scale: 0.92, translateY: -4 }}
        animate={{
          scale: focused ? 1.06 : 1,
          translateY: focused ? -14 : -8,
        }}
        transition={{ type: "spring", damping: 16, stiffness: 220 }}
        style={[styles.fab, focused && styles.fabFocused]}
      >
        <Ionicons name="scan" size={30} color={colors.onPrimary} />
      </MotiView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: spacing.sm,
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: palette.white,
    ...shadow.sheet,
  },
  fabFocused: {
    backgroundColor: colors.primaryDark,
  },
});
