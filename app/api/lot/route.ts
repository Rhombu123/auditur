import { NextResponse } from "next/server";

import { getActiveLotVehicles, markVehicleLotStatus } from "@/lib/db/lot";
import type { LotStatus } from "@/lib/types";

export async function GET() {
  try {
    const vehicles = await getActiveLotVehicles();
    const pinnedVehicles = vehicles.filter(
      (vehicle) => vehicle.latitude !== null && vehicle.longitude !== null,
    );

    return NextResponse.json({
      vehicles,
      pinnedCount: pinnedVehicles.length,
      scannedTodayCount: vehicles.filter((vehicle) => vehicle.scannedToday).length,
    });
  } catch (error) {
    console.error("Lot fetch failed:", error);
    return NextResponse.json(
      { error: "Failed to load lot map data." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      itemId?: string;
      lotStatus?: LotStatus;
    };

    if (!body.itemId || (body.lotStatus !== "sold" && body.lotStatus !== "auctioned")) {
      return NextResponse.json(
        { error: "itemId and lotStatus (sold or auctioned) are required." },
        { status: 400 },
      );
    }

    await markVehicleLotStatus(body.itemId, body.lotStatus);
    const vehicles = await getActiveLotVehicles();

    return NextResponse.json({ success: true, vehicles });
  } catch (error) {
    console.error("Lot status update failed:", error);
    return NextResponse.json(
      { error: "Failed to update vehicle lot status." },
      { status: 500 },
    );
  }
}
