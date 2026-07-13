"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { AuthLoading, AuthShell } from "@/components/auth/AuthShell";
import "@/components/auth/auth.css";
import {
  ADMIN_EMAIL,
  adminAccessKeyMatches,
  enableAdminBypass,
} from "@/lib/admin-access";
import { markWebSessionStarted } from "@/lib/auth-session";

function AdminUnlockContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const key = searchParams.get("key");
    if (!adminAccessKeyMatches(key)) {
      setError("Invalid or missing admin access key.");
      return;
    }

    enableAdminBypass();
    markWebSessionStarted();
    router.replace("/dashboard/");
  }, [router, searchParams]);

  if (error) {
    return (
      <AuthShell
        title="Admin unlock failed"
        subtitle={error}
        footer={
          <>
            <Link href="/login/">Manager sign in</Link>
          </>
        }
      >
        <p className="auth-hint">
          Use the admin unlock URL with the correct key for <strong>{ADMIN_EMAIL}</strong>.
        </p>
        <Link href="/login/" className="auth-btn">
          Back to sign in
        </Link>
      </AuthShell>
    );
  }

  return <AuthLoading />;
}

export default function AdminUnlockPage() {
  return (
    <Suspense fallback={<AuthLoading />}>
      <AdminUnlockContent />
    </Suspense>
  );
}
