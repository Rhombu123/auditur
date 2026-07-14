"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { AuthLoading, AuthShell } from "@/components/auth/AuthShell";
import "@/components/auth/auth.css";
import { enableAdminBypass, isLocalDevHost } from "@/lib/admin-access";
import { markWebSessionStarted } from "@/lib/auth-session";

export default function AdminUnlockPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isLocalDevHost()) return;
    if (!enableAdminBypass()) return;
    markWebSessionStarted();
    router.replace("/dashboard/");
  }, [router]);

  if (typeof window !== "undefined" && !isLocalDevHost()) {
    return (
      <AuthShell
        title="Local only"
        subtitle="Admin unlock works only on localhost — production requires a normal manager email and password."
        footer={
          <>
            <Link href="/login/">Manager sign in</Link>
          </>
        }
      >
        <Link href="/login/" className="auth-btn">
          Back to sign in
        </Link>
      </AuthShell>
    );
  }

  return <AuthLoading />;
}
