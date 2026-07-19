import { describe, expect, it } from "vitest";
import {
  selectFeaturedLibraryBook,
  selectRecentShelfBooks,
  selectRecentlyOpenedLibraryBook,
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

  it("selects only the most recently opened book for Library continuation, even when a newer-created unread book exists", () => {
    const olderOpened = makeBook({
      id: "older-opened",
      createdAt: "2024-01-01T00:00:00.000Z",
      lastOpenedAt: "2024-01-02T00:00:00.000Z",
    });
    const recentlyOpened = makeBook({
      id: "recently-opened",
      createdAt: "2024-01-01T00:00:00.000Z",
      lastOpenedAt: "2024-01-03T00:00:00.000Z",
    });
    const unread = makeBook({ id: "unread", createdAt: "2024-01-04T00:00:00.000Z" });

    expect(selectRecentlyOpenedLibraryBook([olderOpened, unread, recentlyOpened])?.id).toBe(
      "recently-opened"
    );
  });

  it("returns null when books are unread or lastOpenedAt is invalid", () => {
    const unread = makeBook({ id: "unread" });
    const invalid = makeBook({ id: "invalid", lastOpenedAt: "not-a-date" });

    expect(selectRecentlyOpenedLibraryBook([unread, invalid])).toBeNull();
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
