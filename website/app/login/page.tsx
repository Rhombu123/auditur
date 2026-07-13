"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { AuthLoading, AuthShell } from "@/components/auth/AuthShell";
import { EmailAuthForm } from "@/components/auth/EmailAuthForm";
import { useAuth } from "@/lib/auth-context";
import { sanitizeReturnTo } from "@/lib/auth-redirect";

function LoginContent() {
  const { session, loading, sendSignInLink } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = sanitizeReturnTo(searchParams.get("next"));

  useEffect(() => {
    if (!loading && session) {
      router.replace(returnTo);
    }
  }, [loading, session, router, returnTo]);

  if (loading) return <AuthLoading />;
  if (session) return null;

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Enter your email and we'll send a magic link. Open it on this device to verify and return here — no password or code."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href={`/signup/?next=${encodeURIComponent(returnTo)}`}>Create one for free</Link>
        </>
      }
    >
      <EmailAuthForm
        mode="login"
        onSendLink={(email) => sendSignInLink(email, "login", { returnTo })}
      />
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthLoading />}>
      <LoginContent />
    </Suspense>
  );
}
