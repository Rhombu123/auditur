import { Platform, Share } from "react-native";

import { requireApiDealershipId } from "@/lib/active-dealership";
import { supabase } from "@/lib/supabase";

const configuredExportApiUrl =
  process.env.EXPO_PUBLIC_EXPORT_API_URL ??
  (process.env.EXPO_PUBLIC_UPLOAD_API_URL ??
    "https://auditur.vercel.app/api/upload/"
  ).replace(/\/upload\/?$/, "/export-audit/");
const exportApiUrl = `${configuredExportApiUrl.replace(/\/$/, "")}/`;

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

export async function exportHighlightedAuditPdf(uploadId?: string): Promise<void> {
  const FileSystem = await import("expo-file-system/legacy");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in again to export this audit.");

  const fileName = `audit-highlighted-${Date.now()}.pdf`;
  const uri = `${FileSystem.cacheDirectory ?? ""}${fileName}`;

  const url = uploadId
    ? `${exportApiUrl}?uploadId=${encodeURIComponent(uploadId)}`
    : exportApiUrl;
  const download = await FileSystem.downloadAsync(url, uri, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Auditur-Dealership-ID": requireApiDealershipId(),
    },
  });
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

  const contentType =
    Object.entries(download.headers).find(
      ([key]) => key.toLowerCase() === "content-type",
    )?.[1] ?? "";
  if (!contentType.toLowerCase().includes("application/pdf")) {
    await FileSystem.deleteAsync(download.uri, { idempotent: true });
    throw new Error(
      "The export server did not return a PDF. Check the configured Auditur API URL and try again.",
    );
  }

  await sharePdf(download.uri);
}
