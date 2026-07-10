export type MapPoint = { latitude: number; longitude: number };

function catmullRom(
  p0: MapPoint,
  p1: MapPoint,
  p2: MapPoint,
  p3: MapPoint,
  t: number,
): MapPoint {
  const t2 = t * t;
  const t3 = t2 * t;

  const lat =
    0.5 *
    (2 * p1.latitude +
      (-p0.latitude + p2.latitude) * t +
      (2 * p0.latitude - 5 * p1.latitude + 4 * p2.latitude - p3.latitude) * t2 +
      (-p0.latitude + 3 * p1.latitude - 3 * p2.latitude + p3.latitude) * t3);

  const lng =
    0.5 *
    (2 * p1.longitude +
      (-p0.longitude + p2.longitude) * t +
      (2 * p0.longitude - 5 * p1.longitude + 4 * p2.longitude - p3.longitude) * t2 +
      (-p0.longitude + 3 * p1.longitude - 3 * p2.longitude + p3.longitude) * t3);

  return { latitude: lat, longitude: lng };
}

/** Smooth closed loop through control points (corners + bend handles). */
export function tessellateClosedCurve(
  controlPoints: MapPoint[],
  samplesPerSegment = 12,
): MapPoint[] {
  if (controlPoints.length < 3) return controlPoints;

  const n = controlPoints.length;
  const result: MapPoint[] = [];

  for (let i = 0; i < n; i++) {
    const p0 = controlPoints[(i - 1 + n) % n];
    const p1 = controlPoints[i];
    const p2 = controlPoints[(i + 1) % n];
    const p3 = controlPoints[(i + 2) % n];

    for (let s = 0; s < samplesPerSegment; s++) {
      result.push(catmullRom(p0, p1, p2, p3, s / samplesPerSegment));
    }
  }

  return result;
}

function projectPointToSegment(
  point: MapPoint,
  a: MapPoint,
  b: MapPoint,
): MapPoint {
  const abLat = b.latitude - a.latitude;
  const abLng = b.longitude - a.longitude;
  const abLen2 = abLat * abLat + abLng * abLng;
  if (abLen2 < Number.EPSILON) return { ...a };

  let t =
    ((point.latitude - a.latitude) * abLat + (point.longitude - a.longitude) * abLng) /
    abLen2;
  t = Math.max(0, Math.min(1, t));

  return {
    latitude: a.latitude + abLat * t,
    longitude: a.longitude + abLng * t,
  };
}

function distanceSquared(a: MapPoint, b: MapPoint): number {
  const dLat = a.latitude - b.latitude;
  const dLng = a.longitude - b.longitude;
  return dLat * dLat + dLng * dLng;
}

/** Insert a bend handle on the nearest edge of the polygon. */
export function insertPointOnNearestEdge(
  points: MapPoint[],
  tap: MapPoint,
): MapPoint[] {
  if (points.length < 2) return [...points, tap];

  let bestIndex = 0;
  let bestPoint = tap;
  let bestDist = Infinity;

  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const proj = projectPointToSegment(tap, a, b);
    const dist = distanceSquared(tap, proj);
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
      bestPoint = proj;
    }
  }

  const next = [...points];
  next.splice(bestIndex + 1, 0, bestPoint);
  return next;
}

export function renderZonePolygon(
  controlPoints: MapPoint[],
): MapPoint[] {
  if (controlPoints.length < 3) return controlPoints;
  return tessellateClosedCurve(controlPoints);
}

/** Build a 4-corner lot section from opposite diagonal taps. */
export function rectangleFromOppositeCorners(
  a: MapPoint,
  b: MapPoint,
): MapPoint[] {
  return [
    { latitude: a.latitude, longitude: a.longitude },
    { latitude: a.latitude, longitude: b.longitude },
    { latitude: b.latitude, longitude: b.longitude },
    { latitude: b.latitude, longitude: a.longitude },
  ];
}
