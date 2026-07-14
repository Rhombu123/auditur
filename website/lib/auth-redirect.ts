import {
  type AccountType,
  type PendingSignupProfile,
  consumePendingSignupProfile,
  registerAccount,
  storePendingSignupProfile,
} from "@/lib/account-ids";

const PENDING_NAME_KEY = "auditur_pending_full_name";
const RETURN_TO_KEY = "auditur_auth_return_to";
const DEFAULT_RETURN_TO = "/dashboard/";

export function getAuthSiteOrigin(): string {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://auditur-ruby.vercel.app";
}

/** Only allow same-site relative paths (blocks open redirects). */
export function sanitizeReturnTo(path: string | null | undefined): string {
  if (!path) return DEFAULT_RETURN_TO;
  const trimmed = path.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return DEFAULT_RETURN_TO;
  if (trimmed.includes("://")) return DEFAULT_RETURN_TO;

  const pathOnly = trimmed.split(/[?#]/)[0] ?? trimmed;
  if (
    pathOnly.startsWith("/login") ||
    pathOnly.startsWith("/signup") ||
    pathOnly.startsWith("/auth/")
  ) {
    return DEFAULT_RETURN_TO;
  }

  if (trimmed.includes("?") || trimmed.includes("#")) {
    return trimmed;
  }

  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

export function storeReturnTo(path: string): void {
  localStorage.setItem(RETURN_TO_KEY, sanitizeReturnTo(path));
}

export function consumeReturnTo(): string {
  const stored = localStorage.getItem(RETURN_TO_KEY);
  localStorage.removeItem(RETURN_TO_KEY);
  return sanitizeReturnTo(stored);
}

/** Magic-link landing URL; includes `next` so verify can restore the prior page. */
export function getMagicLinkRedirectTo(returnTo?: string): string {
  const next = sanitizeReturnTo(returnTo);
  storeReturnTo(next);
  const url = new URL(`${getAuthSiteOrigin()}/auth/confirm/`);
  url.searchParams.set("next", next);
  return url.toString();
}

export function storePendingFullName(fullName: string): void {
  const trimmed = fullName.trim();
  if (!trimmed) return;
  localStorage.setItem(PENDING_NAME_KEY, trimmed);
}

export function storePendingSignup(input: {
  fullName: string;
  accountType: AccountType;
}): void {
  storePendingFullName(input.fullName);
  storePendingSignupProfile({
    fullName: input.fullName.trim(),
    accountType: input.accountType,
  });
}

export async function applyPendingFullName(
  updateUser: (fullName: string) => Promise<void>,
): Promise<void> {
  const pending = localStorage.getItem(PENDING_NAME_KEY);
  if (!pending?.trim()) return;
  localStorage.removeItem(PENDING_NAME_KEY);
  await updateUser(pending.trim());
}

/** Applies pending signup profile, allocates a unique 9-digit Auditur ID, and writes user metadata. */
export async function applyPendingSignup(input: {
  email: string;
  updateUser: (data: {
    full_name: string;
    account_type: AccountType;
    auditur_id: string;
  }) => Promise<void>;
}): Promise<void> {
  const profile: PendingSignupProfile | null = consumePendingSignupProfile();
  const legacyName = localStorage.getItem(PENDING_NAME_KEY)?.trim() ?? "";
  localStorage.removeItem(PENDING_NAME_KEY);

  const fullName = profile?.fullName?.trim() || legacyName;
  const accountType = profile?.accountType ?? "employee";
  if (!fullName) return;

  const record = registerAccount({
    fullName,
    email: input.email,
    accountType,
  });

  await input.updateUser({
    full_name: record.fullName,
    account_type: record.accountType,
    auditur_id: record.auditurId,
  });
}
