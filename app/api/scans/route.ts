import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ScanRecord } from "@/lib/types";

function mapScan(row: {
  id: string;
  vin: string | null;
  vin_suffix: string;
  raw_value: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  model: string | null;
  color: string | null;
  days_on_lot: number | null;
  matched: boolean;
  scanned_at: string;
}): ScanRecord {
  return {
    id: row.id,
    vin: row.vin,
    vinSuffix: row.vin_suffix,
    rawValue: row.raw_value,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracy: row.accuracy,
    matchedItem: row.matched
      ? {
          vinSuffix: row.vin_suffix,
          model: row.model ?? "Unknown",
          color: row.color ?? "Unknown",
          daysOnLot: row.days_on_lot,
        }
      : null,
    scannedAt: row.scanned_at,
  };
}

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("vehicle_scans")
      .select("*")
      .order("scanned_at", { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      scans: (data ?? []).map(mapScan),
    });
  } catch (error) {
    console.error("Scan fetch failed:", error);
    return NextResponse.json(
      { error: "Failed to load scans from database." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      vin?: string | null;
      vinSuffix?: string;
      rawValue?: string;
      latitude?: number;
      longitude?: number;
      accuracy?: number | null;
      matchedItem?: ScanRecord["matchedItem"];
    };

    if (
      !body.vinSuffix ||
      !body.rawValue ||
      typeof body.latitude !== "number" ||
      typeof body.longitude !== "number"
    ) {
      return NextResponse.json(
        { error: "vinSuffix, rawValue, latitude, and longitude are required." },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const matched = Boolean(body.matchedItem);

    const { data, error } = await supabase
      .from("vehicle_scans")
      .insert({
        vin: body.vin ?? null,
        vin_suffix: body.vinSuffix.toUpperCase(),
        raw_value: body.rawValue,
        latitude: body.latitude,
        longitude: body.longitude,
        accuracy: body.accuracy ?? null,
        model: body.matchedItem?.model ?? null,
        color: body.matchedItem?.color ?? null,
        days_on_lot: body.matchedItem?.daysOnLot ?? null,
        matched,
      })
      .select("*")
      .single();

    if (error || !data) {
      throw error ?? new Error("Failed to save scan.");
    }

    return NextResponse.json({ scan: mapScan(data) });
  } catch (error) {
    console.error("Scan save failed:", error);
    return NextResponse.json(
      { error: "Failed to save scan to database." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("vehicle_scans")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Scan clear failed:", error);
    return NextResponse.json(
      { error: "Failed to clear scans." },
      { status: 500 },
    );
  }
}
