import type { InventoryItem, ParseResult } from "./types";

const PARSER_NAME = "generic-csv";
const PARSER_VERSION = "1";

const HEADER_ALIASES = {
  vin: [
    "vin",
    "fullvin",
    "vehicleidentificationnumber",
    "vinsuffix",
    "vin6",
    "last6",
    "last6ofvin",
    "vinlast6",
    "lastsix",
    "lastsixofvin",
  ],
  stockNumber: [
    "stock",
    "stocknumber",
    "stockno",
    "stocknum",
    "stk",
    "unit",
    "unitnumber",
    "unitno",
  ],
  year: ["year", "modelyear"],
  make: ["make", "manufacturer"],
  model: ["model", "vehicle", "vehicledescription", "description"],
  color: ["color", "colour", "exteriorcolor", "exteriorcolour", "extcolor", "extcolour", "vehiclecolor"],
  sourceStatus: ["status", "currentstatus", "vehiclestatus", "inventorystatus", "stockstatus"],
  daysOnLot: [
    "daysonlot",
    "days",
    "dol",
    "age",
    "inventoryage",
    "inventorydays",
    "daysininventory",
  ],
  miles: ["miles", "mileage", "odometer", "odometerreading"],
} as const;

type CanonicalColumn = keyof typeof HEADER_ALIASES;
type ColumnIndexes = Partial<Record<CanonicalColumn, number>>;

export class CsvInventoryError extends Error {}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .replace(/[^a-z0-9]/g, "");
}

function parseCsvRows(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let closedQuote = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (closedQuote) {
      if (character === " " || character === "\t") continue;
      if (character !== "," && character !== "\n" && character !== "\r") {
        throw new CsvInventoryError(
          "The CSV contains unexpected text after a quoted value. Export it again and retry.",
        );
      }
    }

    if (character === '"' && field.length === 0 && !closedQuote) {
      quoted = true;
    } else if (character === '"') {
      throw new CsvInventoryError(
        "The CSV contains a quote inside an unquoted value. Export it again and retry.",
      );
    } else if (character === ",") {
      row.push(field);
      field = "";
      closedQuote = false;
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim().length > 0)) rows.push(row);
      row = [];
      field = "";
      closedQuote = false;
    } else {
      field += character;
    }
  }

  if (quoted) {
    throw new CsvInventoryError(
      "The CSV contains an unterminated quoted field. Export it again and retry.",
    );
  }

  row.push(field);
  if (row.some((value) => value.trim().length > 0)) rows.push(row);
  return rows;
}

function findColumns(headers: string[]): ColumnIndexes {
  const normalized = headers.map(normalizeHeader);
  const columns: ColumnIndexes = {};
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES) as [
    CanonicalColumn,
    readonly string[],
  ][]) {
    const index = normalized.findIndex((header) => aliases.includes(header));
    if (index >= 0) columns[canonical] = index;
  }
  return columns;
}

function valueAt(row: string[], index: number | undefined): string {
  return index === undefined ? "" : (row[index] ?? "").trim();
}

function parseOptionalInteger(
  value: string,
  label: string,
  rowNumber: number,
  warnings: string[],
): number | null {
  if (!value) return null;
  const normalized = value.replace(/[,\s]/g, "");
  if (!/^\d+$/.test(normalized)) {
    warnings.push(`Row ${rowNumber}: ignored invalid ${label} "${value}".`);
    return null;
  }
  return Number(normalized);
}

function normalizeVin(value: string): string | null {
  const normalized = value.toUpperCase().replace(/\s/g, "");
  return /^[A-HJ-NPR-Z0-9]{6,17}$/.test(normalized) ? normalized : null;
}

function displayModel(
  year: number | null,
  make: string,
  model: string,
): string {
  const modelLower = model.toLowerCase();
  const parts = [
    year && !model.includes(String(year)) ? String(year) : "",
    make && !modelLower.includes(make.toLowerCase()) ? make : "",
    model,
  ].filter(Boolean);
  return parts.join(" ").replace(/\s+/g, " ").trim() || "Unknown";
}

export function parseInventoryCsv(text: string): ParseResult {
  const rows = parseCsvRows(text);
  if (rows.length === 0) {
    throw new CsvInventoryError("The CSV is empty.");
  }

  const headers = rows[0];
  const columns = findColumns(headers);
  if (columns.vin === undefined) {
    throw new CsvInventoryError(
      "CSV is missing a VIN column. Use a header such as VIN, Full VIN, VIN6, VIN Suffix, or Last 6.",
    );
  }

  const warnings: string[] = [];
  const items: InventoryItem[] = [];
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 1;
    const rawVin = valueAt(row, columns.vin);
    const normalizedVin = normalizeVin(rawVin);
    if (!normalizedVin) {
      warnings.push(
        `Row ${rowNumber}: skipped because VIN "${rawVin || "(blank)"}" is not a valid 6–17 character VIN.`,
      );
      continue;
    }

    const year = parseOptionalInteger(
      valueAt(row, columns.year),
      "year",
      rowNumber,
      warnings,
    );
    const validYear = year !== null && (year < 1886 || year > 2200) ? null : year;
    if (year !== null && validYear === null) {
      warnings.push(`Row ${rowNumber}: ignored year outside 1886–2200.`);
    }
    const make = valueAt(row, columns.make);
    const model = valueAt(row, columns.model);
    const miles = parseOptionalInteger(
      valueAt(row, columns.miles),
      "mileage",
      rowNumber,
      warnings,
    );
    const daysOnLot = parseOptionalInteger(
      valueAt(row, columns.daysOnLot),
      "days on lot",
      rowNumber,
      warnings,
    );

    items.push({
      vin: normalizedVin.length === 17 ? normalizedVin : null,
      vinSuffix: normalizedVin.slice(-6),
      stockNumber: valueAt(row, columns.stockNumber) || null,
      make: make || null,
      model: displayModel(validYear, make, model),
      color: valueAt(row, columns.color) || "Unknown",
      sourceStatus: valueAt(row, columns.sourceStatus) || null,
      daysOnLot,
      miles,
      year: validYear,
    });
  }

  return {
    items,
    rawTextPreview: text.slice(0, 500),
    totalLines: rows.length,
    warnings,
    detectedSource: headers.some((header) => /frazer/i.test(header))
      ? "frazer"
      : "unknown",
    detectedColumns: (Object.keys(columns) as CanonicalColumn[]).filter(
      (column) => columns[column] !== undefined,
    ),
    parserName: PARSER_NAME,
    parserVersion: PARSER_VERSION,
  };
}
