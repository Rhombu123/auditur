import { supabase } from "@/lib/supabase";

const deleteAccountApiUrl = (
  process.env.EXPO_PUBLIC_UPLOAD_API_URL ??
  "https://auditur.vercel.app/api/upload/"
).replace(/\/upload\/?$/, "/delete-account");

export async function deleteCurrentAccount(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in again to delete your account.");

  const response = await fetch(deleteAccountApiUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await response.json()) as { error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? "The account could not be deleted.");
  }
}
