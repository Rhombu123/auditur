const STORAGE_KEY = "auditur.lotMapView.v1";

export type LockedLotView = {
  latitude: number;
  longitude: number;
  zoom: number;
  bearing: number;
  pitch: number;
  south: number;
  west: number;
  north: number;
  east: number;
};

export function loadLockedLotView(): LockedLotView | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LockedLotView>;
    if (
      !Number.isFinite(parsed.latitude) ||
      !Number.isFinite(parsed.longitude) ||
      !Number.isFinite(parsed.zoom) ||
      !Number.isFinite(parsed.south) ||
      !Number.isFinite(parsed.west) ||
      !Number.isFinite(parsed.north) ||
      !Number.isFinite(parsed.east)
    ) {
      return null;
    }
    return {
      latitude: parsed.latitude as number,
      longitude: parsed.longitude as number,
      zoom: parsed.zoom as number,
      bearing: Number.isFinite(parsed.bearing) ? (parsed.bearing as number) : 0,
      pitch: Number.isFinite(parsed.pitch) ? (parsed.pitch as number) : 0,
      south: parsed.south as number,
      west: parsed.west as number,
      north: parsed.north as number,
      east: parsed.east as number,
    };
  } catch {
    return null;
  }
}

export function saveLockedLotView(view: LockedLotView): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(view));
}

export function clearLockedLotView(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

/** Tight pad so a locked lot stays on-lot; use 0.08–0.15 for hard lock. */
export function padLotBounds(
  view: Pick<LockedLotView, "south" | "west" | "north" | "east">,
  factor = 0.12,
): { south: number; west: number; north: number; east: number } {
  const latSpan = Math.max(view.north - view.south, 0.00035);
  const lngSpan = Math.max(view.east - view.west, 0.00035);
  const latPad = latSpan * factor;
  const lngPad = lngSpan * factor;
  return {
    south: view.south - latPad,
    west: view.west - lngPad,
    north: view.north + latPad,
    east: view.east + lngPad,
  };
}
