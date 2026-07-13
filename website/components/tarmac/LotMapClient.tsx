"use client";

import "leaflet/dist/leaflet.css";

import { useMemo } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";

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

function ClickCapture({
  enabled,
  onMapClick,
}: {
  enabled: boolean;
  onMapClick: (point: Point) => void;
}) {
  useMapEvents({
    click(e) {
      if (!enabled) return;
      onMapClick({ latitude: e.latlng.lat, longitude: e.latlng.lng });
    },
  });
  return null;
}

const draftIcon = L.divIcon({
  className: "draft-vertex",
  html: '<span style="display:block;width:10px;height:10px;border-radius:50%;background:#0D9488;border:2px solid #ecfdf5;"></span>',
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

export default function LotMapClient({ zones, vehicles, draft, drawing, onMapClick }: Props) {
  const center = useMemo((): [number, number] => {
    const pin = vehicles.find((v) => Number.isFinite(v.latitude) && Number.isFinite(v.longitude));
    if (pin) return [pin.latitude, pin.longitude];
    const zonePoint = zones[0]?.polygons[0]?.[0];
    if (zonePoint) return [zonePoint.latitude, zonePoint.longitude];
    return [39.8283, -98.5795];
  }, [vehicles, zones]);

  return (
    <MapContainer
      center={center}
      zoom={vehicles.length || zones.length ? 17 : 4}
      style={{ height: "100%", width: "100%", borderRadius: 8 }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickCapture enabled={drawing} onMapClick={onMapClick} />

      {zones.map((zone) =>
        zone.polygons.map((polygon, index) => (
          <Polygon
            key={`${zone.id}-${index}`}
            positions={polygon.map((p) => [p.latitude, p.longitude] as [number, number])}
            pathOptions={{
              color: zone.strokeColor,
              fillColor: zone.fillColor,
              fillOpacity: 0.45,
              weight: 2,
            }}
          >
            <Popup>{zone.name}</Popup>
          </Polygon>
        )),
      )}

      {vehicles.map((vehicle) => (
        <CircleMarker
          key={vehicle.id}
          center={[vehicle.latitude, vehicle.longitude]}
          radius={7}
          pathOptions={{
            color: vehicle.matched ? "#0D9488" : "#F59E0B",
            fillColor: vehicle.matched ? "#14B8A6" : "#FBBF24",
            fillOpacity: 0.9,
            weight: 2,
          }}
        >
          <Popup>
            <strong>{vehicle.model}</strong>
            <br />
            {vehicle.color} · …{vehicle.vinSuffix}
          </Popup>
        </CircleMarker>
      ))}

      {draft.length >= 2 ? (
        <Polyline
          positions={draft.map((p) => [p.latitude, p.longitude] as [number, number])}
          pathOptions={{ color: "#0D9488", dashArray: "6 6", weight: 2 }}
        />
      ) : null}

      {draft.map((point, index) => (
        <Marker
          key={`draft-${index}`}
          position={[point.latitude, point.longitude]}
          icon={draftIcon}
        />
      ))}
    </MapContainer>
  );
}
