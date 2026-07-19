import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { setApiDealershipId } from "@/lib/active-dealership";
import { useAuth } from "@/lib/auth-context";
import type { DealershipAccess } from "@/lib/dealership-types";
import { clearAllMobileCache } from "@/lib/mobile-cache";
import { clearMobileLotViews } from "@/lib/mobile-lot-view";
import type { PermissionId } from "@/lib/permissions";
import { supabase } from "@/lib/supabase";

type DealershipStatus = "loading" | "ready" | "no-dealership" | "error";

type DealershipContextValue = {
  status: DealershipStatus;
  error: string | null;
  dealerships: DealershipAccess[];
  activeDealership: DealershipAccess | null;
  hasPermission: (permission: PermissionId) => boolean;
  refreshAccess: () => Promise<void>;
  switchDealership: (dealershipId: string) => Promise<void>;
  createDealership: (name: string) => Promise<void>;
};

const DealershipContext = createContext<DealershipContextValue | null>(null);

function mapAccess(row: Record<string, unknown>): DealershipAccess {
  return {
    dealershipId: String(row.dealership_id),
    dealershipName: String(row.dealership_name),
    membershipKind: row.membership_kind === "owner" ? "owner" : "member",
    roleId: typeof row.role_id === "string" ? row.role_id : null,
    roleName: typeof row.role_name === "string" ? row.role_name : null,
    permissions: Array.isArray(row.permissions)
      ? (row.permissions as PermissionId[])
      : [],
    isActive: row.is_active === true,
  };
}

export function DealershipProvider({ children }: { children: ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<DealershipStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [dealerships, setDealerships] = useState<DealershipAccess[]>([]);
  const [activeDealership, setActiveDealership] =
    useState<DealershipAccess | null>(null);

  const refreshAccess = useCallback(async () => {
    if (!session) {
      setDealerships([]);
      setActiveDealership(null);
      setApiDealershipId(null);
      setStatus("no-dealership");
      return;
    }
    setStatus("loading");
    setError(null);
    const { data, error: accessError } = await supabase.rpc(
      "get_my_dealership_access",
    );
    if (accessError) {
      setDealerships([]);
      setActiveDealership(null);
      setApiDealershipId(null);
      setError(accessError.message);
      setStatus("error");
      return;
    }
    const next = ((data ?? []) as Record<string, unknown>[]).map(mapAccess);
    const active = next.find((entry) => entry.isActive) ?? next[0] ?? null;
    if (active && !active.isActive) {
      const { error: preferenceError } = await supabase.rpc(
        "set_active_dealership",
        { target_dealership_id: active.dealershipId },
      );
      if (preferenceError) {
        setError(preferenceError.message);
        setStatus("error");
        return;
      }
    }
    setDealerships(next);
    setActiveDealership(active);
    setApiDealershipId(active?.dealershipId ?? null);
    setStatus(active ? "ready" : "no-dealership");
  }, [session]);

  useEffect(() => {
    if (authLoading) return;
    void refreshAccess();
  }, [authLoading, refreshAccess]);

  const switchDealership = useCallback(
    async (dealershipId: string) => {
      clearAllMobileCache();
      clearMobileLotViews();
      const { error: switchError } = await supabase.rpc(
        "set_active_dealership",
        { target_dealership_id: dealershipId },
      );
      if (switchError) throw switchError;
      await refreshAccess();
    },
    [refreshAccess],
  );

  const createDealership = useCallback(
    async (name: string) => {
      const { error: createError } = await supabase.rpc("create_dealership", {
        dealership_name: name.trim(),
      });
      if (createError) throw createError;
      await refreshAccess();
    },
    [refreshAccess],
  );

  const value = useMemo<DealershipContextValue>(
    () => ({
      status,
      error,
      dealerships,
      activeDealership,
      hasPermission: (permission) =>
        activeDealership?.permissions.includes(permission) ?? false,
      refreshAccess,
      switchDealership,
      createDealership,
    }),
    [
      activeDealership,
      dealerships,
      error,
      refreshAccess,
      status,
      switchDealership,
      createDealership,
    ],
  );

  return (
    <DealershipContext.Provider value={value}>
      {children}
    </DealershipContext.Provider>
  );
}

export function useDealership(): DealershipContextValue {
  const value = useContext(DealershipContext);
  if (!value) {
    throw new Error("useDealership must be used inside DealershipProvider.");
  }
  return value;
}
