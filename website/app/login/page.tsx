"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { AuthLoading, AuthShell } from "@/components/auth/AuthShell";
import { EmailAuthForm } from "@/components/auth/EmailAuthForm";
import { useAuth } from "@/lib/auth-context";
import { sanitizeReturnTo } from "@/lib/auth-redirect";

function LoginContent() {
  const { session, loading, signInWithPassword, isAdminBypass } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = sanitizeReturnTo(searchParams.get("next"));

  useEffect(() => {
    if (!loading && (session || isAdminBypass)) {
      router.replace(returnTo);
    }
  }, [loading, session, isAdminBypass, router, returnTo]);

  if (loading) return <AuthLoading />;
  if (session || isAdminBypass) return null;

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in with your work email and password."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href={`/signup/?next=${encodeURIComponent(returnTo)}`}>Create one for free</Link>
        </>
      }
    >
      <EmailAuthForm
        mode="login"
        onSubmit={async (email, password) => {
          await signInWithPassword(email, password);
          router.replace(returnTo);
        }}
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
