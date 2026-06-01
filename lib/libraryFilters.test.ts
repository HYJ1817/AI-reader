import { describe, expect, it } from "vitest";
import type { BookRecord } from "./db";
import { filterBooksByQuery } from "./libraryFilters";

function makeBook(overrides: Partial<BookRecord>): BookRecord {
  return {
    id: overrides.id ?? "book",
    title: overrides.title ?? "Book",
    format: overrides.format ?? "txt",
    fileName: overrides.fileName ?? "book.txt",
    fileBlob: new Blob(["content"]),
    size: overrides.size ?? 100,
    createdAt: overrides.createdAt ?? "2024-01-01T00:00:00Z",
    lastOpenedAt: overrides.lastOpenedAt,
    groupIds: overrides.groupIds,
  };
}

describe("filterBooksByQuery", () => {
  it("returns all books for empty query", () => {
    const books = [makeBook({ id: "a" }), makeBook({ id: "b" })];
    expect(filterBooksByQuery(books, "   ")).toEqual(books);
  });

  it("matches title case-insensitively", () => {
    const books = [
      makeBook({ id: "a", title: "高兴" }),
      makeBook({ id: "b", title: "Dune" }),
    ];
    expect(filterBooksByQuery(books, "dune").map((book) => book.id)).toEqual(["b"]);
  });

  it("matches file name and format", () => {
    const books = [
      makeBook({ id: "a", fileName: "novel.epub", format: "epub" }),
      makeBook({ id: "b", fileName: "notes.txt", format: "txt" }),
    ];
    expect(filterBooksByQuery(books, "epub").map((book) => book.id)).toEqual(["a"]);
    expect(filterBooksByQuery(books, "notes").map((book) => book.id)).toEqual(["b"]);
  });
});
