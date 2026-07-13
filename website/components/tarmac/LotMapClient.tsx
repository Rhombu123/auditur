"use client";

import { useEffect, useRef, useState } from "react";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapMouseEvent,
  StyleSpecification,
} from "maplibre-gl";

import { DEMO_LOT_CENTER } from "@/lib/demo-store";
import {
  type LockedLotView,
  padLotBounds,
} from "@/lib/lot-map-view";
import type { LotZone } from "@/lib/types";
import type { ScannedVehicleRow } from "@/lib/web-api-types";

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
  relocating: boolean;
  onDraftChange: (points: Point[]) => void;
  onApiReady?: (api: LotMapApi) => void;
};

const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    satellite: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution:
        "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      maxzoom: 19,
    },
    roads: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Roads © Esri",
      maxzoom: 19,
    },
  },
  layers: [
    { id: "satellite", type: "raster", source: "satellite" },
    {
      id: "roads",
      type: "raster",
      source: "roads",
      paint: { "raster-opacity": 0.92 },
    },
  ],
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

function distanceMeters(a: Point, b: Point) {
  const dLat = (a.latitude - b.latitude) * 111_320;
  const dLng =
    (a.longitude - b.longitude) * 111_320 * Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

export default function LotMapClient({
  zones,
  vehicles,
  draft,
  drawing,
  lockedView,
  relocating,
  onDraftChange,
  onApiReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const drawingRef = useRef(drawing);
  const relocatingRef = useRef(relocating);
  const lockedViewRef = useRef(lockedView);
  const draftRef = useRef(draft);
  const onDraftChangeRef = useRef(onDraftChange);
  const onApiReadyRef = useRef(onApiReady);
  const freehandActiveRef = useRef(false);
  const didFitFallbackRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  drawingRef.current = drawing;
  relocatingRef.current = relocating;
  lockedViewRef.current = lockedView;
  draftRef.current = draft;
  onDraftChangeRef.current = onDraftChange;
  onApiReadyRef.current = onApiReady;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    let cancelled = false;
    let cleanupFns: Array<() => void> = [];

    void (async () => {
      try {
        const maplibregl = (await import("maplibre-gl")).default;
        if (cancelled || !containerRef.current || mapRef.current) return;

        const saved = lockedViewRef.current;
        const map = new maplibregl.Map({
          container: containerRef.current,
          style: SATELLITE_STYLE,
          center: saved
            ? [saved.longitude, saved.latitude]
            : [DEMO_LOT_CENTER.lng, DEMO_LOT_CENTER.lat],
          zoom: saved ? saved.zoom : 17.2,
          bearing: saved?.bearing ?? 0,
          pitch: saved?.pitch ?? 45,
          maxPitch: 70,
          dragRotate: true,
          touchPitch: true,
        });

        map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
        map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
        map.addControl(new maplibregl.ScaleControl({ maxWidth: 120 }), "bottom-left");

        map.on("load", () => {
          map.addSource("zones", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
          map.addLayer({
            id: "zones-fill",
            type: "fill",
            source: "zones",
            paint: {
              "fill-color": ["get", "fillColor"],
              "fill-opacity": 0.4,
            },
          });
          map.addLayer({
            id: "zones-line",
            type: "line",
            source: "zones",
            paint: {
              "line-color": ["get", "strokeColor"],
              "line-width": 2.5,
            },
          });

          map.addSource("vehicles", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
          map.addLayer({
            id: "vehicles-circle",
            type: "circle",
            source: "vehicles",
            paint: {
              "circle-radius": 7,
              "circle-color": ["case", ["get", "matched"], "#14B8A6", "#FBBF24"],
              "circle-stroke-width": 2,
              "circle-stroke-color": ["case", ["get", "matched"], "#0D9488", "#F59E0B"],
            },
          });

          map.addSource("draft", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
          map.addLayer({
            id: "draft-fill",
            type: "fill",
            source: "draft",
            paint: {
              "fill-color": "#0D9488",
              "fill-opacity": 0.25,
            },
          });
          map.addLayer({
            id: "draft-line",
            type: "line",
            source: "draft",
            paint: {
              "line-color": "#5EEAD4",
              "line-width": 3,
              "line-dasharray": [2, 1],
            },
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
                bearing: current.getBearing(),
                pitch: current.getPitch(),
                south: bounds.getSouth(),
                west: bounds.getWest(),
                north: bounds.getNorth(),
                east: bounds.getEast(),
              };
            },
          });

          map.resize();
        });

        const appendFreehandPoint = (event: MapMouseEvent) => {
          if (!drawingRef.current || !freehandActiveRef.current) return;
          const next: Point = {
            latitude: event.lngLat.lat,
            longitude: event.lngLat.lng,
          };
          const prev = draftRef.current;
          const last = prev[prev.length - 1];
          if (last && distanceMeters(last, next) < 4) return;
          onDraftChangeRef.current([...prev, next]);
        };

        const onDown = (event: MapMouseEvent) => {
          if (!drawingRef.current) return;
          event.preventDefault();
          freehandActiveRef.current = true;
          map.dragPan.disable();
          map.dragRotate.disable();
          const start: Point = {
            latitude: event.lngLat.lat,
            longitude: event.lngLat.lng,
          };
          onDraftChangeRef.current([...draftRef.current, start]);
        };

        const onUp = () => {
          if (!freehandActiveRef.current) return;
          freehandActiveRef.current = false;
          if (!drawingRef.current) {
            applyInteractionMode(map);
          } else {
            map.dragPan.disable();
            map.dragRotate.disable();
          }
        };

        map.on("mousedown", onDown);
        map.on("mousemove", appendFreehandPoint);
        map.on("mouseup", onUp);
        map.on("touchstart", onDown);
        map.on("touchmove", appendFreehandPoint);
        map.on("touchend", onUp);

        cleanupFns = [
          () => map.off("mousedown", onDown),
          () => map.off("mousemove", appendFreehandPoint),
          () => map.off("mouseup", onUp),
          () => map.off("touchstart", onDown),
          () => map.off("touchmove", appendFreehandPoint),
          () => map.off("touchend", onUp),
        ];
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Map failed to load.");
        }
      }
    })();

    return () => {
      cancelled = true;
      cleanupFns.forEach((fn) => fn());
      setMapReady(false);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  function applyInteractionMode(map: MapLibreMap) {
    if (drawingRef.current) {
      map.dragPan.disable();
      map.dragRotate.disable();
      map.touchZoomRotate.disableRotation();
      return;
    }

    if (lockedViewRef.current && !relocatingRef.current) {
      const locked = lockedViewRef.current;
      const padded = padLotBounds(locked, 0.05);
      map.setMaxBounds([
        [padded.west, padded.south],
        [padded.east, padded.north],
      ]);
      map.setMinZoom(Math.max(1, locked.zoom - 0.35));
      map.jumpTo({
        center: [locked.longitude, locked.latitude],
        zoom: locked.zoom,
        bearing: locked.bearing,
        pitch: locked.pitch,
      });
      // Locked home: rotate/tilt/zoom stay on this lot; no free roaming.
      map.dragPan.disable();
      map.dragRotate.enable();
      map.touchZoomRotate.enableRotation();
      map.scrollZoom.enable();
      map.boxZoom.disable();
      map.keyboard.disable();
      return;
    }

    map.setMaxBounds(null);
    map.setMinZoom(1);
    map.dragPan.enable();
    map.dragRotate.enable();
    map.touchZoomRotate.enableRotation();
    map.scrollZoom.enable();
    map.boxZoom.enable();
    map.keyboard.enable();
  }

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    applyInteractionMode(map);
    map.resize();
  }, [mapReady, lockedView, relocating, drawing]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const zoneSource = map.getSource("zones") as GeoJSONSource | undefined;
    const vehicleSource = map.getSource("vehicles") as GeoJSONSource | undefined;
    if (!zoneSource || !vehicleSource) return;

    zoneSource.setData({
      type: "FeatureCollection",
      features: zones.flatMap((zone) =>
        zone.polygons
          .map((polygon) => polygon.filter(isValidPoint))
          .filter((polygon) => polygon.length >= 3)
          .map((polygon) => ({
            type: "Feature" as const,
            properties: {
              name: zone.name,
              fillColor: zone.fillColor,
              strokeColor: zone.strokeColor,
            },
            geometry: {
              type: "Polygon" as const,
              coordinates: [
                [
                  ...polygon.map((p) => [p.longitude, p.latitude] as [number, number]),
                  [polygon[0].longitude, polygon[0].latitude] as [number, number],
                ],
              ],
            },
          })),
      ),
    });

    const pins = vehicles.filter(isValidPoint);
    vehicleSource.setData({
      type: "FeatureCollection",
      features: pins.map((vehicle) => ({
        type: "Feature" as const,
        properties: {
          matched: vehicle.matched,
          label: `${vehicle.model} · …${vehicle.vinSuffix}`,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [vehicle.longitude, vehicle.latitude],
        },
      })),
    });

    if (!lockedViewRef.current && !relocatingRef.current && !didFitFallbackRef.current && pins[0]) {
      map.flyTo({
        center: [pins[0].longitude, pins[0].latitude],
        zoom: Math.max(map.getZoom(), 17),
        duration: 600,
      });
      didFitFallbackRef.current = true;
    }

    map.resize();
  }, [mapReady, zones, vehicles]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const draftSource = map.getSource("draft") as GeoJSONSource | undefined;
    if (!draftSource) return;

    const points = draft.filter(isValidPoint);
    if (points.length < 2) {
      draftSource.setData({ type: "FeatureCollection", features: [] });
      return;
    }

    const ring = points.map((p) => [p.longitude, p.latitude] as [number, number]);
    const closed =
      points.length >= 3
        ? [...ring, [points[0].longitude, points[0].latitude] as [number, number]]
        : ring;

    draftSource.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry:
            points.length >= 3
              ? { type: "Polygon", coordinates: [closed] }
              : { type: "LineString", coordinates: ring },
        },
      ],
    });
  }, [mapReady, draft]);

  if (error) {
    return (
      <p style={{ margin: 0, display: "grid", placeItems: "center", height: "100%", color: "#f87171" }}>
        {error}
      </p>
    );
  }

  return (
    <div style={{ position: "relative", height: "100%", width: "100%", minHeight: 360 }}>
      <div
        ref={containerRef}
        style={{ height: "100%", width: "100%", minHeight: 360, background: "#0b1220" }}
        role="presentation"
      />
      <p
        style={{
          position: "absolute",
          left: 10,
          bottom: 10,
          margin: 0,
          padding: "0.35rem 0.55rem",
          borderRadius: 6,
          background: "rgba(11,15,20,0.72)",
          color: "#cbd5e1",
          fontSize: 11,
          pointerEvents: "none",
        }}
      >
        Drag with right-click / Ctrl+drag to rotate · two-finger tilt on trackpad
      </p>
    </div>
  );
}
