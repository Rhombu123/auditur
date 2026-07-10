import { StyleSheet, Text, View } from "react-native";

import { lotStatusBadgeStyle, lotStatusLabel } from "@/lib/lot-status";
import type { LotStatus } from "@/lib/types";

export function LotStatusBadge({ status }: { status: LotStatus }) {
  const colors = lotStatusBadgeStyle(status);

  return (
    <View style={[styles.badge, { backgroundColor: colors.backgroundColor, borderColor: colors.borderColor }]}>
      <Text style={[styles.text, { color: colors.color }]}>{lotStatusLabel(status)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: "700",
  },
});
