const VIN_PATTERN = /[A-HJ-NPR-Z0-9]{17}/i;
const VIN_SUFFIX_PATTERN = /[A-HJ-NPR-Z0-9]{6}/i;

export function extractVin(raw: string): string | null {
  const compact = raw.replace(/[^A-HJ-NPR-Z0-9]/gi, "").toUpperCase();

  if (compact.length === 17 && VIN_PATTERN.test(compact)) {
    return compact;
  }

  const vinMatch = compact.match(VIN_PATTERN);
  if (vinMatch) {
    return vinMatch[0].toUpperCase();
  }

  return null;
}

export function extractVinSuffix(raw: string): string | null {
  const vin = extractVin(raw);
  if (vin) {
    return vin.slice(-6);
  }

  const compact = raw.replace(/[^A-HJ-NPR-Z0-9]/gi, "").toUpperCase();
  if (compact.length === 6 && VIN_SUFFIX_PATTERN.test(compact)) {
    return compact;
  }

  if (compact.length > 6) {
    return compact.slice(-6);
  }

  return null;
}

export function formatVin(vin: string): string {
  return vin.toUpperCase();
}
