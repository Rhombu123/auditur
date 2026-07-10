const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/i;
const VIN_GLOBAL_PATTERN = /[A-HJ-NPR-Z0-9]{17}/gi;
const VIN_SUFFIX_PATTERN = /^[A-HJ-NPR-Z0-9]{6}$/i;
const VIN_LABEL_PATTERN = /VIN\s*[#:\-]?\s*([A-HJ-NPR-Z0-9]{6,17})/i;
const VIN_URL_PATTERN =
  /(?:\bvin\b|vehicleIdentificationNumber|vehicleid)[=:/\s]+([A-HJ-NPR-Z0-9]{17})/i;

const VIN_TRANSLITERATION: Record<string, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
  H: 8,
  J: 1,
  K: 2,
  L: 3,
  M: 4,
  N: 5,
  P: 7,
  R: 9,
  S: 2,
  T: 3,
  U: 4,
  V: 5,
  W: 6,
  X: 7,
  Y: 8,
  Z: 9,
  "0": 0,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
};

const VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

const JSON_VIN_KEYS = [
  "vin",
  "VIN",
  "vehicleIdentificationNumber",
  "VehicleIdentificationNumber",
  "vehicleId",
  "VehicleId",
];

const URL_VIN_KEYS = [
  "vin",
  "VIN",
  "vehicleIdentificationNumber",
  "vehicleid",
  "VehicleId",
];

type VinCandidate = {
  vin: string;
  score: number;
};

function normalizeVinToken(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const compact = value.replace(/[^A-HJ-NPR-Z0-9]/gi, "").toUpperCase();
  if (compact.length === 17 && VIN_PATTERN.test(compact)) {
    return compact;
  }
  const match = compact.match(/[A-HJ-NPR-Z0-9]{17}/);
  return match ? match[0].toUpperCase() : null;
}

export function isValidVinCheckDigit(vin: string): boolean {
  const normalized = vin.toUpperCase();
  if (!VIN_PATTERN.test(normalized)) return false;

  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const value = VIN_TRANSLITERATION[normalized[i]];
    if (value === undefined) return false;
    sum += value * VIN_WEIGHTS[i];
  }

  const remainder = sum % 11;
  const expected = remainder === 10 ? "X" : String(remainder);
  return normalized[8] === expected;
}

function scoreVinCandidate(vin: string, baseScore: number): number {
  let score = baseScore;
  if (isValidVinCheckDigit(vin)) score += 500;
  return score;
}

function addCandidate(
  candidates: VinCandidate[],
  value: string | null | undefined,
  baseScore: number,
) {
  const vin = normalizeVinToken(value);
  if (!vin) return;
  candidates.push({ vin, score: scoreVinCandidate(vin, baseScore) });
}

function extractFromJson(raw: string): VinCandidate[] {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") && !trimmed.includes('"')) {
    return [];
  }

  try {
    const data = JSON.parse(trimmed) as Record<string, unknown>;
    const candidates: VinCandidate[] = [];
    for (const key of JSON_VIN_KEYS) {
      if (typeof data[key] === "string") {
        addCandidate(candidates, data[key], 1200);
      }
    }
    return candidates;
  } catch {
    return [];
  }
}

function extractFromUrl(raw: string): VinCandidate[] {
  const candidates: VinCandidate[] = [];

  try {
    const url = new URL(raw);
    for (const key of URL_VIN_KEYS) {
      addCandidate(candidates, url.searchParams.get(key), 1100);
    }

    const pathMatch = url.pathname.match(/\/vin\/([A-HJ-NPR-Z0-9]{17})/i);
    if (pathMatch) {
      addCandidate(candidates, pathMatch[1], 1050);
    }

    for (const value of url.searchParams.values()) {
      addCandidate(candidates, value, 700);
    }
  } catch {
    // Not a URL — other parsers will handle it.
  }

  return candidates;
}

