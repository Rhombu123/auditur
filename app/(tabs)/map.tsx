import Ionicons from "@expo/vector-icons/Ionicons";
import * as Location from "expo-location";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { MotiView } from "moti";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, Polygon, type MapPressEvent } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MapDrawToolbar, type ZoneEditorTool } from "@/components/map-draw-toolbar";
import { MapVehicleSheet } from "@/components/map-vehicle-sheet";
import { ZoneHandleMarker } from "@/components/zone-handle-marker";
import { Chip } from "@/components/ui/chip";
import { CoLocatedVehiclesModal } from "@/components/co-located-vehicles-modal";
import { LotZoneNameModal } from "@/components/lot-zone-name-modal";
import { ZoneColorModal } from "@/components/zone-color-modal";
import { VehicleEditorModal } from "@/components/vehicle-editor-modal";
import { Button } from "@/components/ui/button";
import { colors, radius, shadow, spacing, typography } from "@/constants/theme";
import { getErrorMessage } from "@/lib/errors";
import { findCoLocatedVehicles, findZoneForPoint, groupVehiclesByLocation } from "@/lib/geo";
import {
  MOBILE_CACHE_KEYS,
  readMobileCache,
  writeMobileCache,
} from "@/lib/mobile-cache";
import {
  createLotZone,
  deleteLotZone,
  fetchLotZones,
  fetchScannedVehicles,
  updateLotZone,
  updateLotZoneColors,
  updateScannedVehicle,
} from "@/lib/mobile-api";
import type { LotZone, ScannedVehicle } from "@/lib/types";
import { normalizeZoneName } from "@/lib/lot-zone-storage";
import type { MapPoint } from "@/lib/zone-curves";
import {
  circlePolygon,
  createShapeAt,
  findNearestPolygonIndex,
  HIGHLIGHT_RADIUS,
  moveShapeCenter,
  polygonCenter,
  resizeShapeFromHandle,
  shapeHandlePositions,
  shapeToPolygon,
  translatePolygon,
  type EditableShape,
  type ZoneShapeKind,
} from "@/lib/zone-shapes";
import { formatVinPrimary, formatVinSecondary } from "@/lib/vin-display";
import { matchesVehicleSearch } from "@/lib/vin-search";
import { formatVehicleTitle, getVehicleDisplay } from "@/lib/vehicle-display";

type DraftEntry = {
  id: string;
  shape: EditableShape | null;
  freehandPoints: MapPoint[] | null;
};

