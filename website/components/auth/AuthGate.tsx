"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { MfaGate } from "@/components/auth/MfaGate";
import { useAuth } from "@/lib/auth-context";
import { useMfa } from "@/lib/mfa-context";
import { tarmac } from "@/lib/tarmac-theme";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading, isAdminBypass } = useAuth();
  const { status: mfaStatus } = useMfa();
  const router = useRouter();
  const allowed = Boolean(session) || isAdminBypass;

  useEffect(() => {
    if (!loading && !allowed) {
      const path = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const next = encodeURIComponent(path || "/dashboard/");
      router.replace(`/login/?next=${next}`);
    }
  }, [loading, allowed, router]);

  if (loading || (session && mfaStatus === "loading")) {
    return (
      <div className="gate">
        <div className="pulse" />
        <span>Linking to lot feed…</span>
        <style jsx>{`
          .gate {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 1rem;
            background: ${tarmac.asphalt};
            color: ${tarmac.slate};
            font-size: 0.85rem;
            font-weight: 600;
            letter-spacing: 0.06em;
            text-transform: uppercase;
          }

          .pulse {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            border: 2px solid ${tarmac.line};
            border-top-color: ${tarmac.teal};
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  if (!allowed) return null;
  if (!isAdminBypass && session && mfaStatus !== "verified") {
    return <MfaGate />;
  }

  return <>{children}</>;
}
