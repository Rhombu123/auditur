"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import type { InventoryItem } from "@/lib/types";
import { loadInventory, saveInventory } from "@/lib/storage";

type UploadResponse = {
  fileName: string;
  itemCount: number;
  items: InventoryItem[];
  totalLines: number;
};

type ErrorResponse = {
  error: string;
  rawTextPreview?: string;
  totalLines?: number;
};

function colorDotClass(color: string): string {
  const normalized = color.toLowerCase();

  if (normalized.includes("black") || normalized.includes("charcoal")) {
    return "bg-zinc-900";
  }
  if (normalized.includes("white") || normalized.includes("pearl")) {
    return "bg-zinc-100 ring-1 ring-zinc-300";
  }
  if (normalized.includes("silver") || normalized.includes("gray") || normalized.includes("grey")) {
    return "bg-zinc-400";
  }
  if (normalized.includes("red") || normalized.includes("burgundy") || normalized.includes("maroon")) {
    return "bg-red-500";
  }
  if (normalized.includes("blue")) {
    return "bg-blue-500";
  }
  if (normalized.includes("green")) {
    return "bg-emerald-500";
  }
  if (normalized.includes("gold") || normalized.includes("bronze") || normalized.includes("copper")) {
    return "bg-amber-500";
  }

  return "bg-zinc-300";
}

export function InventoryUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const saved = loadInventory();
    if (saved) {
      setFileName(saved.fileName);
      setItems(saved.items);
    }
  }, []);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return items;
    }

    return items.filter((item) =>
      [item.vinSuffix, item.model, item.color, item.daysOnLot?.toString() ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [items, search]);

  async function handleFile(file: File) {
    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as UploadResponse | ErrorResponse;

      if (!response.ok) {
        throw new Error("error" in data ? data.error : "Upload failed.");
      }

      const success = data as UploadResponse;
      setFileName(success.fileName);
      setItems(success.items);
      setSearch("");
      saveInventory({
        fileName: success.fileName,
        uploadedAt: new Date().toISOString(),
        items: success.items,
      });
    } catch (uploadError) {
      setItems([]);
      setFileName(null);
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Something went wrong while uploading.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  function onInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      void handleFile(file);
    }
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (file) {
      void handleFile(file);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700">
          Auditur
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
          Inventory Upload
        </h1>
        <p className="max-w-2xl text-base leading-7 text-zinc-600">
          Upload a dealership inventory PDF. We extract VIN suffixes, models,
          colors, and days on lot into a scannable table for lot audits.
        </p>
      </header>

      <section
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`rounded-3xl border-2 border-dashed p-8 transition-colors ${
          isDragging
            ? "border-emerald-500 bg-emerald-50"
            : "border-zinc-200 bg-white"
        }`}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <svg
              aria-hidden="true"
              className="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16"
              />
            </svg>
          </div>

          <div className="space-y-1">
            <p className="text-lg font-medium text-zinc-900">
              Drop your inventory PDF here
            </p>
            <p className="text-sm text-zinc-500">PDF only, up to 10 MB</p>
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUploading ? "Processing PDF..." : "Choose PDF"}
          </button>

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={onInputChange}
          />
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {items.length > 0 ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-zinc-950">
                Parsed Inventory
              </h2>
              <p className="text-sm text-zinc-500">
                {fileName} · {items.length} vehicles
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="block w-full sm:max-w-xs">
                <span className="sr-only">Search inventory</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search VIN, model, color..."
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none ring-emerald-500 transition focus:ring-2"
                />
              </label>

              <Link
                href="/scan"
                className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                Start Scanning
              </Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-left">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:px-6">
                      VIN (Last 6)
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:px-6">
                      Model
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:px-6">
                      Color
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:px-6">
                      Days on Lot
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredItems.map((item) => (
                    <tr
                      key={item.vinSuffix}
                      className="transition hover:bg-emerald-50/50"
                    >
                      <td className="px-4 py-4 font-mono text-base font-semibold tracking-[0.2em] text-zinc-950 sm:px-6">
                        {item.vinSuffix}
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-zinc-800 sm:px-6">
                        {item.model}
                      </td>
                      <td className="px-4 py-4 text-sm text-zinc-700 sm:px-6">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className={`h-3 w-3 rounded-full ${colorDotClass(item.color)}`}
                          />
                          {item.color}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-zinc-700 sm:px-6">
                        {item.daysOnLot ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredItems.length === 0 ? (
              <div className="border-t border-zinc-100 px-6 py-8 text-center text-sm text-zinc-500">
                No vehicles match your search.
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
