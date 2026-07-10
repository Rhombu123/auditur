export async function readApiJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();

  if (!body.trim()) {
    throw new Error(
      `API returned an empty response (${response.status} ${response.url}).`,
    );
  }

  const looksLikeHtml =
    body.trimStart().startsWith("<") ||
    contentType.includes("text/html");

  if (looksLikeHtml) {
    const path = (() => {
      try {
        return new URL(response.url).pathname;
      } catch {
        return response.url;
      }
    })();

    throw new Error(
      `API at ${path} returned HTML instead of JSON (${response.status}). ` +
        "The route may be missing on Vercel — redeploy with the /api folder or set EXPO_PUBLIC_OCR_API_URL.",
    );
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(
      `API returned invalid JSON (${response.status}): ${body.slice(0, 120)}`,
    );
  }
}
