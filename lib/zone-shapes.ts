import type { MapPoint } from "@/lib/zone-curves";

export type ZoneShapeKind = "rectangle" | "square" | "oval";

export type EditableShape = {
  kind: ZoneShapeKind;
  center: MapPoint;
  halfLat: number;
  halfLng: number;
  rotation: number;
};

export const DEFAULT_SHAPE_HALF_LAT = 0.00022;
export const DEFAULT_SHAPE_HALF_LNG = 0.00028;
export const HIGHLIGHT_RADIUS = 0.00008;

type LocalPoint = { x: number; y: number };

function metersPerLongitude(latitude: number): number {
  return 111_320 * Math.cos((latitude * Math.PI) / 180);
}

function toLocal(center: MapPoint, point: MapPoint): LocalPoint {
  return {
    x: (point.longitude - center.longitude) * metersPerLongitude(center.latitude),
    y: (point.latitude - center.latitude) * 111_320,
  };
}

function fromLocal(center: MapPoint, point: LocalPoint): MapPoint {
  return {
    latitude: center.latitude + point.y / 111_320,
    longitude:
      center.longitude + point.x / metersPerLongitude(center.latitude),
  };
}

function rotate(point: LocalPoint, radians: number): LocalPoint {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: point.x * cosine - point.y * sine,
    y: point.x * sine + point.y * cosine,
  };
}

function shapeHalfSizeMeters(shape: EditableShape): LocalPoint {
  const halfHeight = shape.halfLat * 111_320;
  const originalHalfWidth =
    shape.halfLng * metersPerLongitude(shape.center.latitude);
  return {
    x: shape.kind === "square" ? halfHeight : originalHalfWidth,
    y: halfHeight,
  };
}

function shapePoint(shape: EditableShape, localPoint: LocalPoint): MapPoint {
  return fromLocal(shape.center, rotate(localPoint, shape.rotation ?? 0));
}

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
  const halfSize = shapeHalfSizeMeters(shape);
  if (shape.kind === "oval") {
    const points: MapPoint[] = [];
    for (let index = 0; index < 36; index++) {
      const angle = (index / 36) * Math.PI * 2;
      points.push(
        shapePoint(shape, {
          x: Math.cos(angle) * halfSize.x,
          y: Math.sin(angle) * halfSize.y,
        }),
      );
    }
    return points;
  }

  return [
    shapePoint(shape, { x: -halfSize.x, y: halfSize.y }),
    shapePoint(shape, { x: halfSize.x, y: halfSize.y }),
    shapePoint(shape, { x: halfSize.x, y: -halfSize.y }),
    shapePoint(shape, { x: -halfSize.x, y: -halfSize.y }),
  ];
}

export function createShapeAt(
  kind: ZoneShapeKind,
  center: MapPoint,
): EditableShape {
  const halfLat = DEFAULT_SHAPE_HALF_LAT;
  const halfLng =
    kind === "square" ? halfLat : kind === "oval" ? DEFAULT_SHAPE_HALF_LNG : DEFAULT_SHAPE_HALF_LNG;

  return { kind, center, halfLat, halfLng, rotation: 0 };
}

