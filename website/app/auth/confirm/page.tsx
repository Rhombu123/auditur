"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthLoading, AuthShell } from "@/components/auth/AuthShell";
import "@/components/auth/auth.css";
import { applyPendingFullName } from "@/lib/auth-redirect";
import { markWebSessionStarted } from "@/lib/auth-session";
import { formatAuthError } from "@/lib/email-auth";
import { assertSupabaseConfigured, supabase } from "@/lib/supabase-browser";

export default function AuthConfirmPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function finishAuth() {
      try {
        assertSupabaseConfigured();

        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const tokenHash = params.get("token_hash");
        const type = params.get("type") ?? "email";

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else if (tokenHash) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as "email" | "signup" | "magiclink" | "invite" | "recovery",
          });
          if (verifyError) throw verifyError;
        } else {
          // Implicit/hash redirect — session may already be in the URL fragment.
          const { data, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          if (!data.session) {
            throw new Error(
              "Missing sign-in confirmation. Open the Confirm link from your email again.",
            );
          }
        }

        await applyPendingFullName(async (fullName) => {
          await supabase.auth.updateUser({ data: { full_name: fullName } });
        });

        markWebSessionStarted();
        router.replace("/dashboard/");
      } catch (confirmError) {
        setError(
          formatAuthError(
            confirmError,
            confirmError instanceof Error
              ? confirmError.message
              : "Could not confirm sign-in.",
          ),
        );
      }
    }

    void finishAuth();
  }, [router]);

  if (error) {
    return (
      <AuthShell
        title="Could not confirm"
        subtitle={error}
        footer={
          <>
            <Link href="/login/">Back to sign in</Link>
          </>
        }
      >
        <Link href="/login/" className="auth-btn">
          Try again
        </Link>
      </AuthShell>
    );
  }

  return <AuthLoading />;
}
