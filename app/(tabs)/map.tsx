import Ionicons from "@expo/vector-icons/Ionicons";
import * as Location from "expo-location";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import MapView, {
  Marker,
  Polygon,
  Polyline,
  type Camera,
  type MapPressEvent,
  type Region,
} from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MapDrawToolbar, type ZoneEditorTool } from "@/components/map-draw-toolbar";
import { ProfileAvatarButton } from "@/components/profile-avatar-button";
import { ZoneHandleMarker } from "@/components/zone-handle-marker";
import { Chip } from "@/components/ui/chip";
import { CoLocatedVehiclesModal } from "@/components/co-located-vehicles-modal";
import { LotZoneNameModal } from "@/components/lot-zone-name-modal";
import { ZoneColorModal } from "@/components/zone-color-modal";
import { colors, radius, shadow, spacing } from "@/constants/theme";
import { brushStrokeToPolygon } from "@/lib/brush-polygon";
import { useDealership } from "@/lib/dealership-context";
import { getErrorMessage } from "@/lib/errors";
import {
  clusterVehiclesByViewport,
  findZoneForPoint,
  isValidMapCoordinate,
} from "@/lib/geo";
import {
  MOBILE_CACHE_KEYS,
  readMobileCache,
  writeMobileCache,
} from "@/lib/mobile-cache";
import {
  loadMobileLotView,
  removeMobileLotView,
  saveMobileLotView,
  type MobileLotView,
} from "@/lib/mobile-lot-view";
import {
  createLotZone,
  deleteLotZone,
  fetchLotZones,
  fetchScannedVehicles,
  updateLotZone,
  updateLotZoneColors,
} from "@/lib/mobile-api";
import type { LotZone, ScannedVehicle } from "@/lib/types";
import { normalizeZoneName } from "@/lib/lot-zone-storage";
import type { MapPoint } from "@/lib/zone-curves";
import { ZONE_COLOR_OPTIONS } from "@/lib/zone-colors";
import {
  createShapeAt,
  editableShapeFromPolygon,
  findNearestPolygonIndex,
  moveShapeCenter,
  polygonCenter,
  rotationHandleConnector,
  rotateShapeToward,
  rotationHandlePosition,
  resizeShapeFromHandle,
  shapeHandlePositions,
  shapeToPolygon,
  translatePolygon,
  type EditableShape,
  type ZoneShapeKind,
} from "@/lib/zone-shapes";
import { formatVinPrimary, formatVinSecondary } from "@/lib/vin-display";
import { formatVehicleTitle, getVehicleDisplay } from "@/lib/vehicle-display";

type DraftEntry = {
  id: string;
  shape: EditableShape | null;
  freehandPoints: MapPoint[] | null;
  strokePoints: MapPoint[] | null;
};

type EditorMode = "idle" | "create" | "edit";

