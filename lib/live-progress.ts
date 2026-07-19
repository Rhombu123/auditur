import { useCallback, useEffect, useRef, useState } from "react";

import { useDealership } from "@/lib/dealership-context";
import { supabase } from "@/lib/supabase";

type LiveProgressOptions = {
  onScanChange?: () => void | Promise<void>;
};

async function fetchLiveProgressEnabled(dealershipId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("dealerships")
    .select("live_multi_user_progress_enabled")
    .eq("id", dealershipId)
    .single();

  if (error) throw error;
  return data.live_multi_user_progress_enabled !== false;
}

export function useLiveMultiUserProgress(
  options: LiveProgressOptions = {},
): {
  enabled: boolean;
  loading: boolean;
  updateEnabled: (enabled: boolean) => Promise<void>;
} {
  const { activeDealership } = useDealership();
  const dealershipId = activeDealership?.dealershipId ?? null;
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const onScanChangeRef = useRef(options.onScanChange);

  useEffect(() => {
    onScanChangeRef.current = options.onScanChange;
  }, [options.onScanChange]);

  useEffect(() => {
    let active = true;
    setLoading(true);

    if (!dealershipId) {
      setEnabled(false);
      setLoading(false);
      return;
    }

    void fetchLiveProgressEnabled(dealershipId)
      .then((nextEnabled) => {
        if (active) setEnabled(nextEnabled);
      })
      .catch(() => {
        if (active) setEnabled(false);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const settingChannel = supabase
      .channel(`live-progress-setting:${dealershipId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "dealerships",
          filter: `id=eq.${dealershipId}`,
        },
        (payload) => {
          const nextEnabled = payload.new.live_multi_user_progress_enabled;
          if (typeof nextEnabled === "boolean") setEnabled(nextEnabled);
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(settingChannel);
    };
  }, [dealershipId]);

  useEffect(() => {
    if (!dealershipId || !enabled || !onScanChangeRef.current) return;

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        void onScanChangeRef.current?.();
      }, 250);
    };

    const scansChannel = supabase
      .channel(`live-progress-scans:${dealershipId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vehicle_scans",
          filter: `dealership_id=eq.${dealershipId}`,
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      void supabase.removeChannel(scansChannel);
    };
  }, [dealershipId, enabled]);

  const updateEnabled = useCallback(
    async (nextEnabled: boolean) => {
      if (!dealershipId) throw new Error("Choose a dealership first.");

      const { error } = await supabase.rpc("update_live_multi_user_progress", {
        target_dealership_id: dealershipId,
        enabled: nextEnabled,
      });
      if (error) throw error;
      setEnabled(nextEnabled);
    },
    [dealershipId],
  );

  return { enabled, loading, updateEnabled };
}
