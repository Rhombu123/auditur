import type { SupportedStorage } from "@supabase/supabase-js";

const memory = new Map<string, string>();

const memoryStorage: SupportedStorage = {
  getItem: async (key) => memory.get(key) ?? null,
  setItem: async (key, value) => {
    memory.set(key, value);
  },
  removeItem: async (key) => {
    memory.delete(key);
  },
};

function tryNativeAsyncStorage(): SupportedStorage | null {
  try {
    // Dynamic require avoids crashing at import time when the native
    // module is not linked yet (needs `npx expo run:ios` after install).
    const module = require("@react-native-async-storage/async-storage") as {
      default?: SupportedStorage;
    };
    const storage = module.default;
    if (storage) {
      return storage;
    }
  } catch {
    // Native module not in this build — use in-memory fallback.
  }
  return null;
}

const nativeStorage = tryNativeAsyncStorage();

/** Persists auth sessions when AsyncStorage is linked; otherwise in-memory only. */
export const authStorage: SupportedStorage = nativeStorage ?? memoryStorage;

export const authStorageUsesMemory = nativeStorage === null;
