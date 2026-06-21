export function progressPercentFromEpubLocation(
  location: unknown,
  spineItemCount = 0
): number {
  if (location === null || location === undefined || typeof location !== "object") {
    return 0;
  }

  const obj = location as Record<string, unknown>;
  if (obj.atStart === true) return 0;
  if (obj.atEnd === true) return 100;

  let pct: unknown;

  const start = obj.start;
  if (start && typeof start === "object") {
    pct = (start as Record<string, unknown>).percentage;
  }

  if (pct === undefined) {
    pct = obj.percentage;
  }

  if (typeof pct === "number" && Number.isFinite(pct)) {
    const scaled = pct * 100;
    return Math.floor(Math.min(100, Math.max(0, scaled)));
  }

  const safeSpineCount =
    Number.isFinite(spineItemCount) && spineItemCount > 0
      ? Math.floor(spineItemCount)
      : 0;
  if (safeSpineCount === 0 || !start || typeof start !== "object") return 0;

  const startObj = start as Record<string, unknown>;
  const index = startObj.index;
  if (typeof index !== "number" || !Number.isFinite(index)) return 0;

  let sectionProgress = 0;
  const displayed = startObj.displayed;
  if (displayed && typeof displayed === "object") {
    const displayedObj = displayed as Record<string, unknown>;
    const page = displayedObj.page;
    const total = displayedObj.total;
    if (
      typeof page === "number" &&
      Number.isFinite(page) &&
      typeof total === "number" &&
      Number.isFinite(total) &&
      total > 0
    ) {
      sectionProgress = Math.min(1, Math.max(0, (page - 1) / total));
    }
  }

  const fallback = ((index + sectionProgress) / safeSpineCount) * 100;
  return Math.floor(Math.min(100, Math.max(0, fallback)));
}
