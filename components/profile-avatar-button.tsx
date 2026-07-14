import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";

import { colors, radius, shadow } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";

type Props = {
  style?: StyleProp<ViewStyle>;
};

export function ProfileAvatarButton({ style }: Props) {
  const router = useRouter();
  const { session } = useAuth();
  const name = session?.user.user_metadata?.full_name;
  const fallback = session?.user.email?.split("@")[0] ?? "A";
  const initial =
    typeof name === "string" && name.trim()
      ? name.trim().slice(0, 1).toUpperCase()
      : fallback.slice(0, 1).toUpperCase();

  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}
      onPress={() => router.push("/profile")}
      accessibilityRole="button"
      accessibilityLabel="Open profile"
      hitSlop={8}
    >
      <Text style={styles.initial}>{initial}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.primary,
    ...shadow.card,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.96 }],
  },
  initial: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
});
