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
import { supabase } from "@/lib/supabase";

export type AccountType = "owner_gm" | "employee";

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    details: { fullName: string; accountType: AccountType },
  ) => Promise<void>;
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

  const signIn = useCallback(async (email: string, password: string) => {
    const normalized = normalizeEmail(email);
    if (!password) throw new Error("Enter your password.");
    const { error } = await supabase.auth.signInWithPassword({
      email: normalized,
      password,
    });
    if (error) {
      throw new Error(formatAuthError(error, "Could not sign in."));
    }
  }, []);

  const signUp = useCallback(async (
    email: string,
    password: string,
    details: { fullName: string; accountType: AccountType },
  ) => {
    const normalized = normalizeEmail(email);
    if (password.length < 8) throw new Error("Use at least 8 characters for your password.");
    if (!details.fullName.trim()) throw new Error("Enter your full name.");
    const { data, error } = await supabase.auth.signUp({
      email: normalized,
      password,
      options: {
        data: {
          full_name: details.fullName.trim(),
          account_type: details.accountType,
        },
      },
    });
    if (error) {
      throw new Error(formatAuthError(error, "Could not create account."));
    }
    if (!data.session) {
      throw new Error(
        "Email confirmation is still enabled in Supabase. Turn off Confirm email to use immediate password signup.",
      );
    }
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(getErrorMessage(error, "Could not sign out."));
    }
  }, []);

  const value = useMemo(
    () => ({ session, loading, signIn, signUp, signOut }),
    [session, loading, signIn, signUp, signOut],
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
