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
  if (!full) return null;
  if (full.slice(-6) === vinSuffix.toUpperCase()) {
    return `Last 6: ${vinSuffix.toUpperCase()}`;
  }
  return `Last 6: ${vinSuffix.toUpperCase()}`;
}
