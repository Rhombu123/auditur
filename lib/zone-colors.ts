export type ZoneColorOption = {
  id: string;
  label: string;
  fill: string;
  stroke: string;
};

export const ZONE_COLOR_OPTIONS: ZoneColorOption[] = [
  { id: "teal", label: "Teal", fill: "rgba(13, 148, 136, 0.35)", stroke: "#0D9488" },
  { id: "blue", label: "Blue", fill: "rgba(59, 130, 246, 0.35)", stroke: "#3B82F6" },
  { id: "amber", label: "Amber", fill: "rgba(245, 158, 11, 0.35)", stroke: "#F59E0B" },
  { id: "violet", label: "Violet", fill: "rgba(139, 92, 246, 0.35)", stroke: "#8B5CF6" },
  { id: "rose", label: "Rose", fill: "rgba(244, 63, 94, 0.35)", stroke: "#F43F5E" },
  { id: "green", label: "Green", fill: "rgba(34, 197, 94, 0.35)", stroke: "#22C55E" },
  { id: "orange", label: "Orange", fill: "rgba(249, 115, 22, 0.35)", stroke: "#F97316" },
  { id: "slate", label: "Slate", fill: "rgba(100, 116, 139, 0.35)", stroke: "#64748B" },
];

export function zoneColorByIndex(index: number): ZoneColorOption {
  return ZONE_COLOR_OPTIONS[index % ZONE_COLOR_OPTIONS.length];
}

export function parseColorToRgb(input: string): { r: number; g: number; b: number; a: number } {
  const hex = input.trim();
  if (hex.startsWith("#")) {
    const value = hex.slice(1);
    const full =
      value.length === 3
        ? value
            .split("")
            .map((c) => c + c)
            .join("")
        : value;
    const num = Number.parseInt(full, 16);
    return {
      r: ((num >> 16) & 255) / 255,
      g: ((num >> 8) & 255) / 255,
      b: (num & 255) / 255,
      a: 1,
    };
  }

  const rgba = hex.match(/rgba?\(([^)]+)\)/i);
  if (rgba) {
    const [r, g, b, a] = rgba[1].split(",").map((part) => Number.parseFloat(part.trim()));
    return {
      r: (r ?? 0) / 255,
      g: (g ?? 0) / 255,
      b: (b ?? 0) / 255,
      a: a ?? 1,
    };
  }

  return { r: 0.2, g: 0.2, b: 0.2, a: 0.3 };
}
