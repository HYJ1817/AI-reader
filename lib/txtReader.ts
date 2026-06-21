export function parseTxtParagraphs(text: string): string[] {
  if (!text.trim()) return [];

  const normalized = text.replace(/\r\n?/g, "\n");

  const hasBlankLines = /\n\s*\n/.test(normalized);

  if (hasBlankLines) {
    return normalized
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  return normalized
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export function chunkParagraphs(
  paragraphs: string[],
  chunkSize = 24
): string[][] {
  const safeChunkSize =
    Number.isFinite(chunkSize) && chunkSize > 0
      ? Math.max(1, Math.floor(chunkSize))
      : Math.max(1, paragraphs.length);
  const chunks: string[][] = [];
  for (let index = 0; index < paragraphs.length; index += safeChunkSize) {
    chunks.push(paragraphs.slice(index, index + safeChunkSize));
  }
  return chunks;
}

export function progressFromScroll(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number
): number {
  const maxScroll = scrollHeight - clientHeight;
  if (maxScroll <= 0) return 0;
  const raw = (scrollTop / maxScroll) * 100;
  return Math.floor(Math.min(100, Math.max(0, raw)));
}

export function scrollTopFromProgress(
  progressPercent: number,
  scrollHeight: number,
  clientHeight: number
): number {
  const maxScroll = scrollHeight - clientHeight;
  if (maxScroll <= 0) return 0;
  const clamped = Math.min(100, Math.max(0, progressPercent));
  return (clamped / 100) * maxScroll;
}

function getScrollableDistance(
  scrollSize: number,
  clientSize: number
): number {
  const safeScrollSize = Number.isFinite(scrollSize)
    ? Math.max(0, scrollSize)
    : 0;
  const safeClientSize = Number.isFinite(clientSize)
    ? Math.max(0, clientSize)
    : 0;
  return Math.max(0, safeScrollSize - safeClientSize);
}

export function progressFromHorizontalScroll(
  scrollLeft: number,
  scrollWidth: number,
  clientWidth: number
): number {
  const maxScroll = getScrollableDistance(scrollWidth, clientWidth);
  if (maxScroll <= 0) return 0;
  const safeScrollLeft = Number.isFinite(scrollLeft) ? scrollLeft : 0;
  const raw = (safeScrollLeft / maxScroll) * 100;
  return Math.floor(Math.min(100, Math.max(0, raw)));
}

export function scrollLeftFromProgress(
  progressPercent: number,
  scrollWidth: number,
  clientWidth: number
): number {
  const maxScroll = getScrollableDistance(scrollWidth, clientWidth);
  if (maxScroll <= 0) return 0;
  const safeProgress = Number.isFinite(progressPercent) ? progressPercent : 0;
  const clamped = Math.min(100, Math.max(0, safeProgress));
  return (clamped / 100) * maxScroll;
}

export function getHorizontalPageInfo(
  scrollLeft: number,
  scrollWidth: number,
  clientWidth: number
): { current: number; total: number } {
  if (!Number.isFinite(clientWidth) || clientWidth <= 0) {
    return { current: 1, total: 1 };
  }

  const safeScrollWidth = Number.isFinite(scrollWidth)
    ? Math.max(clientWidth, scrollWidth)
    : clientWidth;
  const safeScrollLeft = Number.isFinite(scrollLeft)
    ? Math.max(0, scrollLeft)
    : 0;
  const total = Math.max(1, Math.ceil(safeScrollWidth / clientWidth));
  const current = Math.min(
    total,
    Math.max(1, Math.round(safeScrollLeft / clientWidth) + 1)
  );

  return { current, total };
}
