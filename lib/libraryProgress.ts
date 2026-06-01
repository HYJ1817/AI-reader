import type { ReadingPosition } from "./db";
import { normalizeProgressPercent } from "./readerProgress";

export type ReadingProgressMap = Record<string, number>;

export function buildReadingProgressMap(
  positions: ReadingPosition[]
): ReadingProgressMap {
  const latestByBook: Record<string, ReadingPosition> = {};

  for (const position of positions) {
    const existing = latestByBook[position.bookId];
    if (!existing || position.updatedAt.localeCompare(existing.updatedAt) >= 0) {
      latestByBook[position.bookId] = position;
    }
  }

  return Object.fromEntries(
    Object.values(latestByBook).map((position) => [
      position.bookId,
      normalizeProgressPercent(position.progressPercent),
    ])
  );
}

export function getBookProgressPercent(
  progressMap: ReadingProgressMap,
  bookId: string
): number {
  return progressMap[bookId] ?? 0;
}

export function formatLibraryProgressLabel(progressPercent: number): string {
  const progress = normalizeProgressPercent(progressPercent);
  if (progress <= 0) return "未开始";
  if (progress >= 100) return "已读完";
  return `已读 ${progress}%`;
}
