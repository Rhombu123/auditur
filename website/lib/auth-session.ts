const SESSION_EXPIRES_KEY = "auditur_dashboard_session_expires";
const SESSION_ACTIVITY_KEY = "auditur_dashboard_session_activity";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const SESSION_IDLE_MS = 30 * 60 * 1000;

export function markWebSessionStarted(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_EXPIRES_KEY, String(Date.now() + SESSION_DURATION_MS));
  sessionStorage.setItem(SESSION_ACTIVITY_KEY, String(Date.now()));
}

export function clearWebSessionMarker(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_EXPIRES_KEY);
  sessionStorage.removeItem(SESSION_ACTIVITY_KEY);
}

export function getWebSessionExpiresAt(): number | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(SESSION_EXPIRES_KEY);
  if (!raw) return null;
  const expires = Number(raw);
  return Number.isFinite(expires) ? expires : null;
}

export function isWebSessionValid(): boolean {
  const expires = getWebSessionExpiresAt();
  const lastActivity = Number(sessionStorage.getItem(SESSION_ACTIVITY_KEY) ?? 0);
  if (!expires || !Number.isFinite(lastActivity)) return false;
  return Date.now() < expires && Date.now() - lastActivity < SESSION_IDLE_MS;
}

export function touchWebSession(): void {
  if (typeof window === "undefined" || !getWebSessionExpiresAt()) return;
  sessionStorage.setItem(SESSION_ACTIVITY_KEY, String(Date.now()));
}

export function webSessionRemainingMs(): number {
  const expires = getWebSessionExpiresAt();
  if (!expires) return 0;
  return Math.max(0, expires - Date.now());
}

/** Existing Supabase sessions without a marker get a fresh eight-hour window. */
export function ensureWebSessionMarker(): void {
  if (typeof window === "undefined") return;
  if (!getWebSessionExpiresAt()) {
    markWebSessionStarted();
  }
}
