const ADMIN_BYPASS_KEY = "auditur_admin_bypass";

/** Demo / owner access — opens dashboard without magic-link auth. */
export const ADMIN_EMAIL = "admin@auditur.app";

/**
 * Client-visible unlock key for /auth/admin/?key=…
 * Change via NEXT_PUBLIC_ADMIN_ACCESS_KEY on Vercel if you want to rotate it.
 */
export const ADMIN_ACCESS_KEY =
  process.env.NEXT_PUBLIC_ADMIN_ACCESS_KEY?.trim() || "auditur-lot-admin";

export function isAdminBypassActive(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ADMIN_BYPASS_KEY) === "1";
}

export function enableAdminBypass(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ADMIN_BYPASS_KEY, "1");
}

export function clearAdminBypass(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ADMIN_BYPASS_KEY);
}

export function adminAccessKeyMatches(candidate: string | null | undefined): boolean {
  if (!candidate) return false;
  return candidate.trim() === ADMIN_ACCESS_KEY;
}
