export type DecodedVehicle = {
  year: number | null;
  make: string | null;
  model: string | null;
};

function cleanValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "Not Applicable") return null;
  return trimmed;
}

export async function decodeVinFromNhtsa(vin: string): Promise<DecodedVehicle | null> {
  const normalized = vin.replace(/[^A-HJ-NPR-Z0-9]/gi, "").toUpperCase();
  if (normalized.length < 11) return null;

  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(normalized)}?format=json`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const payload = (await response.json()) as {
      Results?: Array<Record<string, string>>;
    };

    const row = payload.Results?.[0];
    if (!row) return null;

    const yearRaw = cleanValue(row.ModelYear);
    const make = cleanValue(row.Make);
    const model = cleanValue(row.Model);

    if (!make && !model) return null;

    return {
      year: yearRaw ? Number(yearRaw) : null,
      make,
      model,
    };
  } catch {
    return null;
  }
}

export function formatDecodedVehicle(decoded: DecodedVehicle): string {
  const makeModel = [decoded.make, decoded.model].filter(Boolean).join(" ");
  if (decoded.year && makeModel) {
    return `${decoded.year} ${makeModel}`;
  }
  return makeModel || "Unknown vehicle";
}
