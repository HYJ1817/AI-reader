export function hasIndexedDbSupport(scope: unknown): boolean {
  if (!scope || typeof scope !== "object") return false;
  if (!("indexedDB" in scope)) return false;
  return Boolean((scope as { indexedDB?: unknown }).indexedDB);
}
