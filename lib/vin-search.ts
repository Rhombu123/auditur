export function normalizeVinQuery(query: string): string {
  return query.replace(/[^A-HJ-NPR-Z0-9]/gi, "").toUpperCase();
}

function normalizeStoredVin(vin: string | null | undefined): string {
  if (!vin) return "";
  return vin.replace(/[^A-HJ-NPR-Z0-9]/gi, "").toUpperCase();
}

/** Match last 6, last 8, or full VIN (partial from either end). */
export function matchesVinQuery(
  query: string,
  vin: string | null | undefined,
  vinSuffix: string,
): boolean {
  const q = normalizeVinQuery(query);
  if (!q) return true;
  if (q.length < 4) return false;

  const full = normalizeStoredVin(vin);
  const suffix = vinSuffix.toUpperCase();

  if (full && (full === q || full.includes(q) || full.endsWith(q))) {
    return true;
  }

  if (suffix === q || suffix.endsWith(q) || suffix.includes(q)) {
    return true;
  }

  return false;
}

export function matchesVehicleSearch(
  query: string,
  fields: {
    vin?: string | null;
    vinSuffix: string;
    model?: string | null;
    color?: string | null;
  },
): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;

  const vinQuery = normalizeVinQuery(trimmed);
  if (vinQuery.length >= 4) {
    if (matchesVinQuery(trimmed, fields.vin, fields.vinSuffix)) {
      return true;
    }
  }

  const text = trimmed.toLowerCase();
  return [fields.model, fields.color]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(text));
}
