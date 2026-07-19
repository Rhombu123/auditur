"use client";

import { useEffect, useRef, useState } from "react";

import { supabase, supabaseConfigured } from "@/lib/supabase-browser";

const WATCHED_TABLES = [
  "vehicle_scans",
  "inventory_uploads",
  "inventory_items",
  "lot_zones",
] as const;

type Options = {
  enabled?: boolean;
  dealershipId: string | null;
  onChange: () => void;
};

/**
 * Subscribes to Supabase Realtime for lot data changes.
 * Enable replication for these tables in Supabase → Database → Publications.
 */
export function useDashboardRealtime({
  enabled = true,
  dealershipId,
  onChange,
}: Options) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [liveProgressEnabled, setLiveProgressEnabled] = useState(false);

  useEffect(() => {
    if (!enabled || !dealershipId || !supabaseConfigured()) {
      setLiveProgressEnabled(false);
      return;
    }

    let active = true;
    void supabase
      .from("dealerships")
      .select("live_multi_user_progress_enabled")
      .eq("id", dealershipId)
      .single()
      .then(({ data, error }) => {
        if (active) {
          setLiveProgressEnabled(
            !error && data?.live_multi_user_progress_enabled !== false,
          );
        }
      });

    const settingChannel = supabase
      .channel(`auditur-live-setting:${dealershipId}`)
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
          if (typeof nextEnabled === "boolean") {
            setLiveProgressEnabled(nextEnabled);
            if (nextEnabled) onChangeRef.current();
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(settingChannel);
    };
  }, [dealershipId, enabled]);

  useEffect(() => {
    if (
      !enabled ||
      !liveProgressEnabled ||
      !dealershipId ||
      !supabaseConfigured()
    ) {
      return;
    }

    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    const scheduleRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        onChangeRef.current();
      }, 350);
    };

    const channel = supabase.channel(`auditur-dashboard-live:${dealershipId}`);

    for (const table of WATCHED_TABLES) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `dealership_id=eq.${dealershipId}`,
        },
        scheduleRefresh,
      );
    }

    channel.subscribe();

    function onVisible() {
      if (document.visibilityState === "visible") {
        onChangeRef.current();
      }
    }

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [dealershipId, enabled, liveProgressEnabled]);
}
