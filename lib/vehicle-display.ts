import type { InventoryItem } from "@/lib/types";

export type VehicleDisplay = {
  year: string | null;
  name: string;
  color: string;
};

export function getVehicleDisplay(
  item: Pick<InventoryItem, "model" | "color" | "year">,
): VehicleDisplay {
  const model = item.model?.trim() || "Unknown";
  const color = item.color?.trim() || "Unknown";
  const yearFromField = item.year ?? null;

  const yearPrefix = model.match(/^((?:19|20)\d{2})\s+(.+)$/);

  if (yearFromField) {
    const name =
      yearPrefix && Number(yearPrefix[1]) === yearFromField
        ? yearPrefix[2]
        : model.replace(/^(?:19|20)\d{2}\s+/, "");
    return {
      year: String(yearFromField),
      name: name || model,
      color,
    };
  }

  if (yearPrefix) {
    return {
      year: yearPrefix[1],
      name: yearPrefix[2] || model,
      color,
    };
  }

  return { year: null, name: model, color };
}

export function formatVehicleTitle(display: VehicleDisplay): string {
  if (display.year) {
    return `${display.year} ${display.name}`;
  }
  return display.name;
}
