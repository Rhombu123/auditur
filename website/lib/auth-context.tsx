"use client";

import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  clearWebSessionMarker,
  getWebSessionExpiresAt,
  isWebSessionValid,
  markWebSessionStarted,
} from "@/lib/auth-session";
import { formatAuthError, normalizeEmail } from "@/lib/email-auth";
import { assertSupabaseConfigured, supabase } from "@/lib/supabase-browser";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  sendEmailCode: (email: string, mode: "login" | "signup") => Promise<void>;
  verifyEmailCode: (email: string, token: string, fullName?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function enforceSessionExpiry(): Promise<boolean> {
  if (!isWebSessionValid()) {
    clearWebSessionMarker();
    await supabase.auth.signOut();
    return false;
  }
  return true;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initSession() {
      const { data } = await supabase.auth.getSession();

      if (data.session) {
        if (!getWebSessionExpiresAt()) {
          markWebSessionStarted();
        } else if (!(await enforceSessionExpiry())) {
          setSession(null);
          setLoading(false);
          return;
        }
      }

      setSession(data.session);
      setLoading(false);
    }

    void initSession();

    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, next) => {
      if (event === "SIGNED_IN") {
        markWebSessionStarted();
      }

      if (event === "SIGNED_OUT") {
        clearWebSessionMarker();
        setSession(null);
        setLoading(false);
        return;
      }

      if (next && !(await enforceSessionExpiry())) {
        setSession(null);
        setLoading(false);
        return;
      }

      setSession(next);
      setLoading(false);
    });

    const expiryTimer = window.setInterval(() => {
      void (async () => {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return;
        if (!(await enforceSessionExpiry())) {
          setSession(null);
        }
      })();
    }, 60_000);

    return () => {
      subscription.subscription.unsubscribe();
      window.clearInterval(expiryTimer);
    };
  }, []);

  const sendEmailCode = useCallback(async (email: string, mode: "login" | "signup") => {
    assertSupabaseConfigured();
    const normalized = normalizeEmail(email);
    // Do not pass emailRedirectTo — that sends a clickable magic link in the email.
    // Supabase sends a 6-digit code when the Magic Link template uses {{ .Token }} only.
    const { error } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: { shouldCreateUser: mode === "signup" },
    });
    if (error) {
      throw new Error(formatAuthError(error, "Could not send verification code."));
    }
  }, []);

  const verifyEmailCode = useCallback(
    async (email: string, token: string, fullName?: string) => {
      assertSupabaseConfigured();
      const normalized = normalizeEmail(email);
      const code = token.replace(/\D/g, "");
      if (code.length < 6) {
        throw new Error("Enter the 6-digit code from your email.");
      }

      const { error } = await supabase.auth.verifyOtp({
        email: normalized,
        token: code,
        type: "email",
      });

      if (error) {
        throw new Error(formatAuthError(error, "Invalid or expired code."));
      }

      if (fullName?.trim()) {
        await supabase.auth.updateUser({
          data: { full_name: fullName.trim() },
        });
      }

      markWebSessionStarted();
    },
    [],
  );

  const signOut = useCallback(async () => {
    clearWebSessionMarker();
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      sendEmailCode,
      verifyEmailCode,
      signOut,
    }),
    [session, loading, sendEmailCode, verifyEmailCode, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}

export function displayName(user: User | null): string {
  if (!user) return "Manager";
  const meta = user.user_metadata?.full_name;
  if (typeof meta === "string" && meta.trim()) return meta.trim();
  return user.email?.split("@")[0] ?? "Manager";
}
