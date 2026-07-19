import type { ScannedVehicle } from "@/lib/types";
import { formatFullVin } from "@/lib/vin-display";
import { formatVehicleTitle, getVehicleDisplay } from "@/lib/vehicle-display";

export function getCopyableVin(
  vehicle: Pick<ScannedVehicle, "vin" | "vinSuffix">,
): string {
  return formatFullVin(vehicle.vin) ?? vehicle.vinSuffix.toUpperCase();
}

function formatSharedScanTime(value: string): string {
  const date = new Date(value);
  return `${date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
  })} ${date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export function buildVehicleShareText(
  vehicle: ScannedVehicle,
  sectionName?: string | null,
): string {
  const display = getVehicleDisplay(vehicle);
  const title = formatVehicleTitle(display);
  const vin = getCopyableVin(vehicle);
  const scanned = formatSharedScanTime(vehicle.scannedAt);

  return [
    title,
    `Color: ${display.color}`,
    `VIN: ${vin}`,
    `Scans: ${vehicle.scanCount}`,
    `Last scanned: ${scanned}`,
    `Section: ${sectionName ?? "Unassigned"}`,
  ].join("\n");
}
