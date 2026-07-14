const DEFAULT_RETURN_TO = "/dashboard/";

/** Only allow same-site relative paths (blocks open redirects). */
export function sanitizeReturnTo(path: string | null | undefined): string {
  if (!path) return DEFAULT_RETURN_TO;
  const trimmed = path.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return DEFAULT_RETURN_TO;
  if (trimmed.includes("://")) return DEFAULT_RETURN_TO;

  const pathOnly = trimmed.split(/[?#]/)[0] ?? trimmed;
  if (
    pathOnly.startsWith("/login") ||
    pathOnly.startsWith("/signup") ||
    pathOnly.startsWith("/auth/")
  ) {
    return DEFAULT_RETURN_TO;
  }

  if (trimmed.includes("?") || trimmed.includes("#")) {
    return trimmed;
  }

  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}
