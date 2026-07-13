"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AuthLoading, AuthShell } from "@/components/auth/AuthShell";
import { EmailOtpForm } from "@/components/auth/EmailOtpForm";
import { useAuth } from "@/lib/auth-context";

export default function SignupPage() {
  const { session, loading, sendEmailCode, verifyEmailCode } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && session) {
      router.replace("/dashboard");
    }
  }, [loading, session, router]);

  if (loading) return <AuthLoading />;
  if (session) return null;

  return (
    <AuthShell
      title="Create your account"
      subtitle="Get a web command center for your lot — live scans, audit progress, and upload history from your team."
      footer={
        <>
          Already registered?{" "}
          <Link href="/login">Sign in</Link>
        </>
      }
    >
      <EmailOtpForm
        mode="signup"
        onSendCode={(email) => sendEmailCode(email, "signup")}
        onVerify={async (email, code, fullName) => {
          await verifyEmailCode(email, code, fullName);
          router.replace("/dashboard");
        }}
      />
    </AuthShell>
  );
}
