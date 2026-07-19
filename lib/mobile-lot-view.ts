import { getApiDealershipId } from "@/lib/active-dealership";

const lotViews = new Map<string, MobileLotView>();

function storageKey(): string | null {
  const dealershipId = getApiDealershipId();
  return dealershipId;
}

export type MobileLotView = {
  center: { latitude: number; longitude: number };
  heading: number;
  pitch: number;
  zoom: number;
  altitude?: number;
};

export async function loadMobileLotView(): Promise<MobileLotView | null> {
  const key = storageKey();
  if (!key) return null;
  return lotViews.get(key) ?? null;
}

export async function saveMobileLotView(view: MobileLotView): Promise<void> {
  const key = storageKey();
  if (!key) return;
  lotViews.set(key, view);
}

export function removeMobileLotView(): void {
  const key = storageKey();
  if (!key) return;
  lotViews.delete(key);
}

export function clearMobileLotViews(): void {
  lotViews.clear();
}
