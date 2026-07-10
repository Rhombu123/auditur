import type { MapPoint } from "@/lib/zone-curves";

export type ZoneShapeKind = "rectangle" | "square" | "oval";

export type EditableShape = {
  kind: ZoneShapeKind;
  center: MapPoint;
  halfLat: number;
  halfLng: number;
};

export const DEFAULT_SHAPE_HALF_LAT = 0.00022;
export const DEFAULT_SHAPE_HALF_LNG = 0.00028;
export const HIGHLIGHT_RADIUS = 0.00008;

export function rectangleFromCenter(
  center: MapPoint,
  halfLat: number,
  halfLng: number,
): MapPoint[] {
  return [
    { latitude: center.latitude + halfLat, longitude: center.longitude - halfLng },
    { latitude: center.latitude + halfLat, longitude: center.longitude + halfLng },
    { latitude: center.latitude - halfLat, longitude: center.longitude + halfLng },
    { latitude: center.latitude - halfLat, longitude: center.longitude - halfLng },
  ];
}

export function ovalPolygon(
  center: MapPoint,
  halfLat: number,
  halfLng: number,
  segments = 36,
): MapPoint[] {
  const points: MapPoint[] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push({
      latitude: center.latitude + Math.sin(angle) * halfLat,
      longitude: center.longitude + Math.cos(angle) * halfLng,
    });
  }
  return points;
}

export function shapeToPolygon(shape: EditableShape): MapPoint[] {
  if (shape.kind === "oval") {
    return ovalPolygon(shape.center, shape.halfLat, shape.halfLng);
  }

  const halfLng = shape.kind === "square" ? shape.halfLat : shape.halfLng;
  return rectangleFromCenter(shape.center, shape.halfLat, halfLng);
}

export function createShapeAt(
  kind: ZoneShapeKind,
  center: MapPoint,
): EditableShape {
  const halfLat = DEFAULT_SHAPE_HALF_LAT;
  const halfLng =
    kind === "square" ? halfLat : kind === "oval" ? DEFAULT_SHAPE_HALF_LNG : DEFAULT_SHAPE_HALF_LNG;

  return { kind, center, halfLat, halfLng };
}

export function circlePolygon(center: MapPoint, radius: number, segments = 20): MapPoint[] {
  return ovalPolygon(center, radius, radius, segments);
}

export function polygonCenter(points: MapPoint[]): MapPoint {
  if (points.length === 0) return { latitude: 0, longitude: 0 };
  const sum = points.reduce(
    (acc, point) => ({
      latitude: acc.latitude + point.latitude,
      longitude: acc.longitude + point.longitude,
    }),
    { latitude: 0, longitude: 0 },
  );
  return {
    latitude: sum.latitude / points.length,
    longitude: sum.longitude / points.length,
  };
}

export function translatePolygon(points: MapPoint[], delta: MapPoint): MapPoint[] {
  return points.map((point) => ({
    latitude: point.latitude + delta.latitude,
    longitude: point.longitude + delta.longitude,
  }));
}

export function moveShapeCenter(shape: EditableShape, center: MapPoint): EditableShape {
  return { ...shape, center };
}

export function resizeShapeFromHandle(
  shape: EditableShape,
  handleIndex: number,
  position: MapPoint,
): EditableShape {
  const dLat = Math.max(Math.abs(position.latitude - shape.center.latitude), 0.00003);
  const dLng = Math.max(Math.abs(position.longitude - shape.center.longitude), 0.00003);

  if (shape.kind === "square") {
    const half = Math.max(dLat, dLng);
    return { ...shape, halfLat: half, halfLng: half };
  }

  if (shape.kind === "oval") {
    if (handleIndex === 0 || handleIndex === 2) {
      return { ...shape, halfLat: dLat };
    }
    return { ...shape, halfLng: dLng };
  }

  return { ...shape, halfLat: dLat, halfLng: dLng };
}

export function shapeHandlePositions(shape: EditableShape): MapPoint[] {
  const { center, halfLat, halfLng } = shape;

  if (shape.kind === "oval") {
    return [
      { latitude: center.latitude + halfLat, longitude: center.longitude },
      { latitude: center.latitude, longitude: center.longitude + halfLng },
      { latitude: center.latitude - halfLat, longitude: center.longitude },
      { latitude: center.latitude, longitude: center.longitude - halfLng },
    ];
  }

  const lng = shape.kind === "square" ? halfLat : halfLng;
  return [
    { latitude: center.latitude + halfLat, longitude: center.longitude - lng },
    { latitude: center.latitude + halfLat, longitude: center.longitude + lng },
    { latitude: center.latitude - halfLat, longitude: center.longitude + lng },
    { latitude: center.latitude - halfLat, longitude: center.longitude - lng },
  ];
}

function distanceSquared(a: MapPoint, b: MapPoint): number {
  const dLat = a.latitude - b.latitude;
  const dLng = a.longitude - b.longitude;
  return dLat * dLat + dLng * dLng;
}

export function findNearestPolygonIndex(
  tap: MapPoint,
  polygons: MapPoint[][],
): number {
  let bestIndex = -1;
  let bestDist = Infinity;

  polygons.forEach((polygon, index) => {
    const dist = distanceSquared(tap, polygonCenter(polygon));
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = index;
    }
  });

  return bestIndex;
}
