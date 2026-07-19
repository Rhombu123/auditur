import { MotiView } from "moti";
import { useState } from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";

import { colors, radius, shadow, spacing } from "@/constants/theme";

type Props = {
  children: React.ReactNode;
  active?: boolean;
  inactive?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: ViewStyle;
};

export function Card({ children, active, inactive, onPress, onLongPress, style }: Props) {
  const [pressed, setPressed] = useState(false);
  const cardStyle = [
    styles.card,
    active && styles.cardActive,
    inactive && styles.cardInactive,
    style,
  ];

  if (onPress || onLongPress) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
      >
        <MotiView
          animate={{ opacity: pressed ? 0.93 : 1, scale: pressed ? 0.985 : 1 }}
          transition={{ type: "timing", duration: 160 }}
          style={cardStyle}
        >
          {children}
        </MotiView>
      </Pressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md + 2,
    marginBottom: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardActive: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.surfaceActive,
  },
  cardInactive: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    ...shadow.card,
    shadowOpacity: 0,
    elevation: 0,
  },
});
