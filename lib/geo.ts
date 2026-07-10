function startOfLocalDay(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isScannedToday(scannedAt: string, now = new Date()): boolean {
  const scanned = new Date(scannedAt);
  return scanned >= startOfLocalDay(now);
}

/** Ray-casting point-in-polygon test. */
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
      if (pointInPolygon(point, polygon)) {
        return zone.id;
      }
    }
  }
  return null;
}

export function locationKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
}

export function groupVehiclesByLocation<T extends { latitude: number; longitude: number }>(
  vehicles: T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const vehicle of vehicles) {
    const key = locationKey(vehicle.latitude, vehicle.longitude);
    const group = groups.get(key) ?? [];
    group.push(vehicle);
    groups.set(key, group);
  }
  return groups;
}

export function findCoLocatedVehicles<T extends { id: string; latitude: number; longitude: number }>(
  vehicles: T[],
  target: T,
): T[] {
  const key = locationKey(target.latitude, target.longitude);
  return vehicles.filter(
    (v) => locationKey(v.latitude, v.longitude) === key,
  );
}
