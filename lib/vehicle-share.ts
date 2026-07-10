import type { ScannedVehicle } from "@/lib/types";
import { formatFullVin } from "@/lib/vin-display";
import { formatVehicleTitle, getVehicleDisplay } from "@/lib/vehicle-display";

export function getCopyableVin(
  vehicle: Pick<ScannedVehicle, "vin" | "vinSuffix">,
): string {
  return formatFullVin(vehicle.vin) ?? vehicle.vinSuffix.toUpperCase();
}

export function buildVehicleShareText(vehicle: ScannedVehicle): string {
  const display = getVehicleDisplay(vehicle);
  const title = formatVehicleTitle(display);
  const vin = getCopyableVin(vehicle);
  const mapsUrl = `https://maps.google.com/?q=${vehicle.latitude},${vehicle.longitude}`;
  const scanned = new Date(vehicle.scannedAt).toLocaleString();

  return [
    title,
    `Color: ${display.color}`,
    `VIN: ${vin}`,
    `Scans: ${vehicle.scanCount}`,
    `Last scanned: ${scanned}`,
    `Location: ${vehicle.latitude.toFixed(5)}, ${vehicle.longitude.toFixed(5)}`,
    mapsUrl,
  ].join("\n");
}
