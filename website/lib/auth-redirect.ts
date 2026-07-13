const PENDING_NAME_KEY = "auditur_pending_full_name";

export function getAuthSiteOrigin(): string {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://auditur-ruby.vercel.app";
}

/** Where Supabase should send the user after they click Confirm in email. */
export function getEmailConfirmRedirectTo(): string {
  return `${getAuthSiteOrigin()}/auth/confirm/`;
}

export function storePendingFullName(fullName: string): void {
  const trimmed = fullName.trim();
  if (!trimmed) return;
  localStorage.setItem(PENDING_NAME_KEY, trimmed);
}

export async function applyPendingFullName(
  updateUser: (fullName: string) => Promise<void>,
): Promise<void> {
  const pending = localStorage.getItem(PENDING_NAME_KEY);
  if (!pending?.trim()) return;
  localStorage.removeItem(PENDING_NAME_KEY);
  await updateUser(pending.trim());
}
