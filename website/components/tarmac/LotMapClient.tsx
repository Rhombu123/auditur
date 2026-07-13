"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";

import type { LotZone } from "@/lib/types";
import type { ScannedVehicleRow } from "@/lib/web-api";

type Point = { latitude: number; longitude: number };

type Props = {
  zones: LotZone[];
  vehicles: ScannedVehicleRow[];
  draft: Point[];
  drawing: boolean;
  onMapClick: (point: Point) => void;
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

export default function LotMapClient({ zones, vehicles, draft, drawing, onMapClick }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const overlaysRef = useRef<LayerGroup | null>(null);
  const draftLayerRef = useRef<LayerGroup | null>(null);
  const onMapClickRef = useRef(onMapClick);
  const drawingRef = useRef(drawing);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  onMapClickRef.current = onMapClick;
  drawingRef.current = drawing;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    let cancelled = false;

    void (async () => {
      try {
        const L = (await import("leaflet")).default;
        if (cancelled || !containerRef.current || mapRef.current) return;

        const map = L.map(containerRef.current, {
          scrollWheelZoom: true,
        }).setView([39.8283, -98.5795], 4);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const id = window.setTimeout(() => map.invalidateSize(), 50);
    return () => window.clearTimeout(id);
  }, [mapReady, zones, vehicles, draft, drawing]);

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

      const firstPin = pins[0];
      const firstZonePoint = zones.flatMap((z) => z.polygons.flat()).find(isValidPoint);
      if (firstPin) {
        map.setView([firstPin.latitude, firstPin.longitude], Math.max(map.getZoom(), 16));
      } else if (firstZonePoint) {
        map.setView(
          [firstZonePoint.latitude, firstZonePoint.longitude],
          Math.max(map.getZoom(), 16),
        );
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
