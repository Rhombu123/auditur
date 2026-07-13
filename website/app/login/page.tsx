"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AuthLoading, AuthShell } from "@/components/auth/AuthShell";
import { EmailAuthForm } from "@/components/auth/EmailAuthForm";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { session, loading, sendSignInLink } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && session) {
      router.replace("/dashboard/");
    }
  }, [loading, session, router]);

  if (loading) return <AuthLoading />;
  if (session) return null;

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in with the email you use on the Auditur mobile app. We'll email a Confirm link — no password or code."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/signup/">Create one for free</Link>
        </>
      }
    >
      <EmailAuthForm
        mode="login"
        onSendLink={(email) => sendSignInLink(email, "login")}
      />
    </AuthShell>
  );
}
