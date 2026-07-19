import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  importInventoryBuffer,
  InventoryImportError,
} from "../lib/inventory-import";
import { buildHighlightedAuditPdf } from "../lib/export-highlighted-pdf";
import {
  CsvInventoryError,
  parseInventoryCsv,
} from "../lib/parse-inventory-csv";
import { parseInventoryText } from "../lib/parse-inventory";
import { runUploadBuffer } from "../lib/upload-handler";

test("preserves Frazer price-list parsing", () => {
  const parsed = parseInventoryText(`
PRICE LIST
YR MODEL COLOR VIN6 MILES ON LOT DAYS
22 F150 XLT BLAC ABC123 42,100 18
21 CAMRY LE WHIT DEF456 31,002 9
`);

  assert.equal(parsed.detectedSource, "frazer");
  assert.equal(parsed.parserName, "frazer-pdf");
  assert.deepEqual(parsed.items, [
    {
      vinSuffix: "ABC123",
      model: "2022 F150 XLT",
      color: "Black",
      daysOnLot: 18,
      miles: 42100,
      year: 2022,
    },
    {
      vinSuffix: "DEF456",
      model: "2021 CAMRY LE",
      color: "White",
      daysOnLot: 9,
      miles: 31002,
      year: 2021,
    },
  ]);
});

test("parses BOM, aliases, full VINs, and quoted commas", () => {
  const parsed = parseInventoryCsv(
    '\uFEFFFull VIN,Stock #,Model Year,Manufacturer,Vehicle Description,Exterior Color,Inventory Status,Inventory Age,Odometer\n' +
      '"1HGCM82633A004352","A-10",2023,Honda,"Accord, Touring","Crystal White Pearl",Available,12,"1,234"\n',
  );

  assert.deepEqual(parsed.detectedColumns, [
    "vin",
    "stockNumber",
    "year",
    "make",
    "model",
    "color",
    "sourceStatus",
    "daysOnLot",
    "miles",
  ]);
  assert.deepEqual(parsed.items[0], {
    vin: "1HGCM82633A004352",
    vinSuffix: "004352",
    stockNumber: "A-10",
    make: "Honda",
    model: "2023 Honda Accord, Touring",
    color: "Crystal White Pearl",
    sourceStatus: "Available",
    daysOnLot: 12,
    miles: 1234,
    year: 2023,
  });
});

test("parses generic and alternate DMS-neutral headers with statuses", () => {
  const generic = parseInventoryCsv(
    "VIN,Stock Number,Year,Make,Model,Color,Status,Days On Lot,Mileage\n" +
      "ABC123,S-1,2022,Ford,F-150,Blue,Available,42,12000\n",
  );
  assert.deepEqual(generic.items[0], {
    vin: null,
    vinSuffix: "ABC123",
    stockNumber: "S-1",
    make: "Ford",
    model: "2022 Ford F-150",
    color: "Blue",
    sourceStatus: "Available",
    daysOnLot: 42,
    miles: 12000,
    year: 2022,
  });

  const alternate = parseInventoryCsv(
    "VIN Last 6,Unit No,Model Year,Manufacturer,Description,Exterior Colour,Current Status,Days In Inventory,Odometer Reading\r\n" +
      'DEF456,U-9,2021,Toyota,"Camry ""SE""",Pearl White,Sold,8,"31,002"\r\n',
  );
  assert.equal(alternate.items[0].vinSuffix, "DEF456");
  assert.equal(alternate.items[0].stockNumber, "U-9");
  assert.equal(alternate.items[0].model, '2021 Toyota Camry "SE"');
  assert.equal(alternate.items[0].color, "Pearl White");
  assert.equal(alternate.items[0].sourceStatus, "Sold");
  assert.equal(alternate.items[0].daysOnLot, 8);
  assert.equal(alternate.items[0].miles, 31002);
});

test("accepts partial VINs and merges duplicate suffixes with warnings", async () => {
  const result = await importInventoryBuffer(
    Buffer.from(
      "VIN6,Stock,Make,Model,Color\nABC123,S-1,Ford,F-150,\nABC123,,Ford,F-150,Blue\n",
    ),
    "inventory.data",
  );

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].vin, null);
  assert.equal(result.items[0].vinSuffix, "ABC123");
  assert.equal(result.items[0].stockNumber, "S-1");
  assert.equal(result.items[0].color, "Blue");
  assert.ok(result.warnings.includes("VIN ABC123: merged a duplicate row."));
});

test("warns when distinct full VINs collide on the same suffix", async () => {
  const result = await importInventoryBuffer(
    Buffer.from(
      "VIN,Model\n1HGCM82633A004352,Accord\n2HGCM82633A004352,Civic\n",
    ),
    "inventory.csv",
  );

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].vin, "1HGCM82633A004352");
  assert.ok(
    result.warnings.some((warning) =>
      warning.includes("two full VINs share this suffix"),
    ),
  );
});

