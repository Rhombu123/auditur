import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { MotiView } from "moti";
import { StyleSheet } from "react-native";

import { ProfileAvatarButton } from "@/components/profile-avatar-button";
import { ScanTabButton } from "@/components/scan-tab-button";
import { colors, spacing } from "@/constants/theme";
import { useDealership } from "@/lib/dealership-context";

function TabIcon({
  focused,
  name,
  activeName,
}: {
  focused: boolean;
  name: keyof typeof Ionicons.glyphMap;
  activeName: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <MotiView
      animate={{
        width: focused ? 64 : 40,
        height: focused ? 42 : 32,
        borderRadius: focused ? 21 : 16,
        translateY: focused ? -3 : 0,
        scale: focused ? 1 : 0.96,
        backgroundColor: focused
          ? "rgba(255,255,255,0.18)"
          : "rgba(255,255,255,0)",
      }}
      transition={{ type: "timing", duration: 220 }}
      style={[styles.iconWrap, focused && styles.iconWrapActive]}
    >
      <Ionicons
        name={focused ? activeName : name}
        size={focused ? 24 : 21}
        color={focused ? colors.tabActive : colors.tabInactive}
      />
    </MotiView>
  );
}

export default function TabLayout() {
  const { hasPermission } = useDealership();
  const canScanVehicles = hasPermission("scan_vehicles");
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        headerTintColor: colors.primary,
        headerTitleStyle: { fontWeight: "700", color: colors.text, fontSize: 17 },
        headerShadowVisible: false,
        headerRight: () => <ProfileAvatarButton style={{ marginRight: spacing.lg }} />,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 84,
          paddingTop: spacing.sm,
          backgroundColor: colors.tabBar,
          borderTopWidth: 0,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          shadowColor: colors.tabBar,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.28,
          shadowRadius: 18,
          elevation: 12,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          marginBottom: spacing.sm,
        },
      }}
    >
      <Tabs.Screen
        name="audit"
        options={{
          title: "Audit",
          href: hasPermission("view_audit") ? undefined : null,
          tabBarLabel: "Audit",
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} name="clipboard-outline" activeName="clipboard" />
          ),
        }}
      />
      <Tabs.Screen
        name="vehicles"
        options={{
          title: "Vehicles",
          href: hasPermission("view_vehicles") ? undefined : null,
          tabBarLabel: "Vehicles",
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} name="car-outline" activeName="car" />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scan",
          tabBarLabel: "Scan",
          ...(canScanVehicles
            ? { tabBarButton: (props) => <ScanTabButton {...props} /> }
            : { href: null }),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "Upload",
          href: hasPermission("manage_uploads") ? undefined : null,
          tabBarLabel: "Upload",
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} name="cloud-upload-outline" activeName="cloud-upload" />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          href: hasPermission("view_map") ? undefined : null,
          tabBarLabel: "Map",
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} name="map-outline" activeName="map" />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.34)",
    shadowColor: colors.onPrimary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
});
