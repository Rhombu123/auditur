import type { MapPoint } from "@/lib/zone-curves";

/** Convert a continuous brush path into the same closed polygon used by the web map. */
export function brushStrokeToPolygon(
  points: MapPoint[],
  widthMeters = 10,
): MapPoint[] {
  if (points.length === 0) return [];
  if (points.length === 1) {
    const point = points[0];
    const halfLatitude = widthMeters / 111_320 / 2;
    const halfLongitude =
      widthMeters /
      (111_320 * Math.cos((point.latitude * Math.PI) / 180)) /
      2;
    return [
      {
        latitude: point.latitude - halfLatitude,
        longitude: point.longitude - halfLongitude,
      },
      {
        latitude: point.latitude - halfLatitude,
        longitude: point.longitude + halfLongitude,
      },
      {
        latitude: point.latitude + halfLatitude,
        longitude: point.longitude + halfLongitude,
      },
      {
        latitude: point.latitude + halfLatitude,
        longitude: point.longitude - halfLongitude,
      },
    ];
  }

  const halfWidth = widthMeters / 2;
  const left: MapPoint[] = [];
  const right: MapPoint[] = [];

  for (let index = 0; index < points.length; index++) {
    const previous = points[Math.max(0, index - 1)];
    const current = points[index];
    const next = points[Math.min(points.length - 1, index + 1)];
    const deltaLongitude = next.longitude - previous.longitude;
    const deltaLatitude = next.latitude - previous.latitude;
    const length = Math.hypot(deltaLongitude, deltaLatitude) || 1;
    const perpendicularLongitude = -deltaLatitude / length;
    const perpendicularLatitude = deltaLongitude / length;
    const metersPerDegreeLongitude =
      111_320 * Math.cos((current.latitude * Math.PI) / 180);
    const latitudeOffset = (perpendicularLatitude * halfWidth) / 111_320;
    const longitudeOffset =
      (perpendicularLongitude * halfWidth) / metersPerDegreeLongitude;

    left.push({
      latitude: current.latitude + latitudeOffset,
      longitude: current.longitude + longitudeOffset,
    });
    right.push({
      latitude: current.latitude - latitudeOffset,
      longitude: current.longitude - longitudeOffset,
    });
  }

  return [...left, ...right.reverse()];
}
