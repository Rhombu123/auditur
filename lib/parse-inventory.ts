import type { InventoryItem, ParseResult } from "./types";

const VIN_SUFFIX_PATTERN = /\b[A-HJ-NPR-Z0-9]{6}\b/gi;

const COLOR_NAMES = [
  "Crystal White Pearl",
  "Pearl White",
  "Metallic Silver",
  "Silver Metallic",
  "Magnetic Gray",
  "Gun Metallic",
  "Summit White",
  "Oxford White",
  "Super White",
  "Bright White",
  "Alpine White",
  "Glacier White",
  "Arctic White",
  "Tuxedo Black",
  "Jet Black",
  "Midnight Black",
  "Charcoal",
  "Graphite",
  "Platinum",
  "Champagne",
  "Burgundy",
  "Maroon",
  "Bronze",
  "Copper",
  "Champagne",
  "Beige",
  "Tan",
  "Brown",
  "Gold",
  "Yellow",
  "Orange",
  "Purple",
  "Violet",
  "Green",
  "Blue",
  "Red",
  "Gray",
  "Grey",
  "Silver",
  "White",
  "Black",
].sort((a, b) => b.length - a.length);

const HEADER_PATTERN =
  /\b(?:vin|stock|model|color|days|inventory|vehicle|description|mileage|year|make)\b/gi;

const DAYS_PATTERN =
  /\b(\d{1,4})\s*(?:days?\s+on\s+lot|dol)\b|(?:\bdol[:\s]*)(\d{1,4})\b/i;

const YEAR_MODEL_PATTERN =
  /\b((?:19|20)\d{2})\s+([A-Za-z][\w\s./\-&']+?)(?=\s{2,}|\s+(?:Black|White|Silver|Gray|Grey|Blue|Red|Green|Gold|Brown|Beige|Tan|Orange|Purple|Charcoal|Platinum|Bronze|Copper|Burgundy|Maroon|Yellow|Violet|Green)\b|\d{1,4}\s*$|$)/i;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isLikelyHeader(line: string): boolean {
  const matches = line.match(HEADER_PATTERN);
  return Boolean(matches && matches.length >= 2);
}

function findColor(text: string): string | null {
  const lower = text.toLowerCase();
  for (const color of COLOR_NAMES) {
    const index = lower.indexOf(color.toLowerCase());
    if (index !== -1) {
      return color;
    }
  }
  return null;
}

function findDaysOnLot(text: string): number | null {
  const match = text.match(DAYS_PATTERN);
  if (match) {
    const value = Number(match[1] ?? match[2]);
    if (!Number.isNaN(value) && value >= 0 && value <= 9999) {
      return value;
    }
  }

  const trailingNumber = text.match(/\b(\d{1,4})\s*$/);
  if (trailingNumber) {
    const value = Number(trailingNumber[1]);
    if (value >= 0 && value <= 999) {
      return value;
    }
  }

  return null;
}

function findModel(text: string, color: string | null): string {
  let working = text;

  if (color) {
    const colorIndex = working.toLowerCase().indexOf(color.toLowerCase());
    if (colorIndex > 0) {
      working = working.slice(0, colorIndex);
    }
  }

  const yearModelMatch = working.match(YEAR_MODEL_PATTERN);
  if (yearModelMatch) {
    return normalizeWhitespace(`${yearModelMatch[1]} ${yearModelMatch[2]}`);
  }

  const withoutVin = working.replace(VIN_SUFFIX_PATTERN, " ");
  const cleaned = normalizeWhitespace(
    withoutVin.replace(/\b\d{1,4}\b/g, " ").replace(/[|,;:]+/g, " "),
  );

  const words = cleaned.split(" ").filter(Boolean);
  if (words.length === 0) {
    return "Unknown";
  }

  return words.slice(0, 6).join(" ");
}

function parseLine(line: string, vinSuffix: string): InventoryItem {
  const color = findColor(line);
  const daysOnLot = findDaysOnLot(line);
  const model = findModel(line, color);

  return {
    vinSuffix: vinSuffix.toUpperCase(),
    model,
    color: color ?? "Unknown",
    daysOnLot,
  };
}

function mergeItems(items: InventoryItem[]): InventoryItem[] {
  const byVin = new Map<string, InventoryItem>();

  for (const item of items) {
    const existing = byVin.get(item.vinSuffix);
    if (!existing) {
      byVin.set(item.vinSuffix, item);
      continue;
    }

    byVin.set(item.vinSuffix, {
      vinSuffix: item.vinSuffix,
      model: existing.model === "Unknown" ? item.model : existing.model,
      color: existing.color === "Unknown" ? item.color : existing.color,
      daysOnLot: existing.daysOnLot ?? item.daysOnLot,
    });
  }

  return Array.from(byVin.values()).sort((a, b) =>
    a.vinSuffix.localeCompare(b.vinSuffix),
  );
}

export function parseInventoryText(text: string): ParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  const items: InventoryItem[] = [];

  for (const line of lines) {
    if (isLikelyHeader(line)) {
      continue;
    }

    const matches = [...line.matchAll(VIN_SUFFIX_PATTERN)];
    if (matches.length === 0) {
      continue;
    }

    for (const match of matches) {
      const vinSuffix = match[0];
      if (/^\d{6}$/.test(vinSuffix) && Number(vinSuffix) < 100000) {
        continue;
      }

      items.push(parseLine(line, vinSuffix));
    }
  }

  return {
    items: mergeItems(items),
    rawTextPreview: text.slice(0, 500),
    totalLines: lines.length,
  };
}
