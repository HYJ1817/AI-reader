import type { BookMetadata } from "./db";

export type BookCoverBackfillOptions = {
  books: BookMetadata[];
  getVisibleBookIds: () => readonly string[];
  loadCover: (bookId: string) => Promise<Blob | undefined>;
  onCover: (bookId: string, coverImageBlob: Blob) => void;
  signal?: AbortSignal;
};

export type BookCoverBackfillResult = {
  attemptedIds: string[];
  completedIds: string[];
};

export async function runBookCoverBackfill({
  books,
  getVisibleBookIds,
  loadCover,
  onCover,
  signal,
}: BookCoverBackfillOptions): Promise<BookCoverBackfillResult> {
  const candidates = books.filter(
    (book) => book.format === "epub" && !book.coverImageBlob
  );
  const attempted = new Set<string>();
  const attemptedIds: string[] = [];
  const completedIds: string[] = [];

  while (!signal?.aborted) {
    const visibleIds = new Set(getVisibleBookIds());
    const nextBook =
      candidates.find(
        (book) => !attempted.has(book.id) && visibleIds.has(book.id)
      ) ?? candidates.find((book) => !attempted.has(book.id));
    if (!nextBook) break;

    attempted.add(nextBook.id);
    attemptedIds.push(nextBook.id);

    try {
      const coverImageBlob = await loadCover(nextBook.id);
      if (!coverImageBlob || signal?.aborted) continue;
      onCover(nextBook.id, coverImageBlob);
      completedIds.push(nextBook.id);
    } catch {
      // A damaged or unreadable book keeps its fallback cover; continue the queue.
    }
  }

  return { attemptedIds, completedIds };
}
