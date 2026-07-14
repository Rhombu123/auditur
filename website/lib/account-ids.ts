const DIRECTORY_KEY = "auditur.accountDirectory.v1";
const USED_IDS_KEY = "auditur.usedAccountIds.v1";
const PENDING_PROFILE_KEY = "auditur_pending_signup_profile";
const SELF_PROFILE_KEY = "auditur.selfProfile.v1";

export type AccountType = "owner_gm" | "employee";

export type AccountRecord = {
  auditurId: string;
  fullName: string;
  email: string;
  accountType: AccountType;
  dealershipName?: string;
  createdAt: string;
};

export type PendingSignupProfile = {
  fullName: string;
  accountType: AccountType;
};

function readUsedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(USED_IDS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeUsedIds(ids: Set<string>) {
  window.localStorage.setItem(USED_IDS_KEY, JSON.stringify([...ids]));
}

function readDirectory(): Record<string, AccountRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DIRECTORY_KEY);
    return raw ? (JSON.parse(raw) as Record<string, AccountRecord>) : {};
  } catch {
    return {};
  }
}

function writeDirectory(dir: Record<string, AccountRecord>) {
  window.localStorage.setItem(DIRECTORY_KEY, JSON.stringify(dir));
}

/** Random 9-digit ID (no leading zero). Retries until unique. */
export function generateUniqueAccountId(): string {
  const used = readUsedIds();
  for (let attempt = 0; attempt < 80; attempt++) {
    const n = Math.floor(100_000_000 + Math.random() * 900_000_000);
    const id = String(n);
    if (!used.has(id)) {
      used.add(id);
      writeUsedIds(used);
      return id;
    }
  }
  throw new Error("Could not allocate a unique Auditur ID. Try again.");
}

export function storePendingSignupProfile(profile: PendingSignupProfile): void {
  window.localStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify(profile));
}

export function consumePendingSignupProfile(): PendingSignupProfile | null {
  const raw = localStorage.getItem(PENDING_PROFILE_KEY);
  localStorage.removeItem(PENDING_PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingSignupProfile;
  } catch {
    return null;
  }
}

export function registerAccount(input: {
  fullName: string;
  email: string;
  accountType: AccountType;
  auditurId?: string;
  dealershipName?: string;
}): AccountRecord {
  const email = input.email.trim().toLowerCase();
  const dir = readDirectory();
  const existing = Object.values(dir).find((row) => row.email === email);
  if (existing) {
    if (input.auditurId && input.auditurId !== existing.auditurId) {
      delete dir[existing.auditurId];
      existing.auditurId = input.auditurId;
    }
    existing.fullName = input.fullName.trim() || existing.fullName;
    existing.accountType = input.accountType;
    existing.dealershipName = input.dealershipName?.trim() || existing.dealershipName;
    dir[existing.auditurId] = existing;
    writeDirectory(dir);
    saveSelfProfile(existing);
    return existing;
  }

  const auditurId = input.auditurId ?? generateUniqueAccountId();
  if (input.auditurId) {
    const used = readUsedIds();
    if (!used.has(auditurId)) {
      used.add(auditurId);
      writeUsedIds(used);
    }
  }
  const record: AccountRecord = {
    auditurId,
    fullName: input.fullName.trim() || email.split("@")[0] || "Member",
    email,
    accountType: input.accountType,
    dealershipName: input.dealershipName?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };
  dir[auditurId] = record;
  writeDirectory(dir);
  saveSelfProfile(record);
  return record;
}

export function lookupAccountById(auditurId: string): AccountRecord | null {
  const id = auditurId.trim();
  if (!/^\d{9}$/.test(id)) return null;
  return readDirectory()[id] ?? null;
}

export function saveSelfProfile(record: AccountRecord): void {
  window.localStorage.setItem(SELF_PROFILE_KEY, JSON.stringify(record));
}

export function updateSelfProfile(input: {
  fullName: string;
  dealershipName?: string;
}): AccountRecord | null {
  const current = loadSelfProfile();
  if (!current) return null;
  const next: AccountRecord = {
    ...current,
    fullName: input.fullName.trim() || current.fullName,
    dealershipName: input.dealershipName?.trim() || undefined,
  };
  const directory = readDirectory();
  directory[next.auditurId] = next;
  writeDirectory(directory);
  saveSelfProfile(next);
  return next;
}

export function loadSelfProfile(): AccountRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SELF_PROFILE_KEY);
    return raw ? (JSON.parse(raw) as AccountRecord) : null;
  } catch {
    return null;
  }
}

export function ensureAdminAccount(): AccountRecord {
  return registerAccount({
    fullName: "Admin",
    email: "admin@auditur.app",
    accountType: "owner_gm",
  });
}

/** Combinations of length-9 IDs using distinct digits from 0–9 (order matters). */
export const ACCOUNT_ID_DISTINCT_PERMUTATIONS = 3_628_800;
