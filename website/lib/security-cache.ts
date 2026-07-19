"use client";

const SENSITIVE_PREFIXES = [
  "auditur.selected",
  "auditur.lot",
  "auditur.demo",
  "auditur.members",
  "auditur_dashboard",
];

export function clearSensitiveWebState(): void {
  if (typeof window === "undefined") return;
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key && SENSITIVE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      localStorage.removeItem(key);
    }
  }
}
