export type ReaderPageInfo = {
  current: number;
  total: number;
  status?: "calculating" | "unavailable";
};

export type EpubPageListInfo = {
  firstPage?: unknown;
  lastPage?: unknown;
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
  if (pageInfo.status === "calculating") return "正在计算页数…";
  if (pageInfo.status === "unavailable") return "页数未知";
  const normalized = normalizeReaderPageInfo(pageInfo);
  return `${normalized.current}/${normalized.total}页`;
}

export function formatReaderPageSummary(pageInfo: ReaderPageInfo): string {
  if (pageInfo.status === "calculating") return "正在计算页数…";
  if (pageInfo.status === "unavailable") return "页数未知";
  const normalized = normalizeReaderPageInfo(pageInfo);
  return `第 ${normalized.current} 页（共 ${normalized.total} 页）`;
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

export function getEpubBookPageInfo(
  location: unknown,
  locationTotal: number,
  pageList?: EpubPageListInfo | null
): ReaderPageInfo | null {
  if (location === null || typeof location !== "object") return null;

  const start = (location as Record<string, unknown>).start;
  if (start === null || typeof start !== "object") return null;

  const startRecord = start as Record<string, unknown>;
  const firstPage = pageList?.firstPage;
  const lastPage = pageList?.lastPage;
  const publishedPage = startRecord.page;
  if (
    typeof firstPage === "number" &&
    Number.isFinite(firstPage) &&
    typeof lastPage === "number" &&
    Number.isFinite(lastPage) &&
    lastPage >= firstPage &&
    typeof publishedPage === "number" &&
    Number.isFinite(publishedPage) &&
    publishedPage >= firstPage &&
    publishedPage <= lastPage
  ) {
    return normalizeReaderPageInfo({
      current: publishedPage - firstPage + 1,
      total: lastPage - firstPage + 1,
    });
  }

  const locationIndex = startRecord.location;
  if (
    typeof locationIndex !== "number" ||
    !Number.isFinite(locationIndex) ||
    locationIndex < 0 ||
    !Number.isFinite(locationTotal) ||
    locationTotal < 0
  ) {
    return null;
  }

  return normalizeReaderPageInfo({
    current: Math.floor(locationIndex) + 1,
    total: Math.floor(locationTotal) + 1,
  });
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
