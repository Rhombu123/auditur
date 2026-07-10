import type { Router } from "expo-router";

export function goBackOrHome(router: Router, home: "/(tabs)" | "/(tabs)/vehicles" = "/(tabs)") {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(home);
  }
}
