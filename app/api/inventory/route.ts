import { NextResponse } from "next/server";

import {
  getLatestInventorySnapshot,
  saveInventorySnapshot,
} from "@/lib/db/inventory";
import type { InventoryItem } from "@/lib/types";

export async function GET() {
  try {
    const inventory = await getLatestInventorySnapshot();
    return NextResponse.json({ inventory });
  } catch (error) {
    console.error("Inventory fetch failed:", error);
    return NextResponse.json(
      { error: "Failed to load inventory from database." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      fileName?: string;
      items?: InventoryItem[];
    };

    if (!body.fileName || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: "fileName and items are required." },
        { status: 400 },
      );
    }

    const inventory = await saveInventorySnapshot(body.fileName, body.items);
    return NextResponse.json({ inventory });
  } catch (error) {
    console.error("Inventory save failed:", error);
    return NextResponse.json(
      { error: "Failed to save inventory to database." },
      { status: 500 },
    );
  }
}
