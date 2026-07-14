import "react-native-reanimated";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";

import { AppLoadingScreen } from "@/components/app-loading-screen";
import { colors } from "@/constants/theme";
import { AUTH_ENABLED } from "@/lib/auth-config";
import { AuthProvider, useAuth } from "@/lib/auth-context";

void SplashScreen.preventAutoHideAsync();

function AuthGate() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [showAnimatedLoader, setShowAnimatedLoader] = useState(false);

  useEffect(() => {
    if (!AUTH_ENABLED || !loading) {
      setShowAnimatedLoader(false);
      void SplashScreen.hideAsync();
      return;
    }

    const timer = setTimeout(() => {
      setShowAnimatedLoader(true);
      void SplashScreen.hideAsync();
    }, 800);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (!AUTH_ENABLED) return;
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
      return;
    }

    if (session && inAuthGroup) {
      router.replace("/(tabs)/audit");
    }
  }, [loading, router, segments, session]);

  if (AUTH_ENABLED && loading) {
    return showAnimatedLoader ? <AppLoadingScreen /> : null;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" backgroundColor={colors.surface} />
      <AuthGate />
    </AuthProvider>
  );
}
