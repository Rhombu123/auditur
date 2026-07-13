"use client";

import { useEffect, useRef } from "react";

import { supabase, supabaseConfigured } from "@/lib/supabase-browser";

const WATCHED_TABLES = [
  "vehicle_scans",
  "inventory_uploads",
  "inventory_items",
  "lot_zones",
] as const;

type Options = {
  enabled?: boolean;
  onChange: () => void;
};

/**
 * Subscribes to Supabase Realtime for lot data changes.
 * Enable replication for these tables in Supabase → Database → Publications.
 */
export function useDashboardRealtime({ enabled = true, onChange }: Options) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!enabled || !supabaseConfigured()) return;

    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    const scheduleRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        onChangeRef.current();
      }, 350);
    };

    const channel = supabase.channel("auditur-dashboard-live");

    for (const table of WATCHED_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
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
  }, [enabled]);
}
