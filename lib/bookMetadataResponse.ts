import type { BookEnrichmentError } from "./bookMetadata";

const SAFE_CODES: readonly BookEnrichmentError[] = [
  "offline", "timeout", "provider", "invalid-response", "no-match",
];

export async function metadataResponseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    let code: BookEnrichmentError = response.status === 408 || response.status === 504
      ? "timeout" : "provider";
    if (payload && typeof payload === "object") {
      const error = payload as { code?: unknown; error?: { code?: unknown } | null };
      const candidate = error.code ?? error.error?.code;
      if (typeof candidate === "string" && SAFE_CODES.includes(candidate as BookEnrichmentError)) {
        code = candidate as BookEnrichmentError;
      }
    }
    throw Object.assign(new Error("Metadata request failed"), { code });
  }
  try {
    return (await response.json()) as T;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw Object.assign(new Error("Invalid metadata response"), { code: "invalid-response" });
  }
}
