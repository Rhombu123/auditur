import { supabase } from "@/lib/supabase-browser";
import { requireApiDealershipId } from "@/lib/active-dealership";

const recoveryApiUrl =
  process.env.NEXT_PUBLIC_MFA_RECOVERY_API_URL ?? "/api/mfa-recovery";

async function headers(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error("Sign in again to continue.");
  return {
    Authorization: `Bearer ${data.session.access_token}`,
    "Content-Type": "application/json",
  };
}

export async function generateMfaRecoveryCodes(): Promise<string[]> {
  const response = await fetch(recoveryApiUrl, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify({ action: "generate" }),
  });
  const body = (await response.json()) as { codes?: string[]; error?: string };
  if (!response.ok || !body.codes) {
    throw new Error(body.error ?? "Could not generate recovery codes.");
  }
  return body.codes;
}

export async function recoverMfaWithCode(code: string): Promise<void> {
  const response = await fetch(recoveryApiUrl, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify({ action: "recover", code }),
  });
  const body = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Could not recover MFA.");
}

export async function adminResetMemberMfa(targetUserId: string): Promise<void> {
  const response = await fetch(recoveryApiUrl, {
    method: "POST",
    headers: {
      ...(await headers()),
      "X-Auditur-Dealership-ID": requireApiDealershipId(),
    },
    body: JSON.stringify({ action: "admin-reset", targetUserId }),
  });
  const body = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Could not reset member MFA.");
}
