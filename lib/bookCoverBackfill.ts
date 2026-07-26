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

export type BookCoverBackfillRunner<Input> = {
  start: (input: Input) => Promise<void>;
  cancel: () => void;
  cancelAndDrain: () => Promise<void>;
};

export function createBookCoverBackfillRunner<Input>(
  run: (input: Input, signal: AbortSignal) => Promise<void>
): BookCoverBackfillRunner<Input> {
  let currentController: AbortController | null = null;
  let tail: Promise<void> = Promise.resolve();

  const cancel = () => {
    currentController?.abort();
  };

  return {
    start(input) {
      cancel();
      const controller = new AbortController();
      currentController = controller;
      const predecessor = tail.catch(() => undefined);
      const task = predecessor
        .then(async () => {
          if (controller.signal.aborted) return;
          await run(input, controller.signal);
        })
        .finally(() => {
          if (currentController === controller) currentController = null;
        });
      tail = task;
      return task;
    },
    cancel,
    async cancelAndDrain() {
      cancel();
      await tail.catch(() => undefined);
    },
  };
}

export function mergeBookCoverMetadata(
  books: BookMetadata[],
  bookId: string,
  coverImageBlob: Blob
): BookMetadata[] {
  const matchingBook = books.find((book) => book.id === bookId);
  if (!matchingBook || matchingBook.coverImageBlob) return books;
  return books.map((book) =>
    book.id === bookId ? { ...book, coverImageBlob } : book
  );
}

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
