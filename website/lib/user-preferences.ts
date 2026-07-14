const PREFERENCES_KEY = "auditur.userPreferences.v1";

export type UserPreferences = {
  requireGps: boolean;
  duplicateVinWarnings: boolean;
  scanConfirmation: boolean;
  notifications: boolean;
  timezone: string;
};

export function defaultUserPreferences(): UserPreferences {
  return {
    requireGps: true,
    duplicateVinWarnings: true,
    scanConfirmation: true,
    notifications: false,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  };
}

export function loadUserPreferences(): UserPreferences {
  const defaults = defaultUserPreferences();
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY);
    return raw ? { ...defaults, ...(JSON.parse(raw) as Partial<UserPreferences>) } : defaults;
  } catch {
    return defaults;
  }
}

export function saveUserPreferences(preferences: UserPreferences): void {
  window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
}

export function resetUserPreferences(): UserPreferences {
  const defaults = defaultUserPreferences();
  window.localStorage.removeItem(PREFERENCES_KEY);
  return defaults;
}
