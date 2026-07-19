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

type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type ViewportVehicleCluster<T> = {
  key: string;
  coordinate: { latitude: number; longitude: number };
  vehicles: T[];
};

export function isValidMapCoordinate(point: {
  latitude: number;
  longitude: number;
}): boolean {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    point.longitude >= -180 &&
    point.longitude <= 180 &&
    !(point.latitude === 0 && point.longitude === 0)
  );
}

/**
 * Groups markers by their rendered screen distance, so pins that would overlap
 * collapse into one marker at wider zoom levels and split apart as users zoom in.
 */
export function clusterVehiclesByViewport<
  T extends { id: string; latitude: number; longitude: number },
>(
  vehicles: T[],
  region: MapRegion,
  viewport: { width: number; height: number },
  thresholdPixels = 48,
): ViewportVehicleCluster<T>[] {
  if (vehicles.length === 0) return [];
  if (
    region.latitudeDelta <= 0 ||
    region.longitudeDelta <= 0 ||
    viewport.width <= 0 ||
    viewport.height <= 0
  ) {
    return vehicles.map((vehicle) => ({
      key: vehicle.id,
      coordinate: {
        latitude: vehicle.latitude,
        longitude: vehicle.longitude,
      },
      vehicles: [vehicle],
    }));
  }

  const grouped = new Map<string, T[]>();
  for (const vehicle of vehicles) {
    if (!isValidMapCoordinate(vehicle)) continue;
    const x =
      ((vehicle.longitude - region.longitude) / region.longitudeDelta + 0.5) *
      viewport.width;
    const y =
      (0.5 - (vehicle.latitude - region.latitude) / region.latitudeDelta) *
      viewport.height;

    // Ignore far-offscreen points so they cannot pull a visible cluster centroid
    // into empty map space. One cell of padding keeps edge markers stable.
    if (
      x < -thresholdPixels ||
      x > viewport.width + thresholdPixels ||
      y < -thresholdPixels ||
      y > viewport.height + thresholdPixels
    ) {
      continue;
    }

    const cellKey = `${Math.floor(x / thresholdPixels)}:${Math.floor(
      y / thresholdPixels,
    )}`;
    grouped.set(cellKey, [...(grouped.get(cellKey) ?? []), vehicle]);
  }

  return Array.from(grouped.values()).map((group) => ({
    key: `cluster:${group
      .map((vehicle) => vehicle.id)
      .sort()
      .join(",")}`,
    coordinate: {
      latitude:
        group.reduce((sum, vehicle) => sum + vehicle.latitude, 0) / group.length,
      longitude:
        group.reduce((sum, vehicle) => sum + vehicle.longitude, 0) / group.length,
    },
    vehicles: group,
  }));
}
