export type ReaderPageInfo = {
  current: number;
  total: number;
};

function safePositiveInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.round(value));
}

export function normalizeReaderPageInfo(pageInfo: ReaderPageInfo): ReaderPageInfo {
  const total = safePositiveInteger(pageInfo.total, 1);
  const current = Math.min(total, safePositiveInteger(pageInfo.current, 1));
  return { current, total };
}

export function formatReaderPageLabel(pageInfo: ReaderPageInfo): string {
  const normalized = normalizeReaderPageInfo(pageInfo);
  return `${normalized.current}/${normalized.total}页`;
}

export function estimateReaderPageInfo(
  progressPercent: number,
  totalPages: number
): ReaderPageInfo {
  const total = safePositiveInteger(totalPages, 1);
  const progress = Number.isFinite(progressPercent)
    ? Math.min(100, Math.max(0, progressPercent))
    : 0;
  const current = Math.min(total, Math.max(1, Math.round((progress / 100) * total) + 1));
  return { current, total };
}

export function getScrollPageInfo(
  scrollOffset: number,
  scrollSize: number,
  clientSize: number
): ReaderPageInfo {
  if (!Number.isFinite(clientSize) || clientSize <= 0) {
    return { current: 1, total: 1 };
  }

  const safeScrollSize = Number.isFinite(scrollSize)
    ? Math.max(clientSize, scrollSize)
    : clientSize;
  const safeOffset = Number.isFinite(scrollOffset)
    ? Math.max(0, scrollOffset)
    : 0;
  const total = Math.max(1, Math.ceil(safeScrollSize / clientSize));
  const current = Math.min(
    total,
    Math.max(1, Math.floor(safeOffset / clientSize) + 1)
  );

  return { current, total };
}
