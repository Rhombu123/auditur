import { findZoneForPoint } from "./geo.js";
import { buildHighlightedAuditPdf } from "./export-highlighted-pdf.js";
import { createAdminClient } from "./supabase/admin.js";
import { parseZonePolygons } from "./lot-zone-storage.js";

function startOfLocalDay(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export async function runExportAuditPdf(): Promise<{
  status: number;
  body: Record<string, unknown> | Buffer;
  headers?: Record<string, string>;
}> {
  const supabase = createAdminClient();

  const { data: upload, error: uploadError } = await supabase
    .from("inventory_uploads")
    .select("id, file_name, storage_path")
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (uploadError) throw uploadError;
  if (!upload) {
    return { status: 404, body: { error: "Upload a price list PDF first." } };
  }
  if (!upload.storage_path) {
    return {
      status: 422,
      body: {
        error:
          "This upload has no stored PDF. Re-upload the price list to enable highlighted export.",
      },
    };
  }

  const [{ data: pdfFile, error: storageError }, { data: zones }, { data: scans }] =
    await Promise.all([
      supabase.storage.from("price-lists").download(upload.storage_path),
      supabase.from("lot_zones").select("*").order("created_at", { ascending: true }),
      supabase.from("vehicle_scans").select("vin_suffix, latitude, longitude, scanned_at"),
    ]);

  if (storageError || !pdfFile) {
    throw storageError ?? new Error("Could not download stored price list PDF.");
  }

  const zoneModels = (zones ?? []).map((zone) => ({
    id: zone.id,
    name: zone.name,
    polygons: parseZonePolygons(zone.coordinates),
    fillColor: zone.fill_color,
    strokeColor: zone.stroke_color,
  }));

  const todayStart = startOfLocalDay();
  const highlights = new Map<
    string,
    { vinSuffix: string; fillColor: string; strokeColor: string; zoneName?: string }
  >();

  for (const scan of scans ?? []) {
    const scannedAt = new Date(scan.scanned_at);
    if (scannedAt < todayStart) continue;

    const suffix = scan.vin_suffix.toUpperCase();
    const zoneId = findZoneForPoint(
      { latitude: scan.latitude, longitude: scan.longitude },
      zoneModels,
    );
    const zone = zoneModels.find((entry) => entry.id === zoneId);
    if (!zone) continue;

    highlights.set(suffix, {
      vinSuffix: suffix,
      fillColor: zone.fillColor,
      strokeColor: zone.strokeColor,
      zoneName: zone.name,
    });
  }

  const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());
  const highlighted = await buildHighlightedAuditPdf(pdfBuffer, [...highlights.values()]);

  const safeName = upload.file_name.replace(/\.pdf$/i, "");
  return {
    status: 200,
    body: Buffer.from(highlighted),
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}-audit-highlighted.pdf"`,
    },
  };
}
