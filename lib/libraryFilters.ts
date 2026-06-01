import type { BookRecord } from "./db";

export function filterBooksByQuery(books: BookRecord[], query: string): BookRecord[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return books;
  return books.filter((book) => {
    const title = book.title.toLocaleLowerCase();
    const fileName = book.fileName.toLocaleLowerCase();
    const format = book.format.toLocaleLowerCase();
    return title.includes(normalized) || fileName.includes(normalized) || format.includes(normalized);
  });
}
