const SESSION_EXPIRES_KEY = "auditur_dashboard_session_expires";
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

export function markWebSessionStarted(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_EXPIRES_KEY, String(Date.now() + SESSION_DURATION_MS));
}

export function clearWebSessionMarker(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_EXPIRES_KEY);
}

export function getWebSessionExpiresAt(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_EXPIRES_KEY);
  if (!raw) return null;
  const expires = Number(raw);
  return Number.isFinite(expires) ? expires : null;
}

export function isWebSessionValid(): boolean {
  const expires = getWebSessionExpiresAt();
  if (!expires) return false;
  return Date.now() < expires;
}

export function webSessionRemainingMs(): number {
  const expires = getWebSessionExpiresAt();
  if (!expires) return 0;
  return Math.max(0, expires - Date.now());
}

/** Existing Supabase sessions without a marker get a fresh 24h window on first visit. */
export function ensureWebSessionMarker(): void {
  if (typeof window === "undefined") return;
  if (!getWebSessionExpiresAt()) {
    markWebSessionStarted();
  }
}