test("reports actionable malformed CSV errors", () => {
  assert.throws(
    () => parseInventoryCsv("Stock,Model\nS-1,Accord\n"),
    (error) =>
      error instanceof CsvInventoryError &&
      error.message.includes("missing a VIN column"),
  );
  assert.throws(
    () => parseInventoryCsv('VIN,Model\nABC123,"Accord\n'),
    (error) =>
      error instanceof CsvInventoryError &&
      error.message.includes("unterminated quoted field"),
  );
  assert.throws(
    () => parseInventoryCsv('VIN,Model\nABC123,"Accord"x\n'),
    (error) =>
      error instanceof CsvInventoryError &&
      error.message.includes("unexpected text after a quoted value"),
  );
  assert.throws(
    () => parseInventoryCsv('VIN,Model\nABC123,Acc"ord\n'),
    (error) =>
      error instanceof CsvInventoryError &&
      error.message.includes("quote inside an unquoted value"),
  );
});

test("does not produce an activatable empty import", async () => {
  await assert.rejects(
    importInventoryBuffer(
      Buffer.from("VIN,Model\nnot-a-vin,Accord\n"),
      "inventory.csv",
    ),
    (error) =>
      error instanceof InventoryImportError &&
      error.status === 422 &&
      error.message.includes("No valid inventory records"),
  );
});

test("rejects non-UTF-8 CSV data", async () => {
  await assert.rejects(
    importInventoryBuffer(Buffer.from([0x56, 0x49, 0x4e, 0x2c, 0xff]), "inventory.csv"),
    (error) =>
      error instanceof InventoryImportError &&
      error.status === 400 &&
      error.message.includes("UTF-8"),
  );
});

test("returns actionable upload contract errors before persistence", async () => {
  const result = await runUploadBuffer(
    Buffer.from("Stock,Model\nS-1,Accord\n"),
    "inventory.csv",
    {
      dealershipId: "00000000-0000-4000-8000-000000000001",
      userId: "00000000-0000-4000-8000-000000000002",
    },
  );

  assert.equal(result.status, 422);
  assert.match(String(result.body.error), /missing a VIN column/i);
});

test("keeps the checked-in Frazer PDF importable", async () => {
  const fixture = await readFile(
    path.join(process.cwd(), "R-1-1 (Price List) 2026-03-14 0916.pdf"),
  );
  const result = await importInventoryBuffer(
    fixture,
    "R-1-1 (Price List) 2026-03-14 0916.pdf",
  );

  assert.equal(result.fileFormat, "pdf");
  assert.equal(result.sourceSystem, "frazer");
  assert.ok(result.items.length > 0);
});

test("keeps highlighted PDF generation backward-compatible", async () => {
  const fixture = await readFile(
    path.join(process.cwd(), "R-1-1 (Price List) 2026-03-14 0916.pdf"),
  );
  const highlighted = await buildHighlightedAuditPdf(fixture, [
    {
      vinSuffix: "ABC123",
      fillColor: "#99E6DC",
      strokeColor: "#0F766E",
    },
  ]);

  assert.equal(Buffer.from(highlighted).subarray(0, 5).toString("ascii"), "%PDF-");
});

test("keeps audits upload-scoped and rejects highlighted export for CSV", async () => {
  const [mobileApi, webApi, exportHandler] = await Promise.all([
    readFile(path.join(process.cwd(), "lib/mobile-api.ts"), "utf8"),
    readFile(path.join(process.cwd(), "website/lib/web-api.ts"), "utf8"),
    readFile(path.join(process.cwd(), "lib/export-audit-handler.ts"), "utf8"),
  ]);

  assert.match(
    mobileApi,
    /\.eq\("inventory_upload_id", inventory\.id\)/,
  );
  assert.match(
    webApi,
    /\.eq\("inventory_upload_id", inventory\.id\)/,
  );
  assert.match(exportHandler, /upload\.file_format !== "pdf"/);
  assert.match(exportHandler, /CSV-backed audits/);
});

test("uses an atomic non-empty activation RPC", async () => {
  const migration = await readFile(
    path.join(
      process.cwd(),
      "supabase/migrations/20260717050000_add_dms_neutral_import_pipeline.sql",
    ),
    "utf8",
  );

  assert.match(migration, /create or replace function public\.activate_inventory_import/);
  assert.match(migration, /jsonb_array_length\(target_items\) = 0/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /update public\.inventory_uploads[\s\S]+archived_at is null/);
  assert.match(migration, /insert into public\.inventory_uploads/);
  assert.match(migration, /insert into public\.inventory_items/);
  assert.match(migration, /inserted_count <> jsonb_array_length\(target_items\)/);
});
