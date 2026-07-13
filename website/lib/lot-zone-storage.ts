export function parseZonePolygons(raw: unknown): { latitude: number; longitude: number }[][] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const first = raw[0];
  if (
    first &&
    typeof first === "object" &&
    "latitude" in first &&
    "longitude" in first
  ) {
    return [raw as { latitude: number; longitude: number }[]];
  }
  return (raw as unknown[]).filter(Array.isArray) as { latitude: number; longitude: number }[][];
}

export function serializeZonePolygons(
  polygons: { latitude: number; longitude: number }[][],
): { latitude: number; longitude: number }[][] {
  return polygons.filter((polygon) => polygon.length >= 3);
}

export function normalizeZoneName(name: string): string {
  return name.trim().toLowerCase();
}

