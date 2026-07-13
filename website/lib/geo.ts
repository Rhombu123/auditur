export function pointInPolygon(
  point: { latitude: number; longitude: number },
  polygon: { latitude: number; longitude: number }[],
): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].longitude;
    const yi = polygon[i].latitude;
    const xj = polygon[j].longitude;
    const yj = polygon[j].latitude;
    const intersects =
      yi > point.latitude !== yj > point.latitude &&
      point.longitude <
        ((xj - xi) * (point.latitude - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function findZoneForPoint(
  point: { latitude: number; longitude: number },
  zones: { id: string; polygons: { latitude: number; longitude: number }[][] }[],
): string | null {
  for (const zone of zones) {
    for (const polygon of zone.polygons) {
      if (pointInPolygon(point, polygon)) return zone.id;
    }
  }
  return null;
}

function isScannedToday(scannedAt: string): boolean {
  const scanned = new Date(scannedAt);
  const now = new Date();
  return (
    scanned.getFullYear() === now.getFullYear() &&
    scanned.getMonth() === now.getMonth() &&
    scanned.getDate() === now.getDate()
  );
}

export { isScannedToday };
