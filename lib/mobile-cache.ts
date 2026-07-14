import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_PREFIX = "auditur.mobile-cache.v1";
const DEFAULT_MAX_AGE_MS = 12 * 60 * 60 * 1000;

type CacheEntry<T> = {
  savedAt: number;
  value: T;
};

const memoryCache = new Map<string, CacheEntry<unknown>>();

function storageKey(key: string): string {
  return `${CACHE_PREFIX}:${key}`;
}

export async function readMobileCache<T>(
  key: string,
  maxAgeMs = DEFAULT_MAX_AGE_MS,
): Promise<T | null> {
  const inMemory = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (inMemory && Date.now() - inMemory.savedAt <= maxAgeMs) {
    return inMemory.value;
  }

  try {
    const raw = await AsyncStorage.getItem(storageKey(key));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (
      !Number.isFinite(entry.savedAt) ||
      Date.now() - entry.savedAt > maxAgeMs
    ) {
      await AsyncStorage.removeItem(storageKey(key));
      memoryCache.delete(key);
      return null;
    }
    memoryCache.set(key, entry);
    return entry.value;
  } catch {
    return null;
  }
}

export async function writeMobileCache<T>(key: string, value: T): Promise<void> {
  const entry: CacheEntry<T> = { savedAt: Date.now(), value };
  memoryCache.set(key, entry);
  try {
    await AsyncStorage.setItem(storageKey(key), JSON.stringify(entry));
  } catch {
    // Memory cache still helps during this session if disk storage is unavailable.
  }
}

export async function clearMobileCache(key: string): Promise<void> {
  memoryCache.delete(key);
  try {
    await AsyncStorage.removeItem(storageKey(key));
  } catch {
    // Ignore storage cleanup failures.
  }
}

export const MOBILE_CACHE_KEYS = {
  audit: "audit-today",
  vehicles: "vehicles",
  zones: "lot-zones",
  inventory: "inventory",
  uploadHistory: "upload-history",
} as const;
