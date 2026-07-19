import type { AnnotationRecord, HighlightColor } from "./db";

export const HIGHLIGHT_COLORS: HighlightColor[] = [
  "yellow",
  "green",
  "blue",
];

export type ReaderLocationSnapshot = {
  locator: string;
  text: string;
  progressPercent: number;
  pageNumber?: number;
};

export type ReaderTextSelection = ReaderLocationSnapshot;

export function partitionAnnotations(records: AnnotationRecord[]) {
  return {
    bookmarks: records.filter((record) => record.kind === "bookmark"),
    highlights: records.filter((record) => record.kind === "highlight"),
  };
}

export function findBookmarkAtSnapshot(
  records: AnnotationRecord[],
  snapshot: ReaderLocationSnapshot | null
): AnnotationRecord | null {
  if (!snapshot) return null;
  return (
    records.find(
      (record) =>
        record.kind === "bookmark" && record.locator === snapshot.locator
    ) ?? null
  );
}

export function upsertHighlightRecord(
  records: AnnotationRecord[],
  incoming: AnnotationRecord
): AnnotationRecord[] {
  const existing = records.find(
    (record) =>
      record.kind === "highlight" && record.locator === incoming.locator
  );
  if (!existing) return [...records, incoming];
  return records.map((record) =>
    record.id === existing.id
      ? { ...incoming, id: existing.id, createdAt: existing.createdAt }
      : record
  );
}
