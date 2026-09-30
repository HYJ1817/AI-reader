import { describe, expect, it } from "vitest";
import type { BookRecord } from "./db";
import { filterBooksByQuery, getBookSearchContext } from "./libraryFilters";

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
    enrichment: overrides.enrichment,
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

  const enriched = makeBook({
    id: "enriched",
    title: "local-import",
    fileName: "archive.txt",
    enrichment: {
      status: "complete",
      attemptedAt: "2024-01-01T00:00:00Z",
      bibliographicTitle: "Ｃapital　Theory",
      authors: ["Karl   Marx", "Second Author"],
      subjects: ["Political Economy", "经典"],
      description: "Excluded prose",
    },
  });

  it.each(["capital theory", "karl marx", "second", "political economy", "经典"])(
    "searches enriched metadata for %s without changing the original title",
    (query) => {
      expect(filterBooksByQuery([enriched], query)).toEqual([enriched]);
      expect(enriched.title).toBe("local-import");
    }
  );

  it("normalizes compatibility characters, case and whitespace in queries and fields", () => {
    expect(filterBooksByQuery([enriched], "  ＣＡＰＩＴＡＬ\tMARX\nＴＸＴ  ")).toEqual([enriched]);
    expect(filterBooksByQuery([makeBook({ title: "Cafe\u0301" })], "CAFÉ")).toHaveLength(1);
  });

  it("requires every token while allowing tokens to match different fields", () => {
    expect(filterBooksByQuery([enriched], "local archive theory marx 经典 txt")).toEqual([enriched]);
    expect(filterBooksByQuery([enriched], "capital missing")).toEqual([]);
    expect(filterBooksByQuery([enriched], "excluded")).toEqual([]);
  });

  it("preserves input order and handles books with absent or partial enrichment", () => {
    const books = [makeBook({ id: "z" }), enriched, makeBook({ id: "a", enrichment: {
      status: "pending", attemptedAt: "2024-01-01T00:00:00Z",
    } })];
    expect(filterBooksByQuery(books, "txt")).toEqual(books);
    expect(filterBooksByQuery(books, "\t　\n")).toBe(books);
  });

  it("explains differing enriched titles and matching authors and tags only during search", () => {
    expect(getBookSearchContext(enriched, "marx 经典")).toEqual([
      "书名：Ｃapital　Theory", "作者：Karl   Marx", "标签：经典",
    ]);
    expect(getBookSearchContext(enriched, "archive")).toEqual(["书名：Ｃapital　Theory"]);
    expect(getBookSearchContext(enriched, "  ")).toEqual([]);
    expect(getBookSearchContext(makeBook({ title: "Capital", enrichment: {
      ...enriched.enrichment!, bibliographicTitle: "ＣＡＰＩＴＡＬ",
    } }), "capital")).toEqual([]);
  });
});
