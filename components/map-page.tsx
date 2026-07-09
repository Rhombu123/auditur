"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchLotVehicles, markVehicleRemoved } from "@/lib/api-client";
import type { LotVehicle } from "@/lib/types";

import { LotMap } from "./lot-map";

export function MapPage() {
  const [vehicles, setVehicles] = useState<LotVehicle[]>([]);
  const [selectedVinSuffix, setSelectedVinSuffix] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadVehicles = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchLotVehicles();
      setVehicles(data.vehicles);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load lot vehicles.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVehicles();
  }, [loadVehicles]);

  const filteredVehicles = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return vehicles;
    }

    return vehicles.filter((vehicle) =>
      [vehicle.vinSuffix, vehicle.model, vehicle.color]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [search, vehicles]);

  const pinnedCount = vehicles.filter(
    (vehicle) => vehicle.latitude !== null && vehicle.longitude !== null,
  ).length;
  const scannedTodayCount = vehicles.filter((vehicle) => vehicle.scannedToday).length;

  async function handleMarkRemoved(
    itemId: string,
    lotStatus: "sold" | "auctioned",
  ) {
    setUpdatingId(itemId);
    setError(null);

    try {
      const updatedVehicles = await markVehicleRemoved(itemId, lotStatus);
      setVehicles(updatedVehicles);
      if (selectedVinSuffix) {
        const stillVisible = updatedVehicles.some(
          (vehicle) => vehicle.vinSuffix === selectedVinSuffix,
        );
        if (!stillVisible) {
          setSelectedVinSuffix(null);
        }
      }
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update vehicle status.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 pb-10 sm:px-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700">
          Lot Map
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
          Active Lot Overview
        </h1>
        <p className="text-base leading-7 text-zinc-600">
          GPS pins from scans, green highlights for vehicles scanned today, and
          one-tap removal for sold or auctioned units.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Active</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-950">{vehicles.length}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Pinned</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-950">{pinnedCount}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-emerald-700">Scanned today</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-800">
            {scannedTodayCount}
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <LotMap
        vehicles={vehicles}
        selectedVinSuffix={selectedVinSuffix}
        onSelectVehicle={setSelectedVinSuffix}
      />

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-950">Active Vehicles</h2>
            <p className="text-sm text-zinc-500">
              Green rows match today&apos;s scans from your price list workflow.
            </p>
          </div>

          <label className="block w-full sm:max-w-xs">
            <span className="sr-only">Search vehicles</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search VIN, model, color..."
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none ring-emerald-500 transition focus:ring-2"
            />
          </label>
        </div>

        <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="px-6 py-10 text-center text-sm text-zinc-500">
              Loading lot vehicles...
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-zinc-500">
              No active vehicles match your search.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-left">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:px-6">
                      VIN6
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:px-6">
                      Model
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:px-6">
                      Color
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:px-6">
                      Days
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:px-6">
                      GPS
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:px-6">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredVehicles.map((vehicle) => {
                    const isSelected = vehicle.vinSuffix === selectedVinSuffix;
                    const isUpdating = updatingId === vehicle.id;

                    return (
                      <tr
                        key={vehicle.id}
                        id={`vehicle-${vehicle.vinSuffix}`}
                        onClick={() => setSelectedVinSuffix(vehicle.vinSuffix)}
                        className={`cursor-pointer transition ${
                          vehicle.scannedToday
                            ? "bg-emerald-50 hover:bg-emerald-100/70"
                            : "hover:bg-zinc-50"
                        } ${isSelected ? "ring-2 ring-inset ring-emerald-500" : ""}`}
                      >
                        <td className="px-4 py-4 font-mono text-sm font-semibold tracking-[0.16em] text-zinc-950 sm:px-6">
                          {vehicle.vinSuffix}
                        </td>
                        <td className="px-4 py-4 text-sm text-zinc-800 sm:px-6">
                          {vehicle.model}
                        </td>
                        <td className="px-4 py-4 text-sm text-zinc-700 sm:px-6">
                          {vehicle.color}
                        </td>
                        <td className="px-4 py-4 text-sm text-zinc-700 sm:px-6">
                          {vehicle.daysOnLot ?? "—"}
                        </td>
                        <td className="px-4 py-4 text-sm text-zinc-700 sm:px-6">
                          {vehicle.latitude !== null && vehicle.longitude !== null
                            ? "Pinned"
                            : "—"}
                        </td>
                        <td className="px-4 py-4 sm:px-6">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleMarkRemoved(vehicle.id, "sold");
                              }}
                              className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 disabled:opacity-60"
                            >
                              Mark Sold
                            </button>
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleMarkRemoved(vehicle.id, "auctioned");
                              }}
                              className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-60"
                            >
                              Auctioned
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
