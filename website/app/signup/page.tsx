"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { AuthLoading, AuthShell } from "@/components/auth/AuthShell";
import { EmailAuthForm } from "@/components/auth/EmailAuthForm";
import { useAuth } from "@/lib/auth-context";
import { sanitizeReturnTo } from "@/lib/auth-redirect";

function SignupContent() {
  const { session, loading, sendSignInLink, isAdminBypass } = useAuth();
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
      subtitle="Get a web command center for your lot. We'll email a magic link to verify you — no password or code."
      footer={
        <>
          Already registered?{" "}
          <Link href={`/login/?next=${encodeURIComponent(returnTo)}`}>Sign in</Link>
        </>
      }
    >
      <EmailAuthForm
        mode="signup"
        onSendLink={async (email, fullName) => {
          const result = await sendSignInLink(email, "signup", { fullName, returnTo });
          if (result === "admin") {
            router.replace(returnTo);
          }
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
