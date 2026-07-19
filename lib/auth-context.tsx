import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { formatAuthError, normalizeEmail } from "@/lib/email-auth";
import { getErrorMessage } from "@/lib/errors";
import { AUTH_ENABLED } from "@/lib/auth-config";
import { clearAllMobileCache } from "@/lib/mobile-cache";
import { clearMobileLotViews } from "@/lib/mobile-lot-view";
import { supabase } from "@/lib/supabase";

export type AccountType = "owner_gm" | "employee";
export type SignupResult = "signed-in" | "confirmation-required";

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string, captchaToken?: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    details: { fullName: string; accountType: AccountType },
    captchaToken?: string,
  ) => Promise<SignupResult>;
  resendSignupConfirmation: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(AUTH_ENABLED);

  useEffect(() => {
    if (!AUTH_ENABLED) return;

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (
    email: string,
    password: string,
    captchaToken?: string,
  ) => {
    const normalized = normalizeEmail(email);
    if (!password) throw new Error("Enter your password.");
    const { error } = await supabase.auth.signInWithPassword({
      email: normalized,
      password,
      options: { captchaToken },
    });
    if (error) {
      throw new Error(formatAuthError(error, "Could not sign in."));
    }
  }, []);

  const signUp = useCallback(async (
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
    const normalized = normalizeEmail(email);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: normalized,
    });
    if (error) throw new Error(formatAuthError(error, "Could not resend confirmation."));
  }, []);

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw new Error(getErrorMessage(error, "Could not sign out."));
      }
    } finally {
      clearAllMobileCache();
      clearMobileLotViews();
    }
  }, []);

  const value = useMemo(
    () => ({
      session,
      loading,
      signIn,
      signUp,
      resendSignupConfirmation,
      signOut,
    }),
    [session, loading, signIn, signUp, resendSignupConfirmation, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
}
