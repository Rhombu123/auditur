import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  PanResponder,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/screen";
import { VinSearchInput } from "@/components/vin-search-input";
import { colors, radius, shadow, spacing, typography } from "@/constants/theme";
import type { ScannedVehicle } from "@/lib/types";
import { formatVinPrimary, formatVinSecondary } from "@/lib/vin-display";
import { formatVehicleTitle, getVehicleDisplay } from "@/lib/vehicle-display";

type Props = {
  vehicles: ScannedVehicle[];
  selectedId: string | null;
  zoneLabelForVehicle: (vehicle: ScannedVehicle) => string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelectVehicle: (vehicle: ScannedVehicle) => void;
  onOpenVehicle: (vinSuffix: string) => void;
  onFocusVehicle: (vehicle: ScannedVehicle) => void;
};

const PEEK_HEIGHT = 72;
const ANIMATION_MS = 280;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function MapVehicleSheet({
  vehicles,
  selectedId,
  zoneLabelForVehicle,
  search,
  onSearchChange,
  onSelectVehicle,
  onOpenVehicle,
  onFocusVehicle,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);

  const collapsedHeight = PEEK_HEIGHT + insets.bottom;
  const expandedHeight = Math.min(height * 0.52, height - insets.top - 120) + insets.bottom;

  const sheetHeight = useSharedValue(collapsedHeight);
  const dragStartHeight = useRef(collapsedHeight);

  useEffect(() => {
    sheetHeight.value = withTiming(expanded ? expandedHeight : collapsedHeight, {
      duration: ANIMATION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [collapsedHeight, expanded, expandedHeight, sheetHeight]);

  const animatedSheetStyle = useAnimatedStyle(() => ({
    height: sheetHeight.value,
  }));

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4,
        onPanResponderGrant: () => {
          cancelAnimation(sheetHeight);
          dragStartHeight.current = sheetHeight.value;
        },
        onPanResponderMove: (_, gesture) => {
          const next = clamp(
            dragStartHeight.current - gesture.dy,
            collapsedHeight,
            expandedHeight,
          );
          sheetHeight.value = next;
        },
        onPanResponderRelease: (_, gesture) => {
          if (Math.abs(gesture.dy) < 8 && Math.abs(gesture.vy) < 0.25) {
            setExpanded((open) => !open);
            return;
          }

          const currentHeight = clamp(
            dragStartHeight.current - gesture.dy,
            collapsedHeight,
            expandedHeight,
          );
          const midpoint = (collapsedHeight + expandedHeight) / 2;
          const shouldExpand =
            gesture.vy < -0.35 ||
            (Math.abs(gesture.vy) <= 0.35 && currentHeight > midpoint);

          setExpanded(shouldExpand);
        },
      }),
    [collapsedHeight, expandedHeight, sheetHeight],
  );

  return (
    <Animated.View
      style={[
        styles.sheet,
        animatedSheetStyle,
        { paddingBottom: insets.bottom },
      ]}
    >
      <View style={styles.handleRow} {...panResponder.panHandlers}>
        <View style={styles.handle} />
        <Text style={styles.handleText}>
          {vehicles.length} vehicle{vehicles.length === 1 ? "" : "s"}
          {expanded ? " · swipe or tap to collapse" : " · swipe or tap for list"}
        </Text>
        <Ionicons
          name={expanded ? "chevron-down" : "chevron-up"}
          size={18}
          color={colors.textSecondary}
        />
      </View>

      <View style={styles.expandedBody}>
        <VinSearchInput
          style={styles.search}
          value={search}
          onChangeText={onSearchChange}
        />
        <FlatList
          data={vehicles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState>No vehicles match your filters.</EmptyState>
          }
          renderItem={({ item }) => {
            const display = getVehicleDisplay(item);
            const vinSecondary = formatVinSecondary(item.vin, item.vinSuffix);
            const zoneName = zoneLabelForVehicle(item);
            const isSelected = item.id === selectedId;

            return (
              <Card
                active={isSelected}
                onPress={() => {
                  onSelectVehicle(item);
                  onOpenVehicle(item.vinSuffix);
                }}
                onLongPress={() => {
                  onFocusVehicle(item);
                  onSelectVehicle(item);
                }}
              >
                <Text style={styles.vin}>
                  {formatVinPrimary(item.vin, item.vinSuffix)}
                </Text>
                {vinSecondary ? <Text style={styles.vinMeta}>{vinSecondary}</Text> : null}
                <Text style={styles.model} numberOfLines={2}>
                  {formatVehicleTitle(display)}
                </Text>
                <Text style={styles.detail} numberOfLines={1}>
                  {display.color} · {item.scanCount} scan{item.scanCount === 1 ? "" : "s"}
                  {zoneName ? ` · ${zoneName}` : ""}
                </Text>
              </Card>
            );
          }}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderColor: colors.border,
    ...shadow.sheet,
  },
  handleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  handle: {
    position: "absolute",
    top: spacing.sm,
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
  },
  handleText: {
    marginTop: spacing.sm,
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  expandedBody: { flex: 1 },
  search: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  vin: { ...typography.vin, fontSize: 14, fontWeight: "700", color: colors.text },
  vinMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  model: { fontWeight: "600", marginTop: spacing.xs, color: colors.text },
  detail: { color: colors.textSecondary, marginTop: spacing.xs, fontSize: 13 },
});
