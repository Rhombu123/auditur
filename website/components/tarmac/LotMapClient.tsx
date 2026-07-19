"use client";

import { useEffect, useRef, useState } from "react";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapMouseEvent,
  Marker,
  NavigationControl,
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

export type DrawTool = "paint" | "erase";

export type LotMapApi = {
  captureView: () => LockedLotView | null;
  focusVin: (query: string) => boolean;
};

type Props = {
  zones: LotZone[];
  vehicles: ScannedVehicleRow[];
  draft: Point[];
  drawing: boolean;
  drawTool: DrawTool;
  brushColor: string;
  focusZoneId: string | null;
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
      attribution: "",
      maxzoom: 19,
    },
    roads: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "",
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

function normalizeVinQuery(query: string) {
  return query.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export default function LotMapClient({
  zones,
  vehicles,
  draft,
  drawing,
  drawTool,
  brushColor,
  focusZoneId,
  lockedView,
  relocating,
  onDraftChange,
  onApiReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const navControlRef = useRef<NavigationControl | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);
  const searchMarkerRef = useRef<Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const drawingRef = useRef(drawing);
  const drawToolRef = useRef(drawTool);
  const relocatingRef = useRef(relocating);
  const lockedViewRef = useRef(lockedView);
  const draftRef = useRef(draft);
  const vehiclesRef = useRef(vehicles);
  const onDraftChangeRef = useRef(onDraftChange);
  const onApiReadyRef = useRef(onApiReady);
  const freehandActiveRef = useRef(false);
  const didFitFallbackRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [addressQuery, setAddressQuery] = useState("");
  const [addressSearching, setAddressSearching] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);

  drawingRef.current = drawing;
  drawToolRef.current = drawTool;
  relocatingRef.current = relocating;
  lockedViewRef.current = lockedView;
  draftRef.current = draft;
  vehiclesRef.current = vehicles;
  onDraftChangeRef.current = onDraftChange;
  onApiReadyRef.current = onApiReady;

  useEffect(() => {
    return () => {
      searchMarkerRef.current?.remove();
    };
  }, []);

  async function searchAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = addressQuery.trim();
    const map = mapRef.current;
    if (!query || !map || addressSearching) return;

    setAddressSearching(true);
    setAddressError(null);
    try {
      const params = new URLSearchParams({
        SingleLine: query,
        f: "json",
        outFields: "Match_addr",
        maxLocations: "1",
      });
      const response = await fetch(
        `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?${params}`,
      );
      if (!response.ok) throw new Error("Address search is unavailable.");
      const result = (await response.json()) as {
        candidates?: { address?: string; location?: { x: number; y: number } }[];
      };
      const candidate = result.candidates?.[0];
      if (!candidate?.location) {
        setAddressError("Address not found. Add a city, state, or ZIP code.");
        return;
      }

      const maplibregl = (await import("maplibre-gl")).default;
      searchMarkerRef.current?.remove();
      searchMarkerRef.current = new maplibregl.Marker({ color: "#F59E0B" })
        .setLngLat([candidate.location.x, candidate.location.y])
        .setPopup(
          new maplibregl.Popup({ offset: 18 }).setText(candidate.address || query),
        )
        .addTo(map);
      map.flyTo({
        center: [candidate.location.x, candidate.location.y],
        zoom: 17,
        duration: 850,
      });
    } catch (searchError) {
      setAddressError(
        searchError instanceof Error ? searchError.message : "Could not search that address.",
      );
    } finally {
      setAddressSearching(false);
    }
  }

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
          attributionControl: false,
          dragRotate: true,
          touchPitch: true,
        });

        const nav = new maplibregl.NavigationControl({ visualizePitch: true, showCompass: true });
        navControlRef.current = nav;
        if (relocatingRef.current || !lockedViewRef.current) {
          map.addControl(nav, "top-right");
        }

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
              "fill-opacity": 0.35,
            },
          });
          map.addLayer({
            id: "zones-line",
            type: "line",
            source: "zones",
            layout: {
              "line-cap": "round",
              "line-join": "round",
            },
            paint: {
              "line-color": ["get", "strokeColor"],
              "line-width": 10,
              "line-opacity": 0.5,
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
            id: "draft-line",
            type: "line",
            source: "draft",
            layout: {
              "line-cap": "round",
              "line-join": "round",
            },
            paint: {
              "line-color": brushColor,
              "line-width": 16,
              "line-opacity": 0.5,
              "line-blur": 0.2,
            },
          });

          map.addSource("user-location", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
          map.addLayer({
            id: "user-location-halo",
            type: "circle",
            source: "user-location",
            paint: {
              "circle-radius": 14,
              "circle-color": "#38BDF8",
              "circle-opacity": 0.25,
            },
          });
          map.addLayer({
            id: "user-location-dot",
            type: "circle",
            source: "user-location",
            paint: {
              "circle-radius": 6,
              "circle-color": "#0EA5E9",
              "circle-stroke-width": 2,
              "circle-stroke-color": "#F8FAFC",
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
            focusVin: (query: string) => {
              const needle = normalizeVinQuery(query);
              if (needle.length < 6) return false;
              const match = vehiclesRef.current.find((vehicle) => {
                const vin = normalizeVinQuery(vehicle.vinSuffix);
                return (
                  vin === needle ||
                  vin.endsWith(needle) ||
                  (needle.length >= 6 && vin.slice(-6) === needle.slice(-6)) ||
                  (needle.length >= 8 && vin.slice(-8) === needle.slice(-8))
                );
              });
              if (!match || !mapRef.current) return false;
              if (relocatingRef.current || !lockedViewRef.current) {
                mapRef.current.flyTo({
                  center: [match.longitude, match.latitude],
                  zoom: Math.max(mapRef.current.getZoom(), 18),
                  duration: 700,
                });
              }
              return true;
            },
          });

          map.resize();
        });

        const handleStroke = (event: MapMouseEvent) => {
          if (!drawingRef.current || !freehandActiveRef.current) return;
          const point: Point = {
            latitude: event.lngLat.lat,
            longitude: event.lngLat.lng,
          };

          if (drawToolRef.current === "erase") {
            const remaining = draftRef.current.filter((existing) => distanceMeters(existing, point) > 10);
            if (remaining.length !== draftRef.current.length) {
              onDraftChangeRef.current(remaining);
            }
            return;
          }

          const prev = draftRef.current;
          const last = prev[prev.length - 1];
          if (last && distanceMeters(last, point) < 3) return;
          onDraftChangeRef.current([...prev, point]);
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
          if (drawToolRef.current === "erase") {
            const remaining = draftRef.current.filter((existing) => distanceMeters(existing, start) > 10);
            onDraftChangeRef.current(remaining);
          } else {
            onDraftChangeRef.current([...draftRef.current, start]);
          }
        };

        const onUp = () => {
          if (!freehandActiveRef.current) return;
          freehandActiveRef.current = false;
          applyInteractionMode(map);
        };

        map.on("mousedown", onDown);
        map.on("mousemove", handleStroke);
        map.on("mouseup", onUp);
        map.on("touchstart", onDown);
        map.on("touchmove", handleStroke);
        map.on("touchend", onUp);

        cleanupFns = [
          () => map.off("mousedown", onDown),
          () => map.off("mousemove", handleStroke),
          () => map.off("mouseup", onUp),
          () => map.off("touchstart", onDown),
          () => map.off("touchmove", handleStroke),
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
      if (watchIdRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      userMarkerRef.current?.remove();
      setMapReady(false);
      mapRef.current?.remove();
      mapRef.current = null;
      navControlRef.current = null;
    };
  }, []);

  function applyInteractionMode(map: MapLibreMap) {
    if (drawingRef.current) {
      map.dragPan.disable();
      map.dragRotate.disable();
      map.touchZoomRotate.disableRotation();
      map.touchPitch.disable();
      return;
    }

    if (lockedViewRef.current && !relocatingRef.current) {
      const locked = lockedViewRef.current;
      const padded = padLotBounds(locked, 0.05);
      map.setMaxBounds([
        [padded.west, padded.south],
        [padded.east, padded.north],
      ]);
      map.jumpTo({
        center: [locked.longitude, locked.latitude],
        zoom: locked.zoom,
        bearing: locked.bearing,
        pitch: locked.pitch,
      });
      map.dragPan.disable();
      map.scrollZoom.disable();
      map.boxZoom.disable();
      map.doubleClickZoom.disable();
      map.touchZoomRotate.disable();
      map.keyboard.disable();
      map.dragRotate.disable();
      map.touchPitch.disable();
      return;
    }

    map.setMaxBounds(null);
    map.setMinZoom(1);
    map.dragPan.enable();
    map.scrollZoom.enable();
    map.boxZoom.enable();
    map.doubleClickZoom.enable();
    map.touchZoomRotate.enable();
    map.keyboard.enable();
    map.dragRotate.enable();
    map.touchPitch.enable();
  }

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    applyInteractionMode(map);

    const nav = navControlRef.current;
    const locked = Boolean(lockedView && !relocating);
    if (nav) {
      const hasNav = map.hasControl(nav);
      if (locked && hasNav) map.removeControl(nav);
      if (!locked && !hasNav) map.addControl(nav, "top-right");
    }

    map.resize();
  }, [mapReady, lockedView, relocating, drawing]);

  useEffect(() => {
    if (!mapReady || typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("Location is not available in this browser.");
      return;
    }

    const map = mapRef.current;
    if (!map) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setLocationError(null);
        const source = map.getSource("user-location") as GeoJSONSource | undefined;
        source?.setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: {
                type: "Point",
                coordinates: [position.coords.longitude, position.coords.latitude],
              },
            },
          ],
        });
      },
      (geoError) => {
        setLocationError(
          geoError.code === geoError.PERMISSION_DENIED
            ? "Allow location access to show your position on the lot."
            : "Could not read your current location.",
        );
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 12_000 },
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [mapReady]);

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
          vinSuffix: vehicle.vinSuffix,
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

    draftSource.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: points.map((p) => [p.longitude, p.latitude] as [number, number]),
          },
        },
      ],
    });
  }, [mapReady, draft]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (map.getLayer("draft-line")) {
      map.setPaintProperty("draft-line", "line-color", brushColor);
      map.setPaintProperty("draft-line", "line-opacity", 0.5);
    }
  }, [mapReady, brushColor]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !focusZoneId) return;
    const zone = zones.find((z) => z.id === focusZoneId);
    if (!zone) return;
    const coords = zone.polygons.flat().filter(isValidPoint);
    if (coords.length === 0) return;

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;
    for (const point of coords) {
      minLat = Math.min(minLat, point.latitude);
      maxLat = Math.max(maxLat, point.latitude);
      minLng = Math.min(minLng, point.longitude);
      maxLng = Math.max(maxLng, point.longitude);
    }

    if (relocating || !lockedView) {
      map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        { padding: 64, duration: 850, maxZoom: 19 },
      );
    }

    if (map.getLayer("zones-line")) {
      map.setPaintProperty("zones-line", "line-opacity", [
        "case",
        ["==", ["get", "name"], zone.name],
        0.75,
        0.5,
      ]);
    }
  }, [mapReady, focusZoneId, zones, relocating, lockedView]);

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
      <form
        onSubmit={(event) => void searchAddress(event)}
        style={{
          position: "absolute",
          left: 12,
          top: 12,
          width: "min(22rem, calc(100% - 5.5rem))",
          display: "flex",
          gap: 6,
          padding: 6,
          border: "1px solid rgba(203, 213, 225, 0.9)",
          borderRadius: 10,
          background: "rgba(255, 255, 255, 0.96)",
          boxShadow: "0 4px 14px rgba(15, 23, 42, 0.16)",
        }}
      >
        <input
          value={addressQuery}
          onChange={(event) => setAddressQuery(event.target.value)}
          placeholder="Search an address"
          aria-label="Search map by address"
          style={{
            minWidth: 0,
            flex: 1,
            border: 0,
            outline: 0,
            padding: "0.4rem 0.5rem",
            background: "transparent",
            color: "#0f172a",
            font: "inherit",
            fontSize: 13,
          }}
        />
        <button
          type="submit"
          disabled={!addressQuery.trim() || addressSearching}
          className="ui-btn ui-btn-primary"
          style={{ minHeight: 34, padding: "0 0.75rem" }}
        >
          {addressSearching ? "Finding…" : "Find"}
        </button>
        {addressError ? (
          <span
            role="alert"
            style={{
              position: "absolute",
              left: 0,
              top: "calc(100% + 6px)",
              padding: "0.4rem 0.55rem",
              borderRadius: 7,
              background: "rgba(127, 29, 29, 0.92)",
              color: "#fff",
              fontSize: 11,
            }}
          >
            {addressError}
          </span>
        ) : null}
      </form>
      {locationError ? (
        <p
          style={{
            position: "absolute",
            left: 10,
            bottom: 10,
            margin: 0,
            padding: "0.35rem 0.55rem",
            borderRadius: 6,
            background: "rgba(11,15,20,0.78)",
            color: "#fda4af",
            fontSize: 11,
            maxWidth: "70%",
          }}
        >
          {locationError}
        </p>
      ) : null}
    </div>
  );
}
