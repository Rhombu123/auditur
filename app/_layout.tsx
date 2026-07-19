import "react-native-gesture-handler";
import "react-native-reanimated";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { AppLoadingScreen } from "@/components/app-loading-screen";
import { MfaGate } from "@/components/mfa-gate";
import { colors } from "@/constants/theme";
import { AUTH_ENABLED } from "@/lib/auth-config";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { DealershipProvider, useDealership } from "@/lib/dealership-context";
import { MfaProvider, useMfa } from "@/lib/mfa-context";
import { clearAllMobileCache } from "@/lib/mobile-cache";
import { clearMobileLotViews } from "@/lib/mobile-lot-view";

void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 280, fade: true });

function AuthGate() {
  const { session, loading } = useAuth();
  const { status: mfaStatus } = useMfa();
  const { status: dealershipStatus, hasPermission } = useDealership();
  const segments = useSegments();
  const router = useRouter();
  const [introComplete, setIntroComplete] = useState(false);
  const [privacyCovered, setPrivacyCovered] = useState(false);
  const finishIntro = useCallback(() => setIntroComplete(true), []);

  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const hidden = nextState !== "active";
      setPrivacyCovered(hidden);
      if (hidden) {
        clearAllMobileCache();
        clearMobileLotViews();
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!AUTH_ENABLED) return;
    if (!introComplete) return;
    if (loading) return;
    if (session && mfaStatus !== "verified") return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
      return;
    }

    if (session && inAuthGroup && dealershipStatus === "ready") {
      const destination = hasPermission("view_audit")
        ? "/(tabs)/audit"
        : hasPermission("view_vehicles")
          ? "/(tabs)/vehicles"
          : hasPermission("scan_vehicles")
            ? "/(tabs)/scan"
            : hasPermission("manage_uploads")
              ? "/(tabs)"
              : hasPermission("view_map")
                ? "/(tabs)/map"
                : "/profile";
      router.replace(destination);
      return;
    }

    if (
      session &&
      (dealershipStatus === "no-dealership" ||
        dealershipStatus === "error") &&
      segments[0] !== "team"
    ) {
      router.replace("/team");
    }
  }, [
    dealershipStatus,
    hasPermission,
    introComplete,
    loading,
    mfaStatus,
    router,
    segments,
    session,
  ]);

  const appIsLoading =
    AUTH_ENABLED &&
    (loading || Boolean(session && dealershipStatus === "loading"));
  const showStartup = !introComplete || appIsLoading;
  const showMfa =
    AUTH_ENABLED &&
    Boolean(session) &&
    mfaStatus !== "verified" &&
    mfaStatus !== "signed-out";

  return (
    <View style={styles.root}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="team" />
      </Stack>
      {showStartup ? (
        <View style={styles.startupOverlay}>
          <AppLoadingScreen onIntroComplete={finishIntro} />
        </View>
      ) : null}
      {!showStartup && showMfa ? (
        <View style={styles.startupOverlay}>
          <MfaGate />
        </View>
      ) : null}
      {privacyCovered ? <View style={styles.privacyCover} /> : null}
    </View>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <MfaProvider>
        <DealershipProvider>
          <StatusBar style="dark" backgroundColor={colors.surface} />
          <AuthGate />
        </DealershipProvider>
      </MfaProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  startupOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  privacyCover: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    backgroundColor: colors.surface,
  },
});