function extractLooseMatches(raw: string): VinCandidate[] {
  const candidates: VinCandidate[] = [];
  const trimmed = raw.trim();

  const urlMatch = trimmed.match(VIN_URL_PATTERN);
  if (urlMatch) {
    addCandidate(candidates, urlMatch[1], 1000);
  }

  const labeled = trimmed.match(VIN_LABEL_PATTERN);
  if (labeled) {
    addCandidate(candidates, labeled[1], 900);
  }

  const compact = trimmed.replace(/[^A-HJ-NPR-Z0-9*]/gi, "").replace(/\*/g, "").toUpperCase();
  if (compact.length === 17 && VIN_PATTERN.test(compact)) {
    addCandidate(candidates, compact, 800);
  } else if (compact.length > 17) {
    const tail = compact.slice(-17);
    if (VIN_PATTERN.test(tail)) {
      addCandidate(candidates, tail, 650);
    }
  }

  const matches = [...compact.matchAll(VIN_GLOBAL_PATTERN)];
  matches.forEach((match, index) => {
    const positionBonus = Math.max(0, 300 - index * 40);
    addCandidate(candidates, match[0], 400 + positionBonus);
  });

  return candidates;
}

function pickBestCandidate(candidates: VinCandidate[]): string | null {
  if (candidates.length === 0) return null;

  const byVin = new Map<string, VinCandidate>();
  for (const candidate of candidates) {
    const existing = byVin.get(candidate.vin);
    if (!existing || candidate.score > existing.score) {
      byVin.set(candidate.vin, candidate);
    }
  }

  const unique = [...byVin.values()].sort((a, b) => b.score - a.score);
  const valid = unique.filter((candidate) => isValidVinCheckDigit(candidate.vin));
  if (valid.length > 0) {
    return valid[0].vin;
  }

  return unique[0]?.vin ?? null;
}

export function extractVin(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const candidates = [
    ...extractFromJson(trimmed),
    ...extractFromUrl(trimmed),
    ...extractLooseMatches(trimmed),
  ];

  return pickBestCandidate(candidates);
}

export function extractVinSuffix(raw: string): string | null {
  const vin = extractVin(raw);
  if (vin) return vin.slice(-6);

  const trimmed = raw.trim();
  const labeled = trimmed.match(VIN_LABEL_PATTERN);
  if (labeled) {
    const segment = labeled[1].replace(/[^A-HJ-NPR-Z0-9]/gi, "").toUpperCase();
    if (segment.length >= 6) {
      return segment.slice(-6);
    }
  }

  const tokens = trimmed.match(/\b[A-HJ-NPR-Z0-9]{6}\b/gi);
  if (tokens?.length) {
    return tokens[0].toUpperCase();
  }

  const compact = trimmed.replace(/[^A-HJ-NPR-Z0-9*]/gi, "").replace(/\*/g, "").toUpperCase();
  if (compact.length === 6 && VIN_SUFFIX_PATTERN.test(compact)) {
    return compact;
  }

  if (compact.length >= 6) {
    return compact.slice(-6);
  }

  return null;
}

export function formatVin(vin: string): string {
  return vin.toUpperCase();
}

export function parseScanPayload(
  ...values: Array<string | null | undefined>
): { rawValue: string; vin: string | null; vinSuffix: string } | null {
  let best: {
    rawValue: string;
    vin: string | null;
    vinSuffix: string;
    score: number;
  } | null = null;

  values.forEach((value, index) => {
    if (!value?.trim()) return;

    const rawValue = value.trim();
    const vin = extractVin(rawValue);
    const vinSuffix = vin ? vin.slice(-6) : extractVinSuffix(rawValue);
    if (!vinSuffix) return;

    let score = vin ? 200 : rawValue.length >= 6 ? 100 : 50;
    if (vin && isValidVinCheckDigit(vin)) score += 500;
  // Prefer decoded `data` over `raw` when both are present.
    score += Math.max(0, 40 - index * 20);

    if (!best || score > best.score) {
      best = { rawValue, vin, vinSuffix, score };
    }
  });

  if (!best) return null;
  return {
    rawValue: best.rawValue,
    vin: best.vin,
    vinSuffix: best.vinSuffix,
  };
}
