import { Platform, Share } from "react-native";

const exportApiUrl =
  process.env.EXPO_PUBLIC_EXPORT_API_URL ??
  (process.env.EXPO_PUBLIC_UPLOAD_API_URL ??
    "https://auditur.vercel.app/api/upload"
  ).replace(/\/upload\/?$/, "/export-audit");

async function sharePdf(uri: string): Promise<void> {
  try {
    const Sharing = await import("expo-sharing");
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: "Export highlighted audit PDF",
      });
      return;
    }
  } catch {
    // expo-sharing not linked in this native build
  }

  if (Platform.OS === "ios") {
    await Share.share({ url: uri });
    return;
  }

  throw new Error(
    "PDF sharing is not available in this build. Rebuild the app: npx expo run:ios --device",
  );
}

export async function exportHighlightedAuditPdf(): Promise<void> {
  const FileSystem = await import("expo-file-system/legacy");

  const fileName = `audit-highlighted-${Date.now()}.pdf`;
  const uri = `${FileSystem.cacheDirectory ?? ""}${fileName}`;

  const download = await FileSystem.downloadAsync(exportApiUrl, uri);
  if (download.status < 200 || download.status >= 300) {
    let message = "Export failed.";
    try {
      const body = await FileSystem.readAsStringAsync(download.uri);
      const data = JSON.parse(body) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  await sharePdf(download.uri);
}
