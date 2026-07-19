import type { SupportedStorage } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

const memory = new Map<string, string>();
const CHUNK_SIZE = 1800;

function secureKey(key: string): string {
  return `auditur.auth.${key.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
}

async function removeSecureValue(key: string): Promise<void> {
  const base = secureKey(key);
  const rawCount = await SecureStore.getItemAsync(`${base}.chunks`);
  const count = Number(rawCount ?? 0);
  for (let index = 0; index < count; index += 1) {
    await SecureStore.deleteItemAsync(`${base}.${index}`);
  }
  await SecureStore.deleteItemAsync(`${base}.chunks`);
}

const secureStorage: SupportedStorage = {
  getItem: async (key) => {
    if (!(await SecureStore.isAvailableAsync())) return memory.get(key) ?? null;
    const base = secureKey(key);
    const count = Number(await SecureStore.getItemAsync(`${base}.chunks`));
    if (!Number.isInteger(count) || count <= 0) return null;
    const chunks = await Promise.all(
      Array.from({ length: count }, (_, index) =>
        SecureStore.getItemAsync(`${base}.${index}`),
      ),
    );
    return chunks.every((chunk) => chunk !== null) ? chunks.join("") : null;
  },
  setItem: async (key, value) => {
    if (!(await SecureStore.isAvailableAsync())) {
      memory.set(key, value);
      return;
    }
    await removeSecureValue(key);
    const chunks = Array.from(
      { length: Math.ceil(value.length / CHUNK_SIZE) },
      (_, index) => value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
    );
    const options = {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    };
    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(`${secureKey(key)}.${index}`, chunk, options),
      ),
    );
    await SecureStore.setItemAsync(
      `${secureKey(key)}.chunks`,
      String(chunks.length),
      options,
    );
  },
  removeItem: async (key) => {
    memory.delete(key);
    if (await SecureStore.isAvailableAsync()) await removeSecureValue(key);
  },
};

/** Stores Supabase sessions in Keychain/Keystore, with memory-only fallback. */
export const authStorage: SupportedStorage = secureStorage;

export const authStorageUsesMemory = false;
