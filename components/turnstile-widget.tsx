import { StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

import { colors, radius, spacing } from "@/constants/theme";

const siteKey = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY;

export function TurnstileWidget({
  onToken,
}: {
  onToken: (token: string | null) => void;
}) {
  if (!siteKey) {
    return __DEV__ ? null : (
      <Text style={styles.error}>Security verification is not configured.</Text>
    );
  }

  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script></head><body style="margin:0;display:flex;justify-content:center;background:#fff"><div class="cf-turnstile" data-sitekey="${siteKey}" data-callback="verified" data-expired-callback="expired" data-error-callback="expired"></div><script>function verified(token){window.ReactNativeWebView.postMessage(token)}function expired(){window.ReactNativeWebView.postMessage("")}</script></body></html>`;

  return (
    <View style={styles.frame}>
      <WebView
        source={{ html, baseUrl: "https://auditur.app" }}
        originWhitelist={["https://*"]}
        javaScriptEnabled
        scrollEnabled={false}
        onMessage={(event) => onToken(event.nativeEvent.data || null)}
      />
    </View>
  );
}

export const turnstileConfigured = Boolean(siteKey);

const styles = StyleSheet.create({
  frame: {
    height: 70,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  error: {
    padding: spacing.sm,
    color: colors.danger,
    fontSize: 13,
    textAlign: "center",
  },
});
