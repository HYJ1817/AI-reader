export function hasIndexedDbSupport(scope: unknown): boolean {
  if (!scope || typeof scope !== "object") return false;
  if (!("indexedDB" in scope)) return false;
  try {
    return Boolean((scope as { indexedDB?: unknown }).indexedDB);
  } catch {
    return false;
  }
}
