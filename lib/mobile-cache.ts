import { getApiDealershipId } from "@/lib/active-dealership";

const DEFAULT_MAX_AGE_MS = 12 * 60 * 60 * 1000;

type CacheEntry<T> = {
  savedAt: number;
  value: T;
};

const memoryCache = new Map<string, CacheEntry<unknown>>();

function memoryKey(key: string): string | null {
  const dealershipId = getApiDealershipId();
  return dealershipId ? `${dealershipId}:${key}` : null;
}

export async function readMobileCache<T>(
  key: string,
  maxAgeMs = DEFAULT_MAX_AGE_MS,
): Promise<T | null> {
  const memoryCacheKey = memoryKey(key);
  if (!memoryCacheKey) return null;
  const inMemory = memoryCache.get(memoryCacheKey) as CacheEntry<T> | undefined;
  if (inMemory && Date.now() - inMemory.savedAt <= maxAgeMs) {
    return inMemory.value;
  }
  memoryCache.delete(memoryCacheKey);
  return null;
}

export async function writeMobileCache<T>(key: string, value: T): Promise<void> {
  const memoryCacheKey = memoryKey(key);
  if (!memoryCacheKey) return;
  const entry: CacheEntry<T> = { savedAt: Date.now(), value };
  memoryCache.set(memoryCacheKey, entry);
}

export async function clearMobileCache(key: string): Promise<void> {
  const memoryCacheKey = memoryKey(key);
  if (!memoryCacheKey) return;
  memoryCache.delete(memoryCacheKey);
}

export function clearAllMobileCache(): void {
  memoryCache.clear();
}

export const MOBILE_CACHE_KEYS = {
  audit: "audit-today",
  vehicles: "vehicles",
  zones: "lot-zones",
  inventory: "inventory",
  uploadHistory: "upload-history",
} as const;
