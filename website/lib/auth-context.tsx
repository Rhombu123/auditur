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
  ADMIN_EMAIL,
  clearAdminBypass,
  isAdminBypassActive,
} from "@/lib/admin-access";
import { getMagicLinkRedirectTo, storePendingFullName } from "@/lib/auth-redirect";
import {
  clearWebSessionMarker,
  getWebSessionExpiresAt,
  isWebSessionValid,
  markWebSessionStarted,
} from "@/lib/auth-session";
import { formatAuthError, normalizeEmail } from "@/lib/email-auth";
import { assertSupabaseConfigured, supabase } from "@/lib/supabase-browser";

const ADMIN_USER = {
  id: "auditur-admin-bypass",
  email: ADMIN_EMAIL,
  user_metadata: { full_name: "Admin" },
  app_metadata: { provider: "admin_bypass", role: "admin" },
  aud: "authenticated",
  created_at: "",
} as unknown as User;

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAdminBypass: boolean;
  sendSignInLink: (
    email: string,
    mode: "login" | "signup",
    options?: { fullName?: string; returnTo?: string },
  ) => Promise<void>;
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
  const [adminBypass, setAdminBypass] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initSession() {
      if (isAdminBypassActive()) {
        setAdminBypass(true);
        if (!getWebSessionExpiresAt()) markWebSessionStarted();
        setSession(null);
        setLoading(false);
        return;
      }

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
        clearAdminBypass();
        setAdminBypass(false);
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
        if (isAdminBypassActive()) {
          if (!isWebSessionValid()) {
            clearAdminBypass();
            clearWebSessionMarker();
            setAdminBypass(false);
          }
          return;
        }
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

  const sendSignInLink = useCallback(
    async (
      email: string,
      mode: "login" | "signup",
      options?: { fullName?: string; returnTo?: string },
    ) => {
      assertSupabaseConfigured();
      const normalized = normalizeEmail(email);

      if (mode === "signup" && options?.fullName?.trim()) {
        storePendingFullName(options.fullName);
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: normalized,
        options: {
          shouldCreateUser: mode === "signup",
          emailRedirectTo: getMagicLinkRedirectTo(options?.returnTo),
        },
      });
      if (error) {
        throw new Error(formatAuthError(error, "Could not send magic link."));
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    clearAdminBypass();
    setAdminBypass(false);
    clearWebSessionMarker();
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }, []);

  const value = useMemo(
    () => ({
      session: adminBypass ? ({ user: ADMIN_USER } as Session) : session,
      user: adminBypass ? ADMIN_USER : (session?.user ?? null),
      loading,
      isAdminBypass: adminBypass,
      sendSignInLink,
      signOut,
    }),
    [session, adminBypass, loading, sendSignInLink, signOut],
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
