/** Convert #rgb / #rrggbb to rgba() for semi-transparent zone fills. */
export function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.trim().replace("#", "");
  const full =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => c + c)
          .join("")
      : cleaned;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    return `rgba(13, 148, 136, ${alpha})`;
  }
  const value = Number.parseInt(full, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
