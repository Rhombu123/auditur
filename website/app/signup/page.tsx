"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { AuthLoading, AuthShell } from "@/components/auth/AuthShell";
import { EmailAuthForm } from "@/components/auth/EmailAuthForm";
import { useAuth } from "@/lib/auth-context";
import { sanitizeReturnTo } from "@/lib/auth-redirect";

function SignupContent() {
  const { session, loading, signUpWithPassword, isAdminBypass } = useAuth();
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
      title="Create your account"
      subtitle="Choose your role and create an account with your work email and password."
      footer={
        <>
          Already registered?{" "}
          <Link href={`/login/?next=${encodeURIComponent(returnTo)}`}>Sign in</Link>
        </>
      }
    >
      <EmailAuthForm
        mode="signup"
        onSubmit={async (email, password, signup) => {
          if (!signup) throw new Error("Complete your account details.");
          await signUpWithPassword(email, password, signup);
          router.replace(returnTo);
        }}
      />
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<AuthLoading />}>
      <SignupContent />
    </Suspense>
  );
}
