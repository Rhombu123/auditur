import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "@/constants/theme";

export default function ScanScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/scan/camera");
  }, [router]);

  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.message}>Opening scanner…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
    backgroundColor: colors.background,
  },
  message: { textAlign: "center", color: colors.textSecondary, marginTop: spacing.md },
});
