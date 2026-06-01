export function progressPercentFromEpubLocation(location: unknown): number {
  if (location === null || location === undefined || typeof location !== "object") {
    return 0;
  }

  const obj = location as Record<string, unknown>;

  let pct: unknown;

  const start = obj.start;
  if (start && typeof start === "object") {
    pct = (start as Record<string, unknown>).percentage;
  }

  if (pct === undefined) {
    pct = obj.percentage;
  }

  if (typeof pct !== "number" || !isFinite(pct) || isNaN(pct)) {
    return 0;
  }

  const scaled = pct * 100;
  return Math.floor(Math.min(100, Math.max(0, scaled)));
}
