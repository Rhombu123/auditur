const ADMIN_BYPASS_KEY = "auditur_admin_bypass";

/** Local-only owner bypass — not a real Supabase user. */
export const ADMIN_EMAIL = "admin@auditur.app";

export function isLocalDevHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

export function isAdminEmail(email: string): boolean {
  return email.trim().toLowerCase() === ADMIN_EMAIL;
}

export function isAdminBypassActive(): boolean {
  if (!isLocalDevHost()) return false;
  return localStorage.getItem(ADMIN_BYPASS_KEY) === "1";
}

/** Enables dashboard access without Supabase. Returns false outside local hosts. */
export function enableAdminBypass(): boolean {
  if (!isLocalDevHost()) return false;
  localStorage.setItem(ADMIN_BYPASS_KEY, "1");
  return true;
}

export function clearAdminBypass(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ADMIN_BYPASS_KEY);
}
