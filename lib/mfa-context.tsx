import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

export type MfaStatus =
  | "loading"
  | "signed-out"
  | "needs-enrollment"
  | "needs-challenge"
  | "verified"
  | "error";

type MfaContextValue = {
  status: MfaStatus;
  factorId: string | null;
  error: string | null;
  refreshMfa: () => Promise<void>;
};

const MfaContext = createContext<MfaContextValue | null>(null);

export function MfaProvider({ children }: { children: ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<MfaStatus>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshMfa = useCallback(async () => {
    if (!session) {
      setFactorId(null);
      setError(null);
      setStatus("signed-out");
      return;
    }

    setStatus("loading");
    setError(null);
    const [{ data: factors, error: factorsError }, { data: aal, error: aalError }] =
      await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);

    if (factorsError || aalError) {
      setError(factorsError?.message ?? aalError?.message ?? "Could not verify MFA.");
      setStatus("error");
      return;
    }

    const verifiedFactor = factors.totp.find((factor) => factor.status === "verified");
    setFactorId(verifiedFactor?.id ?? null);
    if (!verifiedFactor) {
      setStatus("needs-enrollment");
    } else if (aal.currentLevel !== "aal2") {
      setStatus("needs-challenge");
    } else {
      setStatus("verified");
    }
  }, [session]);

  useEffect(() => {
    if (authLoading) return;
    void refreshMfa();
  }, [authLoading, refreshMfa]);

  const value = useMemo(
    () => ({ status, factorId, error, refreshMfa }),
    [error, factorId, refreshMfa, status],
  );

  return <MfaContext.Provider value={value}>{children}</MfaContext.Provider>;
}

export function useMfa(): MfaContextValue {
  const value = useContext(MfaContext);
  if (!value) throw new Error("useMfa must be used inside MfaProvider.");
  return value;
}
