"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/lib/auth-context";
import { tarmac } from "@/lib/tarmac-theme";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/login");
    }
  }, [loading, session, router]);

  if (loading) {
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

  if (!session) return null;

  return <>{children}</>;
}
