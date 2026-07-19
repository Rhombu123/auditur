import { extractPdfText } from "./extract-pdf-text.js";
import { CsvInventoryError, parseInventoryCsv } from "./parse-inventory-csv.js";
import { parseInventoryText } from "./parse-inventory.js";
import type {
  ImportFileFormat,
  ImportMethod,
  InventoryItem,
  ParseResult,
} from "./types";

export type InventoryImportResult = {
  items: InventoryItem[];
  fileFormat: ImportFileFormat;
  contentType: "application/pdf" | "text/csv";
  sourceSystem: string;
  importMethod: ImportMethod;
  warnings: string[];
  detectedColumns: string[];
  parserMetadata: Record<string, unknown>;
  rawTextPreview: string;
  totalLines: number;
};

export class InventoryImportError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 422,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

function detectFormat(buffer: Buffer, fileName: string): ImportFileFormat | null {
  const extension = fileName.toLowerCase().split(".").at(-1);
  if (buffer.subarray(0, 4).toString("ascii") === "%PDF") return "pdf";
  if (extension === "pdf") return "pdf";
  if (extension === "csv") return "csv";
  const preview = buffer.subarray(0, 4096);
  if (
    !preview.includes(0) &&
    preview
      .toString("utf8")
      .split(/\r?\n/, 1)[0]
      ?.includes(",")
  ) {
    return "csv";
  }
  return null;
}

function mergeItem(existing: InventoryItem, incoming: InventoryItem): InventoryItem {
  return {
    vin: existing.vin ?? incoming.vin ?? null,
    vinSuffix: existing.vinSuffix,
    stockNumber: existing.stockNumber ?? incoming.stockNumber ?? null,
    make: existing.make ?? incoming.make ?? null,
    model: existing.model === "Unknown" ? incoming.model : existing.model,
    color: existing.color === "Unknown" ? incoming.color : existing.color,
    sourceStatus: existing.sourceStatus ?? incoming.sourceStatus ?? null,
    daysOnLot: existing.daysOnLot ?? incoming.daysOnLot,
    miles: existing.miles ?? incoming.miles,
    year: existing.year ?? incoming.year,
  };
}

function validateAndDedupe(
  parsed: ParseResult,
): { items: InventoryItem[]; warnings: string[] } {
  const warnings = [...(parsed.warnings ?? [])];
  const bySuffix = new Map<string, InventoryItem>();

  for (const item of parsed.items) {
    const vinSuffix = item.vinSuffix.trim().toUpperCase();
    const vin = item.vin?.trim().toUpperCase() || null;
    if (!/^[A-HJ-NPR-Z0-9]{6}$/.test(vinSuffix)) {
      warnings.push(`Skipped an item with invalid VIN suffix "${item.vinSuffix}".`);
      continue;
    }
    if (vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
      warnings.push(`VIN ${vinSuffix}: ignored invalid full VIN "${item.vin}".`);
    }

    const normalized: InventoryItem = {
      ...item,
      vin: vin && /^[A-HJ-NPR-Z0-9]{17}$/.test(vin) ? vin : null,
      vinSuffix,
      stockNumber: item.stockNumber?.trim() || null,
      make: item.make?.trim() || null,
      model: item.model.trim() || "Unknown",
      color: item.color.trim() || "Unknown",
      sourceStatus: item.sourceStatus?.trim() || null,
      daysOnLot:
        item.daysOnLot !== null && item.daysOnLot >= 0 ? item.daysOnLot : null,
      miles:
        item.miles !== null && item.miles !== undefined && item.miles >= 0
          ? item.miles
          : null,
      year:
        item.year !== null &&
        item.year !== undefined &&
        item.year >= 1886 &&
        item.year <= 2200
          ? item.year
          : null,
    };

    const existing = bySuffix.get(vinSuffix);
    if (existing) {
      if (existing.vin && normalized.vin && existing.vin !== normalized.vin) {
        warnings.push(
          `VIN ${vinSuffix}: two full VINs share this suffix; kept ${existing.vin} and ignored ${normalized.vin}.`,
        );
      }
      warnings.push(`VIN ${vinSuffix}: merged a duplicate row.`);
      bySuffix.set(vinSuffix, mergeItem(existing, normalized));
    } else {
      bySuffix.set(vinSuffix, normalized);
    }
  }

  return {
    items: [...bySuffix.values()].sort((a, b) =>
      a.vinSuffix.localeCompare(b.vinSuffix),
    ),
    warnings,
  };
}

async function parseWithAdapter(
  buffer: Buffer,
  format: ImportFileFormat,
): Promise<ParseResult> {
  if (format === "pdf") {
    const text = await extractPdfText(buffer);
    const parsed = parseInventoryText(text);
    return {
      ...parsed,
      warnings: parsed.warnings ?? [],
      detectedSource: parsed.detectedSource ?? "unknown",
      detectedColumns: parsed.detectedColumns ?? ["vinSuffix", "model", "color"],
      parserName: parsed.parserName ?? "frazer-pdf",
      parserVersion: parsed.parserVersion ?? "1",
    };
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return parseInventoryCsv(text);
  } catch (error) {
    if (error instanceof CsvInventoryError) {
      throw new InventoryImportError(error.message, 422);
    }
    if (error instanceof TypeError) {
      throw new InventoryImportError("Upload a valid UTF-8 CSV file.", 400);
    }
    throw error;
  }
}

export async function importInventoryBuffer(
  buffer: Buffer,
  fileName: string,
): Promise<InventoryImportResult> {
  if (buffer.length === 0) {
    throw new InventoryImportError("The selected file is empty.", 400);
  }

  const fileFormat = detectFormat(buffer, fileName);
  if (!fileFormat) {
    throw new InventoryImportError("Choose a PDF or CSV audit file.", 400);
  }
  if (
    fileFormat === "pdf" &&
    buffer.subarray(0, 4).toString("ascii") !== "%PDF"
  ) {
    throw new InventoryImportError("Upload a valid PDF file.", 400);
  }
  if (fileFormat === "csv" && buffer.includes(0)) {
    throw new InventoryImportError("Upload a valid UTF-8 CSV file.", 400);
  }

  const parsed = await parseWithAdapter(buffer, fileFormat);
  const normalized = validateAndDedupe(parsed);
  if (normalized.items.length === 0) {
    throw new InventoryImportError(
      fileFormat === "pdf"
        ? "No inventory records found. The PDF may use a format we cannot parse yet."
        : "No valid inventory records were found in the CSV.",
      422,
      {
        rawTextPreview: parsed.rawTextPreview,
        totalLines: parsed.totalLines,
        warnings: normalized.warnings,
        detectedColumns: parsed.detectedColumns ?? [],
      },
    );
  }

  return {
    items: normalized.items,
    fileFormat,
    contentType: fileFormat === "pdf" ? "application/pdf" : "text/csv",
    sourceSystem: parsed.detectedSource ?? "unknown",
    importMethod: "manual",
    warnings: normalized.warnings,
    detectedColumns: parsed.detectedColumns ?? [],
    parserMetadata: {
      parserName: parsed.parserName ?? `${fileFormat}-unknown`,
      parserVersion: parsed.parserVersion ?? "1",
      detectedColumns: parsed.detectedColumns ?? [],
      warningCount: normalized.warnings.length,
      totalLines: parsed.totalLines,
    },
    rawTextPreview: parsed.rawTextPreview,
    totalLines: parsed.totalLines,
  };
}
