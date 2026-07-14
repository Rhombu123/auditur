type Point = { latitude: number; longitude: number };

/** Convert a brush stroke into a closed polygon with approximate meter width. */
export function brushStrokeToPolygon(points: Point[], widthMeters = 10): Point[] {
  if (points.length === 0) return [];
  if (points.length === 1) {
    const p = points[0];
    const dLat = widthMeters / 111_320 / 2;
    const dLng = widthMeters / (111_320 * Math.cos((p.latitude * Math.PI) / 180)) / 2;
    return [
      { latitude: p.latitude - dLat, longitude: p.longitude - dLng },
      { latitude: p.latitude - dLat, longitude: p.longitude + dLng },
      { latitude: p.latitude + dLat, longitude: p.longitude + dLng },
      { latitude: p.latitude + dLat, longitude: p.longitude - dLng },
    ];
  }

  const half = widthMeters / 2;
  const left: Point[] = [];
  const right: Point[] = [];

  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)];
    const curr = points[i];
    const next = points[Math.min(points.length - 1, i + 1)];
    const dx = next.longitude - prev.longitude;
    const dy = next.latitude - prev.latitude;
    const len = Math.hypot(dx, dy) || 1;
    const ux = -dy / len;
    const uy = dx / len;
    const metersPerDegLat = 111_320;
    const metersPerDegLng = 111_320 * Math.cos((curr.latitude * Math.PI) / 180);
    const oLat = (uy * half) / metersPerDegLat;
    const oLng = (ux * half) / metersPerDegLng;
    left.push({ latitude: curr.latitude + oLat, longitude: curr.longitude + oLng });
    right.push({ latitude: curr.latitude - oLat, longitude: curr.longitude - oLng });
  }

  return [...left, ...right.reverse()];
}
