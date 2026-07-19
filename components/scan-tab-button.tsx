import Ionicons from "@expo/vector-icons/Ionicons";
import { MotiView } from "moti";
import { Pressable, StyleSheet } from "react-native";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";

import { colors, shadow, spacing } from "@/constants/theme";

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
        from={{ scale: 0.96, translateY: 0 }}
        animate={{
          scale: focused ? 1.04 : 1,
          translateY: focused ? -3 : 0,
        }}
        transition={{ type: "timing", duration: 220 }}
        style={[styles.fab, focused && styles.fabFocused]}
      >
        <Ionicons name="scan" size={34} color={colors.onPrimary} />
      </MotiView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: spacing.xs,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.tabBar,
    ...shadow.sheet,
  },
  fabFocused: {
    backgroundColor: colors.primaryDark,
  },
});
