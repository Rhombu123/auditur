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
  enableAdminBypass,
  isAdminBypassActive,
  isAdminEmail,
  isLocalDevHost,
} from "@/lib/admin-access";
import {
  clearWebSessionMarker,
  getWebSessionExpiresAt,
  isWebSessionValid,
  markWebSessionStarted,
  touchWebSession,
} from "@/lib/auth-session";
import { formatAuthError, normalizeEmail } from "@/lib/email-auth";
import { clearSensitiveWebState } from "@/lib/security-cache";
import { assertSupabaseConfigured, supabase } from "@/lib/supabase-browser";

const ADMIN_USER = {
  id: "auditur-admin-bypass",
  email: ADMIN_EMAIL,
  user_metadata: { full_name: "Admin" },
  app_metadata: { provider: "admin_bypass", role: "admin" },
  aud: "authenticated",
  created_at: "",
} as unknown as User;

type AccountType = "owner_gm" | "employee";
type SignupResult = "signed-in" | "confirmation-required";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAdminBypass: boolean;
  signInWithPassword: (
    email: string,
    password: string,
    captchaToken?: string,
  ) => Promise<"signed-in" | "admin">;
  signUpWithPassword: (
    email: string,
    password: string,
    details: { fullName: string; accountType: AccountType },
    captchaToken?: string,
  ) => Promise<SignupResult>;
  resendSignupConfirmation: (email: string) => Promise<void>;
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
      // Never honor a leftover localStorage bypass on production hosts.
      if (!isLocalDevHost()) {
        clearAdminBypass();
      }

      if (isAdminBypassActive()) {
        setAdminBypass(true);
        const { enableDemoLot } = await import("@/lib/demo-store");
        enableDemoLot();
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
    const recordActivity = () => touchWebSession();
    window.addEventListener("pointerdown", recordActivity, { passive: true });
    window.addEventListener("keydown", recordActivity);
    window.addEventListener("focus", recordActivity);

    return () => {
      subscription.subscription.unsubscribe();
      window.clearInterval(expiryTimer);
      window.removeEventListener("pointerdown", recordActivity);
      window.removeEventListener("keydown", recordActivity);
      window.removeEventListener("focus", recordActivity);
    };
  }, []);

  const signInWithPassword = useCallback(
    async (
      email: string,
      password: string,
      captchaToken?: string,
    ): Promise<"signed-in" | "admin"> => {
      const normalized = normalizeEmail(email);
      if (!password) throw new Error("Enter your password.");

      if (isAdminEmail(normalized)) {
        if (!isLocalDevHost()) {
          throw new Error(
            "admin@auditur.app is local-only. Use your real manager email on production.",
          );
        }
        if (!enableAdminBypass()) {
          throw new Error("Could not enable local admin access.");
        }
        const { enableDemoLot } = await import("@/lib/demo-store");
        const { ensureAdminAccount } = await import("@/lib/account-ids");
        enableDemoLot();
        ensureAdminAccount();
        markWebSessionStarted();
        setAdminBypass(true);
        return "admin";
      }

      assertSupabaseConfigured();
      const { error } = await supabase.auth.signInWithPassword({
        email: normalized,
        password,
        options: { captchaToken },
      });
      if (error) {
        throw new Error(formatAuthError(error, "Could not sign in."));
      }
      return "signed-in";
    },
    [],
  );

  const signUpWithPassword = useCallback(async (
    email: string,
    password: string,
    details: { fullName: string; accountType: AccountType },
    captchaToken?: string,
  ) => {
    const normalized = normalizeEmail(email);
    if (
      password.length < 12 ||
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/\d/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      throw new Error(
        "Use at least 12 characters with upper/lowercase letters, a number, and a symbol.",
      );
    }
    if (!details.fullName.trim()) throw new Error("Enter your full name.");
    assertSupabaseConfigured();

    const { data, error } = await supabase.auth.signUp({
      email: normalized,
      password,
      options: {
        captchaToken,
        data: {
          full_name: details.fullName.trim(),
          account_type: details.accountType,
        },
      },
    });
    if (error) {
      throw new Error(formatAuthError(error, "Could not create account."));
    }
    return data.session ? "signed-in" : "confirmation-required";
  }, []);

  const resendSignupConfirmation = useCallback(async (email: string) => {
    assertSupabaseConfigured();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: normalizeEmail(email),
    });
    if (error) {
      throw new Error(formatAuthError(error, "Could not resend confirmation."));
    }
  }, []);

  const signOut = useCallback(async () => {
    clearAdminBypass();
    setAdminBypass(false);
    clearWebSessionMarker();
    clearSensitiveWebState();
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }, []);

  const value = useMemo(
    () => ({
      session: adminBypass ? ({ user: ADMIN_USER } as Session) : session,
      user: adminBypass ? ADMIN_USER : (session?.user ?? null),
      loading,
      isAdminBypass: adminBypass,
      signInWithPassword,
      signUpWithPassword,
      resendSignupConfirmation,
      signOut,
    }),
    [
      session,
      adminBypass,
      loading,
      signInWithPassword,
      signUpWithPassword,
      resendSignupConfirmation,
      signOut,
    ],
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