export function editableShapeFromPolygon(points: MapPoint[]): EditableShape | null {
  if (points.length !== 4) return null;
  const center = polygonCenter(points);
  const firstEdge = toLocal(points[0], points[1]);
  const sideEdge = toLocal(points[0], points[3]);
  const width = Math.hypot(firstEdge.x, firstEdge.y);
  const height = Math.hypot(sideEdge.x, sideEdge.y);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 6 || height < 6) {
    return null;
  }

  const squareRatio = Math.min(width, height) / Math.max(width, height);
  const kind: ZoneShapeKind = squareRatio >= 0.92 ? "square" : "rectangle";
  const halfHeight = height / 2;
  const halfWidth = kind === "square" ? halfHeight : width / 2;
  return {
    kind,
    center,
    halfLat: halfHeight / 111_320,
    halfLng: halfWidth / metersPerLongitude(center.latitude),
    rotation: Math.atan2(firstEdge.y, firstEdge.x),
  };
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
  const halfSize = shapeHalfSizeMeters(shape);
  const dragged = rotate(toLocal(shape.center, position), -(shape.rotation ?? 0));
  const minimumHalfSize = 3;
  if (shape.kind === "oval") {
    const handles = [
      { x: 0, y: halfSize.y },
      { x: halfSize.x, y: 0 },
      { x: 0, y: -halfSize.y },
      { x: -halfSize.x, y: 0 },
    ];
    const fixed = handles[(handleIndex + 2) % 4];
    if (handleIndex === 0 || handleIndex === 2) {
      const direction = handleIndex === 0 ? 1 : -1;
      const draggedY =
        fixed.y +
        direction * Math.max(Math.abs(dragged.y - fixed.y), minimumHalfSize * 2);
      const centerOffset = { x: 0, y: (draggedY + fixed.y) / 2 };
      const center = shapePoint(shape, centerOffset);
      return {
        ...shape,
        center,
        halfLat:
          Math.abs(draggedY - fixed.y) / 2 / 111_320,
      };
    }
    const direction = handleIndex === 1 ? 1 : -1;
    const draggedX =
      fixed.x +
      direction * Math.max(Math.abs(dragged.x - fixed.x), minimumHalfSize * 2);
    const centerOffset = { x: (draggedX + fixed.x) / 2, y: 0 };
    const center = shapePoint(shape, centerOffset);
    return {
      ...shape,
      center,
      halfLng:
        Math.abs(draggedX - fixed.x) /
        2 /
        metersPerLongitude(center.latitude),
    };
  }

  const corners = [
    { x: -halfSize.x, y: halfSize.y },
    { x: halfSize.x, y: halfSize.y },
    { x: halfSize.x, y: -halfSize.y },
    { x: -halfSize.x, y: -halfSize.y },
  ];
  const fixed = corners[(handleIndex + 2) % 4];
  const xDirection = handleIndex === 0 || handleIndex === 3 ? -1 : 1;
  const yDirection = handleIndex === 0 || handleIndex === 1 ? 1 : -1;
  let width = Math.max(Math.abs(dragged.x - fixed.x), minimumHalfSize * 2);
  let height = Math.max(Math.abs(dragged.y - fixed.y), minimumHalfSize * 2);
  if (shape.kind === "square") {
    const size = Math.max(width, height);
    width = size;
    height = size;
  }
  const constrainedDragged = {
    x: fixed.x + xDirection * width,
    y: fixed.y + yDirection * height,
  };
  const centerOffset = {
    x: (constrainedDragged.x + fixed.x) / 2,
    y: (constrainedDragged.y + fixed.y) / 2,
  };
  const center = shapePoint(shape, centerOffset);
  return {
    ...shape,
    center,
    halfLat: height / 2 / 111_320,
    halfLng: width / 2 / metersPerLongitude(center.latitude),
  };
}

export function shapeHandlePositions(shape: EditableShape): MapPoint[] {
  const halfSize = shapeHalfSizeMeters(shape);
  if (shape.kind === "oval") {
    return [
      shapePoint(shape, { x: 0, y: halfSize.y }),
      shapePoint(shape, { x: halfSize.x, y: 0 }),
      shapePoint(shape, { x: 0, y: -halfSize.y }),
      shapePoint(shape, { x: -halfSize.x, y: 0 }),
    ];
  }

  return [
    shapePoint(shape, { x: -halfSize.x, y: halfSize.y }),
    shapePoint(shape, { x: halfSize.x, y: halfSize.y }),
    shapePoint(shape, { x: halfSize.x, y: -halfSize.y }),
    shapePoint(shape, { x: -halfSize.x, y: -halfSize.y }),
  ];
}

export function rotationHandlePosition(shape: EditableShape): MapPoint | null {
  const halfSize = shapeHalfSizeMeters(shape);
  return shapePoint(shape, { x: 0, y: halfSize.y + 24 });
}

export function rotationHandleConnector(
  shape: EditableShape,
): [MapPoint, MapPoint] | null {
  const handle = rotationHandlePosition(shape);
  if (!handle) return null;
  const halfSize = shapeHalfSizeMeters(shape);
  return [shapePoint(shape, { x: 0, y: halfSize.y }), handle];
}

export function rotateShapeToward(
  shape: EditableShape,
  position: MapPoint,
): EditableShape {
  const vector = toLocal(shape.center, position);
  return {
    ...shape,
    rotation: Math.atan2(-vector.x, vector.y),
  };
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
