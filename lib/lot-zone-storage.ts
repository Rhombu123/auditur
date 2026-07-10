export type MapCoordinate = { latitude: number; longitude: number };

export function normalizeZoneName(name: string): string {
  return name.trim().toLowerCase();
}

/** Supports legacy single-polygon rows and multi-polygon JSON. */
export function parseZonePolygons(raw: unknown): MapCoordinate[][] {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const first = raw[0];
  if (
    first &&
    typeof first === "object" &&
    "latitude" in first &&
    "longitude" in first
  ) {
    return [raw as MapCoordinate[]];
  }

  return (raw as unknown[]).filter(Array.isArray) as MapCoordinate[][];
}

export function serializeZonePolygons(polygons: MapCoordinate[][]): MapCoordinate[][] {
  return polygons.filter((polygon) => polygon.length >= 3);
}