function normalizeVinSearch(value: string): string {
  return value.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

function vehicleStartsWithVin(
  vehicle: ScannedVehicle,
  normalizedQuery: string,
): boolean {
  if (!normalizedQuery) return false;
  const fullVin = normalizeVinSearch(vehicle.vin ?? "");
  const suffix = normalizeVinSearch(vehicle.vinSuffix);
  const candidates = [
    fullVin,
    fullVin.length >= 8 ? fullVin.slice(-8) : "",
    suffix,
  ];
  return candidates.some((candidate) => candidate.startsWith(normalizedQuery));
}

function createEntryId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function entryPolygon(entry: DraftEntry): MapPoint[] {
  if (entry.shape) return shapeToPolygon(entry.shape);
  return entry.freehandPoints ?? [];
}

function isShapeTool(tool: ZoneEditorTool): tool is ZoneShapeKind {
  return tool === "rectangle" || tool === "square" || tool === "oval";
}

function distanceMeters(a: MapPoint, b: MapPoint): number {
  const latitudeDistance = (a.latitude - b.latitude) * 111_320;
  const longitudeDistance =
    (a.longitude - b.longitude) *
    111_320 *
    Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot(latitudeDistance, longitudeDistance);
}

function colorWithOpacity(color: string, opacity: number): string {
  const match = color.match(/^#([0-9a-f]{6})$/i);
  if (!match) return color;
  const value = Number.parseInt(match[1], 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${opacity})`;
}

function vehiclePinColor(vehicle: ScannedVehicle, selected: boolean): string {
  if (selected) return colors.mapPinSelected;
  if (vehicle.lotStatus === "removed") return colors.danger;
  if (vehicle.lotStatus === "sold" || vehicle.lotStatus === "auctioned") {
    return colors.warning;
  }
  return vehicle.matched ? colors.mapPin : colors.accent;
}

function pointIsInsidePolygon(point: MapPoint, polygon: MapPoint[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
    const currentPoint = polygon[current];
    const previousPoint = polygon[previous];
    const crossesLatitude =
      currentPoint.latitude > point.latitude !== previousPoint.latitude > point.latitude;
    if (!crossesLatitude) continue;
    const edgeLongitude =
      ((previousPoint.longitude - currentPoint.longitude) *
        (point.latitude - currentPoint.latitude)) /
        (previousPoint.latitude - currentPoint.latitude) +
      currentPoint.longitude;
    if (point.longitude < edgeLongitude) inside = !inside;
  }
  return inside;
}

function orientation(a: MapPoint, b: MapPoint, c: MapPoint): number {
  return (
    (b.longitude - a.longitude) * (c.latitude - a.latitude) -
    (b.latitude - a.latitude) * (c.longitude - a.longitude)
  );
}

function segmentsIntersect(
  a: MapPoint,
  b: MapPoint,
  c: MapPoint,
  d: MapPoint,
): boolean {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  return abC * abD < 0 && cdA * cdB < 0;
}

function isSelfIntersectingPolygon(points: MapPoint[]): boolean {
  if (points.length < 4) return false;
  for (let first = 0; first < points.length; first++) {
    const firstNext = (first + 1) % points.length;
    for (let second = first + 2; second < points.length; second++) {
      const secondNext = (second + 1) % points.length;
      if (first === secondNext || firstNext === second) continue;
      if (
        segmentsIntersect(
          points[first],
          points[firstNext],
          points[second],
          points[secondNext],
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function recoverBrushCenterline(polygon: MapPoint[]): MapPoint[] {
  if (polygon.length < 4 || polygon.length % 2 !== 0) return [];
  const half = polygon.length / 2;
  const left = polygon.slice(0, half);
  const right = polygon.slice(half).reverse();
  return left.map((point, index) => ({
    latitude: (point.latitude + right[index].latitude) / 2,
    longitude: (point.longitude + right[index].longitude) / 2,
  }));
}

export default function MapScreen() {
  const {
    activeDealership,
    hasPermission,
    status: dealershipStatus,
  } = useDealership();
  const canManageMap = hasPermission("manage_map");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const params = useLocalSearchParams<{ selectedId?: string }>();
  const mapRef = useRef<MapView>(null);
  const activePaintEntryIdRef = useRef<string | null>(null);
  const activePaintPointsRef = useRef<MapPoint[]>([]);
  const paintDidDragRef = useRef(false);
  const transformShapeRef = useRef<EditableShape | null>(null);
  const eraseGestureActiveRef = useRef(false);

  const [vehicles, setVehicles] = useState<ScannedVehicle[]>([]);
  const [zones, setZones] = useState<LotZone[]>([]);
  const [vinQuery, setVinQuery] = useState("");
  const [vinSuggestionsOpen, setVinSuggestionsOpen] = useState(false);
  const [zoneFilterId, setZoneFilterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [coLocated, setCoLocated] = useState<ScannedVehicle[]>([]);

  const [editorMode, setEditorMode] = useState<EditorMode>("idle");
  const [editingZone, setEditingZone] = useState<LotZone | null>(null);
  const [editorTool, setEditorTool] = useState<ZoneEditorTool>("highlight");
  const [draftEntries, setDraftEntries] = useState<DraftEntry[]>([]);
  const [undoStack, setUndoStack] = useState<DraftEntry[][]>([]);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [namingZone, setNamingZone] = useState(false);
  const [colorEditZone, setColorEditZone] = useState<LotZone | null>(null);
  const [draftColorOpen, setDraftColorOpen] = useState(false);
  const [draftColors, setDraftColors] = useState(() => ({
    fillColor: ZONE_COLOR_OPTIONS[0].fill,
    strokeColor: ZONE_COLOR_OPTIONS[0].stroke,
  }));
  const [locationReady, setLocationReady] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [lockedCamera, setLockedCamera] = useState<MobileLotView | null>(null);
  const [cameraLocked, setCameraLocked] = useState(false);
  const [viewportRegion, setViewportRegion] = useState<Region | null>(null);

  const refreshData = useCallback(async (showSpinner = false) => {
    if (dealershipStatus !== "ready" || !activeDealership) return;
    const [cachedVehicles, cachedZones] = await Promise.all([
      readMobileCache<ScannedVehicle[]>(MOBILE_CACHE_KEYS.vehicles),
      readMobileCache<LotZone[]>(MOBILE_CACHE_KEYS.zones),
    ]);
    if (cachedVehicles) setVehicles(cachedVehicles);
    if (cachedZones) setZones(cachedZones);
    if (showSpinner && !cachedVehicles && !cachedZones) {
      setLoading(true);
    } else {
      setLoading(false);
    }
    setError(null);
    try {
      const [vehicleData, zoneData] = await Promise.all([
        fetchScannedVehicles(),
        fetchLotZones(),
      ]);
      setVehicles(vehicleData);
      setZones(zoneData);
      await Promise.all([
        writeMobileCache(MOBILE_CACHE_KEYS.vehicles, vehicleData),
        writeMobileCache(MOBILE_CACHE_KEYS.zones, zoneData),
      ]);
    } catch (loadError) {
      if (!cachedVehicles && !cachedZones) {
        setError(getErrorMessage(loadError, "Failed to load map."));
      }
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [activeDealership, dealershipStatus]);

  useFocusEffect(
    useCallback(() => {
      void refreshData(true);
    }, [refreshData]),
  );

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          setLocationReady(status === "granted");
        } catch {
          setLocationReady(false);
        }
      })();
    }, []),
  );

  useEffect(() => {
    void loadMobileLotView().then((view) => {
      if (!view) return;
      setLockedCamera(view);
      setCameraLocked(true);
    });
  }, []);

  useEffect(() => {
    if (!mapReady || !lockedCamera) return;
    mapRef.current?.animateCamera(lockedCamera as Camera, { duration: 0 });
  }, [lockedCamera, mapReady]);

  useEffect(() => {
    if (params.selectedId) {
      setSelectedId(params.selectedId);
    }
  }, [params.selectedId]);

  const filtered = useMemo(() => {
    return vehicles.filter((v) => {
      if (v.lotStatus !== "active" || !isValidMapCoordinate(v)) return false;
      if (!zoneFilterId) return true;

      return (
        findZoneForPoint(
          { latitude: v.latitude, longitude: v.longitude },
          zones,
        ) === zoneFilterId
      );
    });
  }, [vehicles, zoneFilterId, zones]);

  const selectedVehicle = useMemo(
    () => filtered.find((vehicle) => vehicle.id === selectedId) ?? null,
    [filtered, selectedId],
  );

  const vinSuggestions = useMemo(() => {
    const normalizedQuery = normalizeVinSearch(vinQuery);
    if (!normalizedQuery) return [];
    return vehicles
      .filter((vehicle) => vehicleStartsWithVin(vehicle, normalizedQuery))
      .slice(0, 4);
  }, [vehicles, vinQuery]);

  const draftPolygons = useMemo(
    () => draftEntries.map(entryPolygon).filter((polygon) => polygon.length >= 3),
    [draftEntries],
  );

  const activeEntry = useMemo(
    () => draftEntries.find((entry) => entry.id === activeEntryId) ?? null,
    [activeEntryId, draftEntries],
  );

  const initialRegion = useMemo<Region>(
    () =>
      vehicles[0]
        ? {
            latitude: vehicles[0].latitude,
            longitude: vehicles[0].longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }
        : {
            latitude: 39.8283,
            longitude: -98.5795,
            latitudeDelta: 30,
            longitudeDelta: 30,
          },
    [vehicles],
  );

  const markerClusters = useMemo(
    () =>
      clusterVehiclesByViewport(
        filtered.filter((vehicle) => vehicle.id !== selectedId),
        viewportRegion ?? initialRegion,
        { width: viewportWidth, height: viewportHeight },
        52,
      ),
    [
      filtered,
      initialRegion,
      viewportHeight,
      viewportRegion,
      viewportWidth,
      selectedId,
    ],
  );

  const editorActive = editorMode !== "idle";

  function openVehicle(vinSuffix: string) {
    router.push({
      pathname: "/vehicle/[vinSuffix]",
      params: { vinSuffix },
    });
  }

  function focusVehicle(vehicle: ScannedVehicle) {
    setSelectedId(vehicle.id);
    if (cameraLocked) return;
    mapRef.current?.animateToRegion(
      {
        latitude: vehicle.latitude,
        longitude: vehicle.longitude,
        latitudeDelta: 0.002,
        longitudeDelta: 0.002,
      },
      350,
    );
  }

  async function centerOnMyLocation() {
    if (cameraLocked) {
      setError("Unlock the lot view before moving the map.");
      return;
    }
    try {
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") {
        const request = await Location.requestForegroundPermissionsAsync();
        status = request.status;
      }

      if (status !== "granted") {
        Alert.alert(
          "Location needed",
          "Allow location access to see where you are on the lot map.",
        );
        setLocationReady(false);
        return;
      }

      setLocationReady(true);
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      mapRef.current?.animateToRegion(
        {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          latitudeDelta: 0.002,
          longitudeDelta: 0.002,
        },
        350,
      );
    } catch {
      setError("Could not get your location.");
    }
  }

  function selectVinSuggestion(vehicle: ScannedVehicle) {
    if (cameraLocked) {
      removeMobileLotView();
      setLockedCamera(null);
      setCameraLocked(false);
    }
    setZoneFilterId(null);
    setSelectedId(vehicle.id);
    setVinQuery("");
    setVinSuggestionsOpen(false);
    setError(null);
    Keyboard.dismiss();
    mapRef.current?.animateToRegion(
      {
        latitude: vehicle.latitude,
        longitude: vehicle.longitude,
        latitudeDelta: 0.00055,
        longitudeDelta: 0.00055,
      },
      500,
    );
  }

  async function toggleCameraLock() {
    if (cameraLocked) {
      removeMobileLotView();
      setLockedCamera(null);
      setCameraLocked(false);
      setError(null);
      return;
    }

    const camera = await mapRef.current?.getCamera();
    if (!camera) {
      setError("The map is still loading.");
      return;
    }
    const view: MobileLotView = {
      center: camera.center,
      heading: camera.heading,
      pitch: camera.pitch,
      zoom: camera.zoom ?? 15,
      altitude: camera.altitude,
    };
    await saveMobileLotView(view);
    setLockedCamera(view);
    setCameraLocked(true);
    setError(null);
  }

  function handleMarkerPress(group: ScannedVehicle[]) {
    if (editorActive) return;
    if (group.length === 1) {
      focusVehicle(group[0]);
      return;
    }
    setCoLocated(group);
  }

  function resetEditor() {
    activePaintEntryIdRef.current = null;
    activePaintPointsRef.current = [];
    paintDidDragRef.current = false;
    setEditorMode("idle");
    setEditingZone(null);
    setEditorTool("highlight");
    setDraftEntries([]);
    setUndoStack([]);
    setActiveEntryId(null);
    setNamingZone(false);
  }

  function startCreateZone() {
    activePaintEntryIdRef.current = null;
    activePaintPointsRef.current = [];
    paintDidDragRef.current = false;
    setEditorMode("create");
    setEditingZone(null);
    setEditorTool("highlight");
    setDraftEntries([]);
    setUndoStack([]);
    setActiveEntryId(null);
    setSelectedId(null);
    const nextColor = ZONE_COLOR_OPTIONS[zones.length % ZONE_COLOR_OPTIONS.length];
    setDraftColors({
      fillColor: nextColor.fill,
      strokeColor: nextColor.stroke,
    });
  }

  function startEditZone(zone: LotZone) {
    activePaintEntryIdRef.current = null;
    activePaintPointsRef.current = [];
    paintDidDragRef.current = false;
    setEditorMode("edit");
    setEditingZone(zone);
    setDraftColors({
      fillColor: zone.fillColor,
      strokeColor: zone.strokeColor,
    });
    setEditorTool("move");
    setUndoStack([]);
    setDraftEntries(
      zone.polygons.map((polygon) => {
        const shape = editableShapeFromPolygon(polygon);
        return {
          id: createEntryId(),
          shape,
          freehandPoints: shape ? null : polygon.map((point) => ({ ...point })),
          strokePoints: null,
        };
      }),
    );
    setActiveEntryId(null);
    setSelectedId(null);
    setZoneFilterId(zone.id);
  }

  function focusZone(zone: LotZone) {
    setZoneFilterId(zone.id);
    if (cameraLocked) return;
    const coordinates = zone.polygons.flat();
    if (coordinates.length < 2) return;
    mapRef.current?.fitToCoordinates(coordinates, {
      edgePadding: { top: 120, right: 48, bottom: 180, left: 48 },
      animated: true,
    });
  }

  function promptZoneChipActions(zone: LotZone) {
    Alert.alert(zone.name, "Filter, edit, recolor, or remove this section.", [
      { text: "Show vehicles", onPress: () => focusZone(zone) },
      { text: "Change color", onPress: () => setColorEditZone(zone) },
      { text: "Edit boundaries", onPress: () => startEditZone(zone) },
      {
        text: "Remove section",
        style: "destructive",
        onPress: () => confirmDeleteZone(zone),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function handleSaveZoneColor(colors: { fillColor: string; strokeColor: string }) {
    if (!colorEditZone) return;
    try {
      await updateLotZoneColors(colorEditZone.id, colors);
      setZones(await fetchLotZones());
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Could not update zone color."));
    }
  }

  function addShapeAt(coordinate: MapPoint, kind: ZoneShapeKind) {
    captureUndo();
    const entry: DraftEntry = {
      id: createEntryId(),
      shape: createShapeAt(kind, coordinate),
      freehandPoints: null,
      strokePoints: null,
    };
    setDraftEntries((current) => [...current, entry]);
    setActiveEntryId(entry.id);
    setEditorTool("move");
  }

  function paintAt(coordinate: MapPoint) {
    const previous = activePaintPointsRef.current.at(-1);
    if (previous && distanceMeters(previous, coordinate) < 3) return;

    let entryId = activePaintEntryIdRef.current;
    if (!entryId) {
      captureUndo();
      entryId = createEntryId();
      activePaintEntryIdRef.current = entryId;
      activePaintPointsRef.current = [];
    }

    const strokePoints = [...activePaintPointsRef.current, coordinate];
    activePaintPointsRef.current = strokePoints;
    const freehandPoints = brushStrokeToPolygon(strokePoints, 12);

    setDraftEntries((current) => {
      const existingIndex = current.findIndex((entry) => entry.id === entryId);
      const nextEntry: DraftEntry = {
        id: entryId,
        shape: null,
        freehandPoints,
        strokePoints,
      };
      if (existingIndex < 0) return [...current, nextEntry];
      return current.map((entry) => (entry.id === entryId ? nextEntry : entry));
    });
  }

  function eraseAt(coordinate: MapPoint) {
    setDraftEntries((current) => {
      let changed = false;
      const next = current.flatMap((entry) => {
        const polygon = entryPolygon(entry);
        if (!entry.strokePoints) {
          if (!pointIsInsidePolygon(coordinate, polygon)) return [entry];
          changed = true;
          return [];
        }
        const remaining = entry.strokePoints.filter(
          (point) => distanceMeters(point, coordinate) > 10,
        );
        if (remaining.length === entry.strokePoints.length) return [entry];
        changed = true;
        if (remaining.length === 0) return [];
        return [
          {
            ...entry,
            strokePoints: remaining,
            freehandPoints: brushStrokeToPolygon(remaining, 12),
          },
        ];
      });
      return changed ? next : current;
    });
  }

  function captureUndo() {
    setUndoStack((current) => [...current, draftEntries].slice(-30));
  }

  function undoLastChange() {
    const previous = undoStack.at(-1);
    if (!previous) return;
    setDraftEntries(previous);
    setUndoStack((current) => current.slice(0, -1));
    setActiveEntryId((current) =>
      current && previous.some((entry) => entry.id === current) ? current : null,
    );
    activePaintEntryIdRef.current = null;
    activePaintPointsRef.current = [];
    eraseGestureActiveRef.current = false;
  }

  function handleMapPress(event: MapPressEvent) {
    if (!editorActive) return;
    const { coordinate } = event.nativeEvent;
    const polygons = draftEntries.map(entryPolygon);

    if (editorTool === "eraser") {
      eraseAt(coordinate);
      return;
    }

    if (editorTool === "highlight") {
      if (paintDidDragRef.current) {
        paintDidDragRef.current = false;
        return;
      }
      paintAt(coordinate);
      activePaintEntryIdRef.current = null;
      activePaintPointsRef.current = [];
      return;
    }

    if (editorTool === "move") {
      const index = findNearestPolygonIndex(coordinate, polygons);
      if (index < 0) return;
      setActiveEntryId(draftEntries[index].id);
      return;
    }

    if (isShapeTool(editorTool)) {
      addShapeAt(coordinate, editorTool);
    }
  }

  function handleMapPanDrag(event: MapPressEvent) {
    if (!editorActive) return;
    const { coordinate } = event.nativeEvent;
    if (editorTool === "highlight") {
      paintDidDragRef.current = true;
      paintAt(coordinate);
    } else if (editorTool === "eraser") {
      eraseAt(coordinate);
    }
  }

  function confirmSaveZone() {
    if (draftPolygons.length === 0) {
      Alert.alert("Add a section", "Paint a stroke or place at least one shape first.");
      return;
    }

    if (editorMode === "edit" && editingZone) {
      void (async () => {
        try {
          await updateLotZone(editingZone.id, draftPolygons);
          await updateLotZoneColors(editingZone.id, draftColors);
          setZones(await fetchLotZones());
          resetEditor();
        } catch (saveError) {
          setError(getErrorMessage(saveError, "Could not save zone."));
        }
      })();
      return;
    }

    setNamingZone(true);
  }

  async function handleSaveNewZone(name: string) {
    const normalized = normalizeZoneName(name);
    const existing = zones.find((zone) => normalizeZoneName(zone.name) === normalized);

    if (existing) {
      await updateLotZone(existing.id, [...existing.polygons, ...draftPolygons]);
      await updateLotZoneColors(existing.id, draftColors);
    } else {
      await createLotZone({
        name,
        coordinates: draftPolygons[0],
        colorIndex: zones.length,
        ...draftColors,
      });

      if (draftPolygons.length > 1) {
        const refreshed = await fetchLotZones();
        const created = refreshed.find((zone) => normalizeZoneName(zone.name) === normalized);
        if (created) {
          await updateLotZone(created.id, draftPolygons);
        }
      }
    }

    setZones(await fetchLotZones());
    resetEditor();
  }

  function confirmDeleteZone(zone: LotZone) {
    Alert.alert(
      "Delete zone",
      `Remove "${zone.name}" from the map? Vehicles are not deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await deleteLotZone(zone.id);
                setZones((current) => current.filter((z) => z.id !== zone.id));
                if (zoneFilterId === zone.id) setZoneFilterId(null);
                if (editingZone?.id === zone.id) resetEditor();
              } catch (deleteError) {
                setError(getErrorMessage(deleteError, "Could not delete zone."));
              }
            })();
          },
        },
      ],
    );
  }

  function updateEntryShape(entryId: string, shape: EditableShape) {
    setDraftEntries((current) =>
      current.map((entry) => (entry.id === entryId ? { ...entry, shape } : entry)),
    );
  }

  function moveEntryCenter(entryId: string, center: MapPoint) {
    setDraftEntries((current) =>
      current.map((entry) => {
        if (entry.id !== entryId) return entry;
        if (entry.shape) {
          return { ...entry, shape: moveShapeCenter(entry.shape, center) };
        }
        const polygon = entry.freehandPoints ?? entry.strokePoints ?? [];
        if (polygon.length === 0) return entry;
        const previousCenter = polygonCenter(polygon);
        const delta = {
          latitude: center.latitude - previousCenter.latitude,
          longitude: center.longitude - previousCenter.longitude,
        };
        return {
          ...entry,
          freehandPoints: entry.freehandPoints
            ? translatePolygon(entry.freehandPoints, delta)
            : null,
          strokePoints: entry.strokePoints
            ? translatePolygon(entry.strokePoints, delta)
            : null,
        };
      }),
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        mapType="hybrid"
        initialRegion={initialRegion}
        onMapReady={() => setMapReady(true)}
        onRegionChangeComplete={setViewportRegion}
        showsUserLocation={locationReady}
        showsMyLocationButton={Platform.OS === "ios" && locationReady && !editorActive}
        scrollEnabled={!editorActive && !cameraLocked}
        zoomEnabled={!editorActive && !cameraLocked}
        rotateEnabled={false}
        pitchEnabled={false}
        onTouchStart={() => {
          activePaintEntryIdRef.current = null;
          activePaintPointsRef.current = [];
          paintDidDragRef.current = false;
          if (editorTool === "eraser" && !eraseGestureActiveRef.current) {
            eraseGestureActiveRef.current = true;
            captureUndo();
          }
        }}
        onTouchEnd={() => {
          activePaintEntryIdRef.current = null;
          activePaintPointsRef.current = [];
          eraseGestureActiveRef.current = false;
        }}
        onPanDrag={handleMapPanDrag}
        onPress={handleMapPress}
      >
        {zones.flatMap((zone) =>
          zone.polygons.map((polygon, polygonIndex) => {
            if (isSelfIntersectingPolygon(polygon)) {
              const centerline = recoverBrushCenterline(polygon);
              if (centerline.length >= 2) {
                return (
                  <Polyline
                    key={`${zone.id}-${polygonIndex}`}
                    coordinates={centerline}
                    strokeColor={colorWithOpacity(zone.strokeColor, 0.5)}
                    strokeWidth={16}
                    lineCap="round"
                    lineJoin="round"
                  />
                );
              }
            }
            return (
              <Polygon
                key={`${zone.id}-${polygonIndex}`}
                coordinates={polygon}
                fillColor={colorWithOpacity(zone.strokeColor, 0.5)}
                strokeColor="transparent"
                strokeWidth={0}
              />
            );
          }),
        )}

        {draftEntries.map((entry) => {
          if (entry.strokePoints) {
            return (
              <Polyline
                key={`draft-stroke-${entry.id}`}
                coordinates={entry.strokePoints}
                strokeColor={colorWithOpacity(draftColors.strokeColor, 0.5)}
                strokeWidth={16}
                lineCap="round"
                lineJoin="round"
              />
            );
          }
          const polygon = entryPolygon(entry);
          if (polygon.length < 3) return null;
          return (
            <Polygon
              key={`draft-${entry.id}`}
              coordinates={polygon}
              fillColor={draftColors.fillColor}
              strokeColor={draftColors.strokeColor}
              strokeWidth={entry.id === activeEntryId ? 4 : 2}
              tappable
              onPress={() => {
                setActiveEntryId(entry.id);
                setEditorTool("move");
              }}
            />
          );
        })}

        {editorActive && editorTool === "move"
          ? draftEntries.map((entry) => {
              const polygon = entryPolygon(entry);
              if (polygon.length === 0) return null;
              const center = entry.shape?.center ?? polygonCenter(polygon);
              return (
                <Marker
                  key={`${entry.id}-center`}
                  coordinate={center}
                  draggable
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges
                  onPress={() => setActiveEntryId(entry.id)}
                  onDragStart={captureUndo}
                  onDrag={(event) => {
                    moveEntryCenter(entry.id, event.nativeEvent.coordinate);
                  }}
                  onDragEnd={(event) => {
                    moveEntryCenter(entry.id, event.nativeEvent.coordinate);
                  }}
                >
                  <ZoneHandleMarker />
                </Marker>
              );
            })
          : null}

        {editorActive &&
        editorTool === "move" &&
        activeEntry?.shape
          ? shapeHandlePositions(activeEntry.shape).map((handle, index) => (
              <Marker
                key={`${activeEntry.id}-handle-${index}`}
                coordinate={handle}
                draggable
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges
                onDragStart={() => {
                  captureUndo();
                  transformShapeRef.current = activeEntry.shape;
                }}
                onDrag={(event) => {
                  const startShape = transformShapeRef.current;
                  if (!startShape) return;
                  updateEntryShape(
                    activeEntry.id,
                    resizeShapeFromHandle(
                      startShape,
                      index,
                      event.nativeEvent.coordinate,
                    ),
                  );
                }}
                onDragEnd={(event) => {
                  const startShape = transformShapeRef.current ?? activeEntry.shape;
                  if (!startShape) return;
                  updateEntryShape(
                    activeEntry.id,
                    resizeShapeFromHandle(
                      startShape,
                      index,
                      event.nativeEvent.coordinate,
                    ),
                  );
                  transformShapeRef.current = null;
                }}
              >
                <ZoneHandleMarker />
              </Marker>
            ))
          : null}

        {editorActive &&
        editorTool === "move" &&
        activeEntry?.shape
          ? (() => {
              const rotationHandle = rotationHandlePosition(activeEntry.shape);
              const connector = rotationHandleConnector(activeEntry.shape);
              if (!rotationHandle) return null;
              return (
                <>
                  {connector ? (
                    <Polyline
                      key={`${activeEntry.id}-rotation-line`}
                      coordinates={connector}
                      strokeColor="#FFFFFF"
                      strokeWidth={2}
                    />
                  ) : null}
                  <Marker
                    key={`${activeEntry.id}-rotation-visible`}
                    coordinate={rotationHandle}
                    anchor={{ x: 0.5, y: 0.5 }}
                    tracksViewChanges
                    zIndex={3}
                  >
                    <ZoneHandleMarker isRotation />
                  </Marker>
                  <Marker
                    key={`${activeEntry.id}-rotation-drag`}
                    coordinate={rotationHandle}
                    draggable
                    anchor={{ x: 0.5, y: 0.5 }}
                    tracksViewChanges={false}
                    zIndex={4}
                    onDragStart={() => {
                      captureUndo();
                      transformShapeRef.current = activeEntry.shape;
                    }}
                    onDrag={(event) => {
                      const startShape = transformShapeRef.current;
                      if (!startShape) return;
                      updateEntryShape(
                        activeEntry.id,
                        rotateShapeToward(startShape, event.nativeEvent.coordinate),
                      );
                    }}
                    onDragEnd={(event) => {
                      const startShape = transformShapeRef.current ?? activeEntry.shape;
                      if (!startShape) return;
                      updateEntryShape(
                        activeEntry.id,
                        rotateShapeToward(
                          startShape,
                          event.nativeEvent.coordinate,
                        ),
                      );
                      transformShapeRef.current = null;
                    }}
                  >
                    <View style={styles.rotationTouchTarget} />
                  </Marker>
                </>
              );
            })()
          : null}

        {!editorActive
          ? markerClusters.map((cluster) => {
              const vehicle = cluster.vehicles[0];
              const count = cluster.vehicles.length;
              if (count > 1) {
                return (
                  <Marker
                    key={cluster.key}
                    coordinate={cluster.coordinate}
                    anchor={{ x: 0.5, y: 0.5 }}
                    tracksViewChanges
                    onPress={() => handleMarkerPress(cluster.vehicles)}
                  >
                    <View style={styles.clusterMarker}>
                      <Ionicons name="car" size={16} color={colors.onPrimary} />
                      <Text style={styles.clusterCount}>{count}</Text>
                    </View>
                  </Marker>
                );
              }

              return (
                <Marker
                  key={cluster.key}
                  coordinate={cluster.coordinate}
                  pinColor={vehiclePinColor(vehicle, false)}
                  onPress={() => handleMarkerPress(cluster.vehicles)}
                />
              );
            })
          : null}

        {!editorActive && selectedVehicle ? (
          <Marker
            key={`selected:${selectedVehicle.id}`}
            coordinate={{
              latitude: selectedVehicle.latitude,
              longitude: selectedVehicle.longitude,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges
            zIndex={20}
            onPress={() => focusVehicle(selectedVehicle)}
          >
            <View style={styles.selectedMarkerHalo}>
              <View
                style={[
                  styles.selectedMarkerCore,
                  {
                    backgroundColor: vehiclePinColor(selectedVehicle, false),
                  },
                ]}
              >
                <Ionicons name="car" size={17} color={colors.onPrimary} />
              </View>
            </View>
          </Marker>
        ) : null}
      </MapView>

      <ProfileAvatarButton
        style={[styles.profileButton, { top: insets.top + spacing.sm }]}
      />

      <View style={[styles.topOverlay, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        {!editorActive ? (
          <View style={styles.vinSearchWrap}>
            <View style={styles.vinSearch}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.vinInput}
                value={vinQuery}
                onChangeText={(value) => {
                  setVinQuery(value);
                  setVinSuggestionsOpen(Boolean(normalizeVinSearch(value)));
                }}
                onFocus={() => {
                  if (normalizeVinSearch(vinQuery)) setVinSuggestionsOpen(true);
                }}
                placeholder="Search VIN, last 8, or last 6"
                placeholderTextColor={colors.textMuted}
                returnKeyType="search"
                autoCapitalize="characters"
                autoCorrect={false}
                accessibilityLabel="Search vehicles by VIN"
              />
              {vinQuery ? (
                <Pressable
                  onPress={() => {
                    setVinQuery("");
                    setVinSuggestionsOpen(false);
                    setSelectedId(null);
                  }}
                  accessibilityLabel="Clear VIN search"
                  hitSlop={8}
                >
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            {vinSuggestionsOpen ? (
              <View style={styles.vinSuggestions}>
                {vinSuggestions.length > 0 ? (
                  vinSuggestions.map((vehicle, index) => {
                    const display = getVehicleDisplay(vehicle);
                    const secondaryVin = formatVinSecondary(
                      vehicle.vin,
                      vehicle.vinSuffix,
                    );
                    return (
                      <Pressable
                        key={vehicle.id}
                        style={[
                          styles.vinSuggestion,
                          index < vinSuggestions.length - 1 &&
                            styles.vinSuggestionBorder,
                        ]}
                        onPress={() => selectVinSuggestion(vehicle)}
                      >
                        <View style={styles.vinSuggestionIcon}>
                          <Ionicons name="car" size={18} color={colors.primary} />
                        </View>
                        <View style={styles.vinSuggestionCopy}>
                          <Text style={styles.vinSuggestionVin} numberOfLines={1}>
                            {formatVinPrimary(vehicle.vin, vehicle.vinSuffix)}
                          </Text>
                          <Text style={styles.vinSuggestionModel} numberOfLines={1}>
                            {formatVehicleTitle(display)}
                            {secondaryVin ? ` · ${secondaryVin}` : ""}
                          </Text>
                        </View>
                        <Ionicons
                          name="locate"
                          size={18}
                          color={colors.primary}
                        />
                      </Pressable>
                    );
                  })
                ) : (
                  <View style={styles.vinSuggestionEmpty}>
                    <Text style={styles.vinSuggestionEmptyText}>
                      No scanned VIN starts with this search.
                    </Text>
                  </View>
                )}
              </View>
            ) : null}
          </View>
        ) : null}

        {!editorActive ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.topChipsRow}
            pointerEvents="box-none"
          >
            <Chip
              label="All zones"
              selected={!zoneFilterId}
              onPress={() => setZoneFilterId(null)}
            />
            {zones.map((zone) => (
              <Pressable
                key={zone.id}
                onPress={() => {
                  if (zoneFilterId === zone.id && canManageMap) {
                    promptZoneChipActions(zone);
                  } else {
                    focusZone(zone);
                  }
                }}
                onLongPress={
                  canManageMap ? () => promptZoneChipActions(zone) : undefined
                }
              >
                <Chip
                  label={zone.name}
                  selected={zoneFilterId === zone.id}
                  accentColor={zone.strokeColor}
                />
              </Pressable>
            ))}
            <View style={styles.chipSpacer} />
          </ScrollView>
        ) : null}

        {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
      </View>

      {editorActive ? (
        <View
          style={[
            styles.drawToolbarWrap,
            {
              top: insets.top + spacing.md,
              bottom: 88 + insets.bottom,
            },
          ]}
          pointerEvents="box-none"
        >
          <MapDrawToolbar
            visible
            tool={editorTool}
            editing={editorMode === "edit"}
            shapeCount={draftPolygons.length}
            color={draftColors.strokeColor}
            canUndo={undoStack.length > 0}
            onSelectTool={setEditorTool}
            onUndo={undoLastChange}
            onColorPress={() => setDraftColorOpen(true)}
            onSave={confirmSaveZone}
            onCancel={resetEditor}
            onDeleteZone={
              editorMode === "edit" && editingZone
                ? () => confirmDeleteZone(editingZone)
                : undefined
            }
          />
        </View>
      ) : null}

      {!editorActive ? (
        <>
          <View style={[styles.mapControls, { bottom: 160 + insets.bottom }]}>
            {canManageMap ? (
              <>
                <Pressable
                  style={styles.mapControlButton}
                  onPress={() => void toggleCameraLock()}
                  accessibilityLabel={cameraLocked ? "Unlock lot view" : "Lock lot view"}
                >
                  <Ionicons
                    name={cameraLocked ? "lock-closed" : "lock-open-outline"}
                    size={20}
                    color={cameraLocked ? colors.primary : colors.textSecondary}
                  />
                </Pressable>
                <View style={styles.mapControlDivider} />
              </>
            ) : null}
            <Pressable
              style={styles.mapControlButton}
              onPress={() => void centerOnMyLocation()}
              accessibilityLabel="Center map on my location"
            >
              <Ionicons
                name="locate"
                size={21}
                color={locationReady ? colors.primary : colors.textMuted}
              />
            </Pressable>
          </View>
          {canManageMap ? (
            <Pressable
              style={[styles.fab, { bottom: 96 + insets.bottom }]}
              onPress={startCreateZone}
              accessibilityLabel="Add lot section"
            >
              <Ionicons name="add" size={28} color={colors.onPrimary} />
            </Pressable>
          ) : null}
        </>
      ) : null}

      <CoLocatedVehiclesModal
        visible={coLocated.length > 0}
        vehicles={coLocated}
        onClose={() => setCoLocated([])}
        onSelect={(vehicle) => {
          focusVehicle(vehicle);
          openVehicle(vehicle.vinSuffix);
        }}
      />

      <LotZoneNameModal
        visible={namingZone}
        pointCount={draftPolygons.length}
        onClose={() => setNamingZone(false)}
        onSave={handleSaveNewZone}
      />

      <ZoneColorModal
        zone={colorEditZone}
        visible={Boolean(colorEditZone)}
        onClose={() => setColorEditZone(null)}
        onSave={handleSaveZoneColor}
      />

      <ZoneColorModal
        zone={editingZone}
        visible={draftColorOpen}
        initialColor={draftColors.strokeColor}
        sectionName={editingZone?.name ?? "New section"}
        onClose={() => setDraftColorOpen(false)}
        onSave={async (nextColors) => {
          setDraftColors(nextColors);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cameraBg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  topOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    gap: spacing.sm,
    zIndex: 15,
  },
  profileButton: {
    position: "absolute",
    right: spacing.md,
    zIndex: 20,
  },
  vinSearchWrap: {
    marginLeft: spacing.lg,
    marginRight: 64,
    zIndex: 30,
  },
  vinSearch: {
    height: 44,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  vinInput: {
    flex: 1,
    height: "100%",
    color: colors.text,
    fontSize: 15,
    fontFamily: Platform.OS === "ios" ? "System" : undefined,
    fontWeight: "400",
    letterSpacing: 0,
    textAlign: "left",
  },
  vinSuggestions: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sheet,
  },
  vinSuggestion: {
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  vinSuggestionBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  vinSuggestionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  vinSuggestionCopy: { flex: 1, minWidth: 0 },
  vinSuggestionVin: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  vinSuggestionModel: {
    marginTop: 3,
    color: colors.textSecondary,
    fontSize: 12,
  },
  vinSuggestionEmpty: {
    minHeight: 58,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
  },
  vinSuggestionEmptyText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  topChipsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingLeft: spacing.lg,
    paddingRight: spacing.lg,
  },
  chipSpacer: {
    width: spacing.sm,
  },
  drawToolbarWrap: {
    position: "absolute",
    left: spacing.md,
    width: 58,
    zIndex: 30,
  },
  rotationTouchTarget: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.01)",
  },
  errorBanner: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.dangerLight,
    color: colors.danger,
    padding: spacing.sm,
    borderRadius: radius.md,
    fontWeight: "600",
    fontSize: 13,
  },
  fab: {
    position: "absolute",
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.sheet,
  },
  mapControls: {
    position: "absolute",
    right: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: "hidden",
    ...shadow.card,
  },
  mapControlButton: {
    width: 46,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  mapControlDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  clusterMarker: {
    minWidth: 48,
    height: 48,
    paddingHorizontal: spacing.sm,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.surface,
    ...shadow.card,
  },
  clusterCount: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: "900",
  },
  selectedMarkerHalo: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.3)",
    borderWidth: 3,
    borderColor: colors.surface,
    ...shadow.card,
  },
  selectedMarkerCore: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
