export function normalizeProgressPercent(value: unknown): number {
  if (typeof value !== "number" || !isFinite(value)) {
    return 0;
  }
  const rounded = Math.round(value);
  return Math.min(100, Math.max(0, rounded));
}
