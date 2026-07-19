/** Shared selection of which price-list upload drives the dashboard/audit. */

const STORAGE_KEY = "auditur.selectedUploadId.v2";

export function loadSelectedUploadId(dealershipId: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(`${STORAGE_KEY}:${dealershipId}`);
}

export function saveSelectedUploadId(dealershipId: string, id: string | null): void {
  if (typeof window === "undefined") return;
  const key = `${STORAGE_KEY}:${dealershipId}`;
  if (!id) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, id);
}
