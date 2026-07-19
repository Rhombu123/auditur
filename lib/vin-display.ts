export function formatFullVin(vin: string | null | undefined): string | null {
  if (!vin) return null;
  const normalized = vin.replace(/[^A-HJ-NPR-Z0-9]/gi, "").toUpperCase();
  return normalized.length >= 11 ? normalized : null;
}

export function formatVinPrimary(
  vin: string | null | undefined,
  vinSuffix: string,
): string {
  return formatFullVin(vin) ?? vinSuffix.toUpperCase();
}

export function formatVinSecondary(
  vin: string | null | undefined,
  vinSuffix: string,
): string | null {
  const full = formatFullVin(vin);
  if (full) return full.slice(-8);
  const normalizedSuffix = vinSuffix.toUpperCase();
  return normalizedSuffix.length >= 8 ? normalizedSuffix.slice(-8) : null;
}