type EditorMode = "idle" | "create" | "edit";

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

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ selectedId?: string }>();
  const mapRef = useRef<MapView>(null);

  const [vehicles, setVehicles] = useState<ScannedVehicle[]>([]);
  const [zones, setZones] = useState<LotZone[]>([]);
  const [search, setSearch] = useState("");
  const [zoneFilterId, setZoneFilterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ScannedVehicle | null>(null);
  const [coLocated, setCoLocated] = useState<ScannedVehicle[]>([]);

  const [editorMode, setEditorMode] = useState<EditorMode>("idle");
  const [editingZone, setEditingZone] = useState<LotZone | null>(null);
  const [editorTool, setEditorTool] = useState<ZoneEditorTool>("rectangle");
  const [draftEntries, setDraftEntries] = useState<DraftEntry[]>([]);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [namingZone, setNamingZone] = useState(false);
  const [colorEditZone, setColorEditZone] = useState<LotZone | null>(null);
  const [locationReady, setLocationReady] = useState(false);

  const refreshData = useCallback(async (showSpinner = false) => {
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
  }, []);

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
    if (params.selectedId) {
      setSelectedId(params.selectedId);
    }
  }, [params.selectedId]);

  const zoneById = useMemo(
    () => new Map(zones.map((zone) => [zone.id, zone])),
    [zones],
  );

  const filtered = useMemo(() => {
    return vehicles.filter((v) => {
      if (!matchesVehicleSearch(search, {
        vin: v.vin,
        vinSuffix: v.vinSuffix,
        model: v.model,
        color: v.color,
      })) {
        return false;
      }

      if (!zoneFilterId) return true;

      return (
        findZoneForPoint(
          { latitude: v.latitude, longitude: v.longitude },
          zones,
        ) === zoneFilterId
      );
    });
  }, [search, vehicles, zoneFilterId, zones]);

  const locationGroups = useMemo(
    () => groupVehiclesByLocation(filtered),
    [filtered],
  );

  const selected = useMemo(
    () => filtered.find((v) => v.id === selectedId) ?? null,
    [filtered, selectedId],
  );

  const draftPolygons = useMemo(
    () => draftEntries.map(entryPolygon).filter((polygon) => polygon.length >= 3),
    [draftEntries],
  );

  const activeEntry = useMemo(
    () => draftEntries.find((entry) => entry.id === activeEntryId) ?? null,
    [activeEntryId, draftEntries],
  );

  const initialRegion = vehicles[0]
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
      };

  const editorActive = editorMode !== "idle";

  function openVehicle(vinSuffix: string) {
    router.push({
      pathname: "/vehicle/[vinSuffix]",
      params: { vinSuffix },
    });
  }

  function focusVehicle(vehicle: ScannedVehicle) {
    setSelectedId(vehicle.id);
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

  function handleMarkerPress(vehicle: ScannedVehicle) {
    if (editorActive) return;
    const nearby = findCoLocatedVehicles(filtered, vehicle);
    if (nearby.length > 1) {
      setCoLocated(nearby);
      return;
    }
    focusVehicle(vehicle);
  }

  function resetEditor() {
    setEditorMode("idle");
    setEditingZone(null);
    setEditorTool("rectangle");
    setDraftEntries([]);
    setActiveEntryId(null);
    setNamingZone(false);
  }

  function startCreateZone() {
    setEditorMode("create");
    setEditingZone(null);
    setEditorTool("rectangle");
    setDraftEntries([]);
    setActiveEntryId(null);
    setSelectedId(null);
  }

  function startEditZone(zone: LotZone) {
    setEditorMode("edit");
    setEditingZone(zone);
    setEditorTool("move");
    setDraftEntries(
      zone.polygons.map((polygon) => ({
        id: createEntryId(),
        shape: null,
        freehandPoints: polygon.map((point) => ({ ...point })),
      })),
    );
    setActiveEntryId(null);
    setSelectedId(null);
    setZoneFilterId(zone.id);
  }

  function promptZoneFab() {
    Alert.alert("Lot zones", "Add, edit, or remove a lot section.", [
      { text: "Add section", onPress: startCreateZone },
      ...(zones.length > 0
        ? [
            { text: "Edit section…", onPress: promptPickZoneToEdit },
            { text: "Remove section…", onPress: promptPickZoneToRemove, style: "destructive" as const },
          ]
        : []),
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function promptPickZoneToRemove() {
    if (zones.length === 1) {
      confirmDeleteZone(zones[0]);
      return;
    }

    Alert.alert("Remove which section?", "This only removes the map outline, not vehicles.", [
      ...zones.slice(0, 5).map((zone) => ({
        text: zone.name,
        style: "destructive" as const,
        onPress: () => confirmDeleteZone(zone),
      })),
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function promptPickZoneToEdit() {
    if (zones.length === 1) {
      startEditZone(zones[0]);
      return;
    }

    Alert.alert(
      "Edit which section?",
      "Pick a zone to reshape with rectangles, ovals, highlighter, or eraser.",
      [
        ...zones.slice(0, 5).map((zone) => ({
          text: zone.name,
          onPress: () => startEditZone(zone),
        })),
        { text: "Cancel", style: "cancel" },
      ],
    );
  }

  function promptZoneChipActions(zone: LotZone) {
    Alert.alert(zone.name, "Filter, edit, recolor, or remove this section.", [
      { text: "Show vehicles", onPress: () => setZoneFilterId(zone.id) },
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
    const entry: DraftEntry = {
      id: createEntryId(),
      shape: createShapeAt(kind, coordinate),
      freehandPoints: null,
    };
    setDraftEntries((current) => [...current, entry]);
    setActiveEntryId(entry.id);
  }

  function handleMapPress(event: MapPressEvent) {
    if (!editorActive) return;
    const { coordinate } = event.nativeEvent;
    const polygons = draftEntries.map(entryPolygon);

    if (editorTool === "eraser") {
      const index = findNearestPolygonIndex(coordinate, polygons);
      if (index < 0) return;
      const entry = draftEntries[index];
      setDraftEntries((current) => current.filter((item) => item.id !== entry.id));
      if (activeEntryId === entry.id) setActiveEntryId(null);
      return;
    }

    if (editorTool === "highlight") {
      const entry: DraftEntry = {
        id: createEntryId(),
        shape: null,
        freehandPoints: circlePolygon(coordinate, HIGHLIGHT_RADIUS),
      };
      setDraftEntries((current) => [...current, entry]);
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

  function confirmSaveZone() {
    if (draftPolygons.length === 0) {
      Alert.alert("Add a shape", "Place at least one rectangle, square, or oval first.");
      return;
    }

    if (editorMode === "edit" && editingZone) {
      void (async () => {
        try {
          await updateLotZone(editingZone.id, draftPolygons);
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
    } else {
      await createLotZone({
        name,
        coordinates: draftPolygons[0],
        colorIndex: zones.length,
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

  async function handleSave(id: string, model: string, color: string) {
    await updateScannedVehicle(id, { model, color });
    setVehicles((current) =>
      current.map((v) => (v.id === id ? { ...v, model, color } : v)),
    );
  }

  function zoneLabelForVehicle(vehicle: ScannedVehicle): string | null {
    const zoneId = findZoneForPoint(
      { latitude: vehicle.latitude, longitude: vehicle.longitude },
      zones,
    );
    return zoneId ? zoneById.get(zoneId)?.name ?? null : null;
  }

  function updateEntryShape(entryId: string, shape: EditableShape) {
    setDraftEntries((current) =>
      current.map((entry) => (entry.id === entryId ? { ...entry, shape } : entry)),
    );
  }

  function moveFreehandEntry(entryId: string, coordinate: MapPoint) {
    setDraftEntries((current) =>
      current.map((entry) => {
        if (entry.id !== entryId || !entry.freehandPoints) return entry;
        const center = polygonCenter(entry.freehandPoints);
        const delta = {
          latitude: coordinate.latitude - center.latitude,
          longitude: coordinate.longitude - center.longitude,
        };
        return {
          ...entry,
          freehandPoints: translatePolygon(entry.freehandPoints, delta),
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

  const selectedDisplay = selected ? getVehicleDisplay(selected) : null;
  const selectedZoneName = selected ? zoneLabelForVehicle(selected) : null;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        mapType="satellite"
        initialRegion={initialRegion}
        showsUserLocation={locationReady}
        showsMyLocationButton={Platform.OS === "ios" && locationReady && !editorActive}
        onPress={handleMapPress}
      >
        {zones.flatMap((zone) =>
          zone.polygons.map((polygon, polygonIndex) => (
            <Polygon
              key={`${zone.id}-${polygonIndex}`}
              coordinates={polygon}
              fillColor={zone.fillColor}
              strokeColor={zone.strokeColor}
              strokeWidth={2}
            />
          )),
        )}

        {draftPolygons.map((polygon, index) => (
          <Polygon
            key={`draft-${draftEntries[index]?.id ?? index}`}
            coordinates={polygon}
            fillColor="rgba(255, 255, 255, 0.22)"
            strokeColor="#FFFFFF"
            strokeWidth={2}
          />
        ))}

        {editorActive
          ? draftEntries.map((entry) => {
              const polygon = entryPolygon(entry);
              if (polygon.length < 3) return null;
              const center = entry.shape
                ? entry.shape.center
                : polygonCenter(polygon);
              return (
                <Marker
                  key={`${entry.id}-center`}
                  coordinate={center}
                  draggable
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={false}
                  onPress={() => setActiveEntryId(entry.id)}
                  onDragEnd={(event) => {
                    const coordinate = event.nativeEvent.coordinate;
                    if (entry.shape) {
                      updateEntryShape(entry.id, moveShapeCenter(entry.shape, coordinate));
                    } else {
                      moveFreehandEntry(entry.id, coordinate);
                    }
                  }}
                >
                  <ZoneHandleMarker />
                </Marker>
              );
            })
          : null}

        {editorActive && activeEntry?.shape
          ? shapeHandlePositions(activeEntry.shape).map((handle, index) => (
              <Marker
                key={`${activeEntry.id}-handle-${index}`}
                coordinate={handle}
                draggable
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
                onDragEnd={(event) => {
                  updateEntryShape(
                    activeEntry.id,
                    resizeShapeFromHandle(
                      activeEntry.shape!,
                      index,
                      event.nativeEvent.coordinate,
                    ),
                  );
                }}
              >
                <ZoneHandleMarker />
              </Marker>
            ))
          : null}

        {!editorActive
          ? Array.from(locationGroups.entries()).map(([key, group]) => {
              const vehicle = group[0];
              const count = group.length;
              const isSelected = selectedId && group.some((v) => v.id === selectedId);
              return (
                <Marker
                  key={key}
                  coordinate={{
                    latitude: vehicle.latitude,
                    longitude: vehicle.longitude,
                  }}
                  pinColor={isSelected ? colors.mapPinSelected : colors.mapPin}
                  title={
                    count > 1
                      ? `${count} vehicles`
                      : formatVinPrimary(vehicle.vin, vehicle.vinSuffix)
                  }
                  description={
                    count > 1
                      ? "Tap to choose which vehicle"
                      : formatVehicleTitle(getVehicleDisplay(vehicle))
                  }
                  onPress={() => handleMarkerPress(vehicle)}
                />
              );
            })
          : null}
      </MapView>

      <View style={[styles.topOverlay, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.topChipsRow}
          pointerEvents="box-none"
        >
          <View style={styles.mapBadge}>
            <Text style={styles.mapBadgeText}>
              {vehicles.length} vehicle{vehicles.length === 1 ? "" : "s"}
              {zoneFilterId ? ` · ${zoneById.get(zoneFilterId)?.name ?? "zone"}` : ""}
            </Text>
          </View>

          <Chip
            label="All zones"
            selected={!zoneFilterId}
            onPress={() => setZoneFilterId(null)}
          />
          {zones.map((zone) => (
            <Pressable
              key={zone.id}
              onPress={() => promptZoneChipActions(zone)}
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

        {editorActive ? (
          <View style={styles.drawToolbarWrap}>
            <MapDrawToolbar
              visible={editorActive}
              tool={editorTool}
              editing={editorMode === "edit"}
              shapeCount={draftPolygons.length}
              onSelectTool={setEditorTool}
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

        {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
      </View>

      {selected && selectedDisplay && !editorActive ? (
        <MotiView
          from={{ opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          style={[styles.selectedPanel, { top: insets.top + 108 }]}
        >
          <Text style={styles.selectedVin}>
            {formatVinPrimary(selected.vin, selected.vinSuffix)}
          </Text>
          <Text style={styles.selectedModel}>
            {formatVehicleTitle(selectedDisplay)}
          </Text>
          <Text style={styles.selectedDetail}>
            {selectedDisplay.color}
            {selectedZoneName ? ` · ${selectedZoneName}` : ""}
          </Text>
          <Button
            label="View scan log"
            compact
            onPress={() => openVehicle(selected.vinSuffix)}
          />
        </MotiView>
      ) : null}

      {!editorActive ? (
        <>
          <Pressable
            style={[styles.locateFab, { bottom: 160 + insets.bottom }]}
            onPress={() => void centerOnMyLocation()}
            accessibilityLabel="Center map on my location"
          >
            <Ionicons
              name="locate"
              size={22}
              color={locationReady ? colors.primary : colors.textMuted}
            />
          </Pressable>
          <Pressable
            style={[styles.fab, { bottom: 96 + insets.bottom }]}
            onPress={promptZoneFab}
            accessibilityLabel="Manage lot zones"
          >
            <Ionicons name="create-outline" size={24} color={colors.onPrimary} />
          </Pressable>
        </>
      ) : null}

      {!editorActive ? (
        <MapVehicleSheet
          vehicles={filtered}
          selectedId={selectedId}
          zoneLabelForVehicle={zoneLabelForVehicle}
          search={search}
          onSearchChange={setSearch}
          onSelectVehicle={(vehicle) => setSelectedId(vehicle.id)}
          onOpenVehicle={openVehicle}
          onFocusVehicle={focusVehicle}
        />
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

      <VehicleEditorModal
        vehicle={editing}
        visible={Boolean(editing)}
        onClose={() => setEditing(null)}
        onSave={handleSave}
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
  mapBadge: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  mapBadgeText: { fontSize: 12, fontWeight: "700", color: colors.primaryDark },
  drawToolbarWrap: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
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
  selectedPanel: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderWidth: 2,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.sheet,
  },
  selectedVin: {
    ...typography.vin,
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
  },
  selectedModel: { fontWeight: "700", marginTop: spacing.xs, fontSize: 16, color: colors.text },
  selectedDetail: { color: colors.textSecondary, marginTop: 2, fontSize: 13, marginBottom: spacing.sm },
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
  locateFab: {
    position: "absolute",
    right: spacing.lg,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.card,
  },
});
