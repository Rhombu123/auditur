"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { openStreetMapStyle } from "@/lib/openstreetmap-style";
import type { LotVehicle } from "@/lib/types";

type LotMapProps = {
  vehicles: LotVehicle[];
  selectedVinSuffix: string | null;
  onSelectVehicle: (vinSuffix: string) => void;
};

function createMarkerElement(scannedToday: boolean, selected: boolean): HTMLDivElement {
  const element = document.createElement("div");
  element.className = `lot-pin ${scannedToday ? "lot-pin-today" : "lot-pin-default"} ${
    selected ? "lot-pin-selected" : ""
  }`;
  element.title = scannedToday ? "Scanned today" : "On lot";
  return element;
}

export function LotMap({
  vehicles,
  selectedVinSuffix,
  onSelectVehicle,
}: LotMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const markersRef = useRef<import("maplibre-gl").Marker[]>([]);
  const maplibreRef = useRef<typeof import("maplibre-gl") | null>(null);
  const [isReady, setIsReady] = useState(false);

  const pinnedVehicles = useMemo(
    () =>
      vehicles.filter(
        (vehicle) => vehicle.latitude !== null && vehicle.longitude !== null,
      ),
    [vehicles],
  );

  useEffect(() => {
    if (!mapContainerRef.current) {
      return;
    }

    let cancelled = false;

    async function initMap() {
      const maplibregl = await import("maplibre-gl");
      await import("maplibre-gl/dist/maplibre-gl.css");

      if (cancelled || !mapContainerRef.current) {
        return;
      }

      maplibreRef.current = maplibregl;

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: openStreetMapStyle,
        center: [-98.5795, 39.8283],
        zoom: 3,
      });

      map.addControl(new maplibregl.NavigationControl(), "top-right");
      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        "bottom-right",
      );

      mapRef.current = map;
      setIsReady(true);
    }

    void initMap();

    return () => {
      cancelled = true;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      maplibreRef.current = null;
      setIsReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = maplibreRef.current;
    if (!map || !maplibregl || !isReady) {
      return;
    }

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    if (pinnedVehicles.length === 0) {
      return;
    }

    const bounds = new maplibregl.LngLatBounds();

    for (const vehicle of pinnedVehicles) {
      const lng = vehicle.longitude!;
      const lat = vehicle.latitude!;
      const selected = vehicle.vinSuffix === selectedVinSuffix;
      const element = createMarkerElement(vehicle.scannedToday, selected);

      element.addEventListener("click", () => {
        onSelectVehicle(vehicle.vinSuffix);
      });

      const marker = new maplibregl.Marker({ element })
        .setLngLat([lng, lat])
        .setPopup(
          new maplibregl.Popup({ offset: 18 }).setHTML(
            `<strong>${vehicle.vinSuffix}</strong><br/>${vehicle.model}<br/>${vehicle.color}${
              vehicle.scannedToday
                ? "<br/><span style='color:#059669'>Scanned today</span>"
                : ""
            }`,
          ),
        )
        .addTo(map);

      markersRef.current.push(marker);
      bounds.extend([lng, lat]);
    }

    if (pinnedVehicles.length === 1) {
      map.flyTo({
        center: [pinnedVehicles[0].longitude!, pinnedVehicles[0].latitude!],
        zoom: 17,
      });
      return;
    }

    map.fitBounds(bounds, {
      padding: 56,
      maxZoom: 18,
    });
  }, [isReady, onSelectVehicle, pinnedVehicles, selectedVinSuffix]);

  return (
    <div className="space-y-3">
      <div
        ref={mapContainerRef}
        className="h-[360px] w-full overflow-hidden rounded-3xl border border-zinc-200 shadow-sm sm:h-[420px]"
      />

      <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-600">
        <span className="inline-flex items-center gap-2">
          <span className="lot-pin lot-pin-today lot-pin-legend" />
          Scanned today
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="lot-pin lot-pin-default lot-pin-legend" />
          Has GPS pin
        </span>
        <span>Map data &copy; OpenStreetMap contributors</span>
      </div>
    </div>
  );
}
