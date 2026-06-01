import { describe, expect, it } from "vitest";
import {
  selectFeaturedLibraryBook,
  selectRecentShelfBooks,
  type LibraryShelfBook,
} from "./libraryShelves";

function makeBook(overrides: Partial<LibraryShelfBook> = {}): LibraryShelfBook {
  return {
    id: overrides.id ?? "book",
    createdAt: overrides.createdAt ?? "2024-01-01T00:00:00.000Z",
    lastOpenedAt: overrides.lastOpenedAt,
  };
}

describe("library shelf selection", () => {
  it("selects the most recently opened book as the featured book", () => {
    const oldest = makeBook({ id: "old", lastOpenedAt: "2024-01-02T00:00:00.000Z" });
    const newest = makeBook({ id: "new", lastOpenedAt: "2024-01-03T00:00:00.000Z" });

    expect(selectFeaturedLibraryBook([oldest, newest])?.id).toBe("new");
  });

  it("falls back to createdAt when a book has never been opened", () => {
    const older = makeBook({ id: "older", createdAt: "2024-01-01T00:00:00.000Z" });
    const newer = makeBook({ id: "newer", createdAt: "2024-01-04T00:00:00.000Z" });

    expect(selectFeaturedLibraryBook([older, newer])?.id).toBe("newer");
  });

  it("returns recent shelf books without the excluded featured book", () => {
    const books = [
      makeBook({ id: "a", lastOpenedAt: "2024-01-04T00:00:00.000Z" }),
      makeBook({ id: "b", lastOpenedAt: "2024-01-03T00:00:00.000Z" }),
      makeBook({ id: "c", lastOpenedAt: "2024-01-02T00:00:00.000Z" }),
    ];

    expect(selectRecentShelfBooks(books, { excludeId: "a", limit: 4 }).map((book) => book.id)).toEqual([
      "b",
      "c",
    ]);
  });

  it("limits shelf books to the requested count", () => {
    const books = [
      makeBook({ id: "a", lastOpenedAt: "2024-01-04T00:00:00.000Z" }),
      makeBook({ id: "b", lastOpenedAt: "2024-01-03T00:00:00.000Z" }),
      makeBook({ id: "c", lastOpenedAt: "2024-01-02T00:00:00.000Z" }),
    ];

    expect(selectRecentShelfBooks(books, { limit: 2 }).map((book) => book.id)).toEqual(["a", "b"]);
  });
});
