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

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  sendEmailCode: (email: string) => Promise<void>;
  verifyEmailCode: (email: string, token: string) => Promise<void>;
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

  const sendEmailCode = useCallback(async (email: string) => {
    const normalized = normalizeEmail(email);
    // Do not pass emailRedirectTo — that encourages magic-link emails.
    // Supabase sends a 6-digit code when the Magic Link template uses {{ .Token }}.
    const { error } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: { shouldCreateUser: true },
    });
    if (error) {
      throw new Error(formatAuthError(error, "Could not send verification code."));
    }
  }, []);

  const verifyEmailCode = useCallback(async (email: string, token: string) => {
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
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(getErrorMessage(error, "Could not sign out."));
    }
  }, []);

  const value = useMemo(
    () => ({ session, loading, sendEmailCode, verifyEmailCode, signOut }),
    [session, loading, sendEmailCode, verifyEmailCode, signOut],
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
