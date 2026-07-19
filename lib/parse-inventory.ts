import type { InventoryItem, ParseResult } from "./types";

const PRICE_LIST_HEADER = /VIN6|MILES ON LOT|PRICE\s*LIST/i;
const VEHICLE_LINE_PATTERN = /^(\d{2})\s+(.+)$/;

const TRUNCATED_COLORS: Record<string, string> = {
  SILVE: "Silver",
  ORANG: "Orange",
  GRA: "Gray",
  GRE: "Gray",
  BLAC: "Black",
  WHIT: "White",
  BLU: "Blue",
  RED: "Red",
  GREE: "Green",
  YELL: "Yellow",
  BROW: "Brown",
  BEIG: "Beige",
  GOLD: "Gold",
  CHAR: "Charcoal",
  BURG: "Burgundy",
  PURP: "Purple",
};

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

const VIN_SUFFIX_PATTERN = /\b[A-HJ-NPR-Z0-9]{6}\b/gi;

const DAYS_PATTERN =
  /\b(\d{1,4})\s*(?:days?\s+on\s+lot|dol)\b|(?:\bdol[:\s]*)(\d{1,4})\b/i;

const YEAR_MODEL_PATTERN =
  /\b((?:19|20)\d{2})\s+([A-Za-z][\w\s./\-&']+?)(?=\s{2,}|\s+(?:Black|White|Silver|Gray|Grey|Blue|Red|Green|Gold|Brown|Beige|Tan|Orange|Purple|Charcoal|Platinum|Bronze|Copper|Burgundy|Maroon|Yellow|Violet|Green)\b|\d{1,4}\s*$|$)/i;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeColor(color: string): string {
  const upper = color.toUpperCase();
  if (TRUNCATED_COLORS[upper]) {
    return TRUNCATED_COLORS[upper];
  }

  const full = findColor(color);
  return full ?? color.charAt(0).toUpperCase() + color.slice(1).toLowerCase();
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

function parsePriceListLine(line: string): InventoryItem | null {
  const match = line.match(VEHICLE_LINE_PATTERN);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const remainder = match[2].trim();
  const tokens = remainder.split(/\s+/);
  if (tokens.length < 3) {
    return null;
  }

  const daysOnLot = Number(tokens.at(-1)?.replace(/,/g, ""));
  if (Number.isNaN(daysOnLot)) {
    return null;
  }

  const milesToken = tokens.at(-2)?.replace(/,/g, "") ?? "";
  const miles = /^\d+$/.test(milesToken) ? Number(milesToken) : null;

  const vinSuffix = (tokens.at(-3) ?? "").toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(vinSuffix)) {
    return null;
  }

  const beforeVin = tokens.slice(0, -3);
  let color = "Unknown";
  let modelTokens = beforeVin;

  if (beforeVin.length > 0) {
    const lastToken = beforeVin.at(-1) ?? "";
    if (/^[A-Z]{3,6}$/i.test(lastToken) && !/^\d+$/.test(lastToken)) {
      color = normalizeColor(lastToken);
      modelTokens = beforeVin.slice(0, -1);
    }
  }

  const model = normalizeWhitespace(
    `${year + (year >= 70 ? 1900 : 2000)} ${modelTokens.join(" ")}`,
  );

  return {
    vinSuffix,
    model: model || "Unknown",
    color,
    daysOnLot,
    miles,
    year: year + (year >= 70 ? 1900 : 2000),
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
      miles: existing.miles ?? item.miles,
      year: existing.year ?? item.year,
    });
  }

  return Array.from(byVin.values()).sort((a, b) =>
    a.vinSuffix.localeCompare(b.vinSuffix),
  );
}

function parseGenericInventoryText(text: string): InventoryItem[] {
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

    for (const vinMatch of matches) {
      const vinSuffix = vinMatch[0];
      items.push(parseLine(line, vinSuffix));
    }
  }

  return items;
}

function parsePriceListText(text: string): InventoryItem[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  const items: InventoryItem[] = [];

  for (const line of lines) {
    if (
      line.startsWith("Page:") ||
      line.startsWith("Report:") ||
      line.startsWith("--") ||
      line.includes("-----") ||
      /^DAYS$/i.test(line)
    ) {
      continue;
    }

    const item = parsePriceListLine(line);
    if (item) {
      items.push(item);
    }
  }

  return items;
}

export function parseInventoryText(text: string): ParseResult {
  const isPriceList = PRICE_LIST_HEADER.test(text);
  const items = mergeItems(
    isPriceList ? parsePriceListText(text) : parseGenericInventoryText(text),
  );

  return {
    items,
    rawTextPreview: text.slice(0, 500),
    totalLines: text.split(/\r?\n/).filter(Boolean).length,
    warnings: [],
    detectedSource: isPriceList ? "frazer" : "unknown",
    detectedColumns: isPriceList
      ? ["vinSuffix", "model", "color", "daysOnLot", "miles", "year"]
      : ["vinSuffix", "model", "color", "daysOnLot"],
    parserName: isPriceList ? "frazer-pdf" : "generic-pdf",
    parserVersion: "1",
  };
}
