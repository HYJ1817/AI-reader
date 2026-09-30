import type { BookMetadata } from "./db";

function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

function queryTokens(query: string): string[] {
  const normalized = normalizeSearchText(query);
  return normalized ? normalized.split(" ") : [];
}

export function filterBooksByQuery(books: BookMetadata[], query: string): BookMetadata[] {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return books;
  return books.filter((book) => {
    const fields = [
      book.title,
      book.fileName,
      book.format,
      book.enrichment?.bibliographicTitle ?? "",
      ...(book.enrichment?.authors ?? []),
      ...(book.enrichment?.subjects ?? []),
    ].map(normalizeSearchText);
    return tokens.every((token) => fields.some((field) => field.includes(token)));
  });
}

export function getBookSearchContext(book: BookMetadata, query: string): string[] {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return [];
  const context: string[] = [];
  const title = book.enrichment?.bibliographicTitle;
  if (title && normalizeSearchText(title) !== normalizeSearchText(book.title)) {
    context.push(`书名：${title}`);
  }
  const matches = (value: string) =>
    tokens.some((token) => normalizeSearchText(value).includes(token));
  const authors = book.enrichment?.authors?.filter(matches);
  const subjects = book.enrichment?.subjects?.filter(matches);
  if (authors?.length) context.push(`作者：${authors.join("、")}`);
  if (subjects?.length) context.push(`标签：${subjects.join("、")}`);
  return context;
}
