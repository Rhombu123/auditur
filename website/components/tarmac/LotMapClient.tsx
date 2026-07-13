"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";

import {
  type LockedLotView,
  padLotBounds,
} from "@/lib/lot-map-view";
import type { LotZone } from "@/lib/types";
import type { ScannedVehicleRow } from "@/lib/web-api";

type Point = { latitude: number; longitude: number };

export type LotMapApi = {
  captureView: () => LockedLotView | null;
};

type Props = {
  zones: LotZone[];
  vehicles: ScannedVehicleRow[];
  draft: Point[];
  drawing: boolean;
  lockedView: LockedLotView | null;
  /** When true, map can roam freely so the user can pick a new locked area. */
  relocating: boolean;
  onMapClick: (point: Point) => void;
  onApiReady?: (api: LotMapApi) => void;
};

function isValidPoint(point: { latitude: number; longitude: number } | null | undefined) {
  return (
    !!point &&
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    Math.abs(point.latitude) <= 90 &&
    Math.abs(point.longitude) <= 180
  );
}

export default function LotMapClient({
  zones,
  vehicles,
  draft,
  drawing,
  lockedView,
  relocating,
  onMapClick,
  onApiReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const overlaysRef = useRef<LayerGroup | null>(null);
  const draftLayerRef = useRef<LayerGroup | null>(null);
  const onMapClickRef = useRef(onMapClick);
  const drawingRef = useRef(drawing);
  const lockedViewRef = useRef(lockedView);
  const relocatingRef = useRef(relocating);
  const onApiReadyRef = useRef(onApiReady);
  const didFitFallbackRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  onMapClickRef.current = onMapClick;
  drawingRef.current = drawing;
  lockedViewRef.current = lockedView;
  relocatingRef.current = relocating;
  onApiReadyRef.current = onApiReady;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    let cancelled = false;

    void (async () => {
      try {
        const L = (await import("leaflet")).default;
        if (cancelled || !containerRef.current || mapRef.current) return;

        const saved = lockedViewRef.current;
        const map = L.map(containerRef.current, {
          scrollWheelZoom: true,
          maxZoom: 20,
        });

        if (saved && !relocatingRef.current) {
          map.setView([saved.latitude, saved.longitude], saved.zoom);
        } else {
          map.setView([39.8283, -98.5795], 4);
        }

        // Satellite base + road overlay (matches phone satellite lot view intent).
        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          {
            attribution:
              "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
            maxZoom: 20,
            maxNativeZoom: 19,
          },
        ).addTo(map);

        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
          {
            attribution: "Roads &copy; Esri",
            maxZoom: 20,
            maxNativeZoom: 19,
            opacity: 0.95,
          },
        ).addTo(map);

        overlaysRef.current = L.layerGroup().addTo(map);
        draftLayerRef.current = L.layerGroup().addTo(map);

        map.on("click", (event) => {
          if (!drawingRef.current) return;
          onMapClickRef.current({
            latitude: event.latlng.lat,
            longitude: event.latlng.lng,
          });
        });

        mapRef.current = map;
        setMapReady(true);

        onApiReadyRef.current?.({
          captureView: () => {
            const current = mapRef.current;
            if (!current) return null;
            const center = current.getCenter();
            const bounds = current.getBounds();
            return {
              latitude: center.lat,
              longitude: center.lng,
              zoom: current.getZoom(),
              south: bounds.getSouth(),
              west: bounds.getWest(),
              north: bounds.getNorth(),
              east: bounds.getEast(),
            };
          },
        });

        requestAnimationFrame(() => map.invalidateSize());
        window.setTimeout(() => map.invalidateSize(), 100);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Map failed to load.");
        }
      }
    })();

    return () => {
      cancelled = true;
      setMapReady(false);
      mapRef.current?.remove();
      mapRef.current = null;
      overlaysRef.current = null;
      draftLayerRef.current = null;
    };
  }, []);

  // Apply or clear the locked area constraints.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    let cancelled = false;
    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapRef.current) return;

      if (lockedView && !relocating) {
        const padded = padLotBounds(lockedView);
        const maxBounds = L.latLngBounds(
          [padded.south, padded.west],
          [padded.north, padded.east],
        );
        map.setMaxBounds(maxBounds);
        map.setMinZoom(Math.max(1, lockedView.zoom - 1.25));
        map.options.maxBoundsViscosity = 1;
        map.setView([lockedView.latitude, lockedView.longitude], lockedView.zoom, {
          animate: false,
        });
      } else {
        // Clear lot lock so the user can roam while placing a new home view.
        map.setMaxBounds([
          [-90, -180],
          [90, 180],
        ]);
        map.setMinZoom(1);
        map.options.maxBoundsViscosity = 0;
      }
      map.invalidateSize();
    })();

    return () => {
      cancelled = true;
    };
  }, [mapReady, lockedView, relocating]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const id = window.setTimeout(() => map.invalidateSize(), 50);
    return () => window.clearTimeout(id);
  }, [mapReady, zones, vehicles, draft, drawing, relocating]);

  useEffect(() => {
    const map = mapRef.current;
    const overlays = overlaysRef.current;
    if (!map || !overlays || !mapReady) return;

    let cancelled = false;
    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled) return;
      overlays.clearLayers();

      for (const zone of zones) {
        for (const polygon of zone.polygons) {
          const points = polygon.filter(isValidPoint);
          if (points.length < 3) continue;
          L.polygon(
            points.map((p) => [p.latitude, p.longitude] as [number, number]),
            {
              color: zone.strokeColor,
              fillColor: zone.fillColor,
              fillOpacity: 0.45,
              weight: 2,
            },
          )
            .bindPopup(zone.name)
            .addTo(overlays);
        }
      }

      const pins = vehicles.filter(isValidPoint);
      for (const vehicle of pins) {
        L.circleMarker([vehicle.latitude, vehicle.longitude], {
          radius: 7,
          color: vehicle.matched ? "#0D9488" : "#F59E0B",
          fillColor: vehicle.matched ? "#14B8A6" : "#FBBF24",
          fillOpacity: 0.9,
          weight: 2,
        })
          .bindPopup(
            `<strong>${escapeHtml(vehicle.model)}</strong><br/>${escapeHtml(vehicle.color)} · …${escapeHtml(vehicle.vinSuffix)}`,
          )
          .addTo(overlays);
      }

      // Only auto-focus pins/zones when no locked lot area is set and user isn't relocating.
      if (!lockedViewRef.current && !relocatingRef.current && !didFitFallbackRef.current) {
        const firstPin = pins[0];
        const firstZonePoint = zones.flatMap((z) => z.polygons.flat()).find(isValidPoint);
        if (firstPin) {
          map.setView([firstPin.latitude, firstPin.longitude], Math.max(map.getZoom(), 17));
          didFitFallbackRef.current = true;
        } else if (firstZonePoint) {
          map.setView(
            [firstZonePoint.latitude, firstZonePoint.longitude],
            Math.max(map.getZoom(), 17),
          );
          didFitFallbackRef.current = true;
        }
      }

      map.invalidateSize();
    })();

    return () => {
      cancelled = true;
    };
  }, [mapReady, zones, vehicles]);

  useEffect(() => {
    const draftLayer = draftLayerRef.current;
    if (!draftLayer || !mapReady) return;

    let cancelled = false;
    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled) return;
      draftLayer.clearLayers();

      const points = draft.filter(isValidPoint);
      if (points.length >= 2) {
        L.polyline(
          points.map((p) => [p.latitude, p.longitude] as [number, number]),
          { color: "#0D9488", dashArray: "6 6", weight: 2 },
        ).addTo(draftLayer);
      }

      for (const point of points) {
        L.circleMarker([point.latitude, point.longitude], {
          radius: 5,
          color: "#ecfdf5",
          fillColor: "#0D9488",
          fillOpacity: 1,
          weight: 2,
        }).addTo(draftLayer);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mapReady, draft]);

  if (error) {
    return (
      <p style={{ margin: 0, display: "grid", placeItems: "center", height: "100%", color: "#f87171" }}>
        {error}
      </p>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ height: "100%", width: "100%", minHeight: 360, background: "#0b1220" }}
      role="presentation"
    />
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
