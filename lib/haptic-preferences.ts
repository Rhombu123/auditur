import AsyncStorage from "@react-native-async-storage/async-storage";

const SCAN_SUCCESS_HAPTICS_KEY = "@auditur/scan-success-haptics";

export async function getScanSuccessHapticsEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(SCAN_SUCCESS_HAPTICS_KEY)) !== "disabled";
}

export async function setScanSuccessHapticsEnabled(
  enabled: boolean,
): Promise<void> {
  await AsyncStorage.setItem(
    SCAN_SUCCESS_HAPTICS_KEY,
    enabled ? "enabled" : "disabled",
  );
}

export async function playScanSuccessHaptic(): Promise<void> {
  if (!(await getScanSuccessHapticsEnabled())) return;

  const Haptics = await import("expo-haptics");
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}
