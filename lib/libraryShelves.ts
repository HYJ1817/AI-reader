export type LibraryShelfBook = {
  id: string;
  createdAt?: string;
  lastOpenedAt?: string;
};

type RecentShelfOptions = {
  excludeId?: string;
  limit?: number;
};

function timestamp(value?: string): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function recencyScore(book: LibraryShelfBook): number {
  return Math.max(timestamp(book.lastOpenedAt), timestamp(book.createdAt));
}

function sortByRecency<T extends LibraryShelfBook>(books: T[]): T[] {
  return [...books].sort((a, b) => recencyScore(b) - recencyScore(a));
}

export function selectFeaturedLibraryBook<T extends LibraryShelfBook>(books: T[]): T | null {
  return sortByRecency(books)[0] ?? null;
}

export function selectRecentlyOpenedLibraryBook<T extends LibraryShelfBook>(
  books: T[]
): T | null {
  return [...books]
    .filter((book) => timestamp(book.lastOpenedAt) > 0)
    .sort((a, b) => timestamp(b.lastOpenedAt) - timestamp(a.lastOpenedAt))[0] ?? null;
}

export function selectRecentShelfBooks<T extends LibraryShelfBook>(
  books: T[],
  options: RecentShelfOptions = {}
): T[] {
  const limit = Math.max(0, options.limit ?? 6);
  return sortByRecency(books)
    .filter((book) => book.id !== options.excludeId)
    .slice(0, limit);
}
