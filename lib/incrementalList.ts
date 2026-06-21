function sanitizeCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function getInitialVisibleItemCount(
  total: number,
  batchSize: number
): number {
  const safeTotal = sanitizeCount(total);
  const safeBatch = sanitizeCount(batchSize);
  if (safeTotal === 0 || safeBatch === 0) return 0;
  return Math.min(safeTotal, safeBatch);
}

export function getNextVisibleItemCount(
  current: number,
  total: number,
  batchSize: number
): number {
  const safeCurrent = sanitizeCount(current);
  const safeTotal = sanitizeCount(total);
  const safeBatch = sanitizeCount(batchSize);
  if (safeTotal === 0 || safeBatch === 0) return 0;
  return Math.min(safeTotal, safeCurrent + safeBatch);
}
