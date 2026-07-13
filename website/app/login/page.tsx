"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AuthLoading, AuthShell } from "@/components/auth/AuthShell";
import { EmailOtpForm } from "@/components/auth/EmailOtpForm";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
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
      title="Welcome back"
      subtitle="Sign in with the email you use on the Auditur mobile app. We'll send a one-time code — no password needed."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/signup">Create one for free</Link>
        </>
      }
    >
      <EmailOtpForm
        mode="login"
        onSendCode={(email) => sendEmailCode(email, "login")}
        onVerify={async (email, code) => {
          await verifyEmailCode(email, code);
          router.replace("/dashboard");
        }}
      />
    </AuthShell>
  );
}
