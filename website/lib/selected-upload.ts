/** Shared selection of which price-list upload drives the dashboard/audit. */

const STORAGE_KEY = "auditur.selectedUploadId";

export function loadSelectedUploadId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function saveSelectedUploadId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (!id) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, id);
}
