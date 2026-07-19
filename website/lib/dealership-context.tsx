"use client";

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
import {
  ALL_PERMISSION_IDS,
  type PermissionId,
} from "@/lib/permissions";
import { supabase } from "@/lib/supabase-browser";

export type DealershipAccess = {
  dealershipId: string;
  dealershipName: string;
  membershipKind: "owner" | "member";
  roleId: string | null;
  roleName: string | null;
  permissions: PermissionId[];
  isActive: boolean;
};

type Value = {
  status: "loading" | "ready" | "no-dealership" | "error";
  error: string | null;
  dealerships: DealershipAccess[];
  activeDealership: DealershipAccess | null;
  hasPermission: (permission: PermissionId) => boolean;
  refreshAccess: () => Promise<void>;
  switchDealership: (id: string) => Promise<void>;
  createDealership: (name: string) => Promise<void>;
};

const Context = createContext<Value | null>(null);

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
  const { session, loading: authLoading, isAdminBypass } = useAuth();
  const [status, setStatus] = useState<Value["status"]>("loading");
  const [error, setError] = useState<string | null>(null);
  const [dealerships, setDealerships] = useState<DealershipAccess[]>([]);
  const [activeDealership, setActive] = useState<DealershipAccess | null>(null);

  const refreshAccess = useCallback(async () => {
    if (isAdminBypass) {
      const demo: DealershipAccess = {
        dealershipId: "demo-dealership",
        dealershipName: "Demo dealership",
        membershipKind: "owner",
        roleId: null,
        roleName: null,
        permissions: [...ALL_PERMISSION_IDS],
        isActive: true,
      };
      setDealerships([demo]);
      setActive(demo);
      setStatus("ready");
      return;
    }
    if (!session) {
      setDealerships([]);
      setActive(null);
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
      setActive(null);
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
      if (preferenceError) throw preferenceError;
    }
    setDealerships(next);
    setActive(active);
    setApiDealershipId(active?.dealershipId ?? null);
    setStatus(active ? "ready" : "no-dealership");
  }, [isAdminBypass, session]);

  useEffect(() => {
    if (!authLoading) void refreshAccess();
  }, [authLoading, refreshAccess]);

  const switchDealership = useCallback(
    async (id: string) => {
      const { error: switchError } = await supabase.rpc(
        "set_active_dealership",
        { target_dealership_id: id },
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

  const value = useMemo<Value>(
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
      createDealership,
      dealerships,
      error,
      refreshAccess,
      status,
      switchDealership,
    ],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useDealership(): Value {
  const value = useContext(Context);
  if (!value) throw new Error("useDealership requires DealershipProvider.");
  return value;
}
