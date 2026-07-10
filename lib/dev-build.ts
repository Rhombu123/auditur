import Constants from "expo-constants";

/** True when running inside the Expo Go client (no custom native modules). */
export function isExpoGo(): boolean {
  return Constants.appOwnership === "expo";
}

/** True when running a custom dev/production build (npx expo run:ios / EAS). */
export function isDevBuild(): boolean {
  return !isExpoGo();
}
