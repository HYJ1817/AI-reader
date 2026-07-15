import { describe, expect, it } from "vitest";
import type { LibraryShelfBook } from "./libraryShelves";
import { buildLibraryHomePresentation } from "./libraryHomePresentation";

interface Book extends LibraryShelfBook {
  title: string;
  createdAt: string;
}

function makeBook(
  id: string,
  lastOpenedAt?: string,
  createdAt = "2024-01-01T00:00:00.000Z"
): Book {
  return {
    id,
    title: `Book ${id}`,
    createdAt,
    lastOpenedAt,
  };
}

describe("library home presentation", () => {
  it("features the most recently opened book on the neutral all-books root and removes it from the shelf", () => {
    const older = makeBook("older", "2024-01-02T00:00:00.000Z");
    const recentlyOpened = makeBook("recent", "2024-01-03T00:00:00.000Z");
    const unread = makeBook("unread");
    const books = [older, recentlyOpened, unread];

    expect(
      buildLibraryHomePresentation({
        books,
        filteredBooks: books,
        searchQuery: "",
        groupFilter: null,
        editing: false,
      })
    ).toEqual({
      featuredBook: recentlyOpened,
      shelfBooks: [older, unread],
      featuredLayout: true,
    });
  });

  it("keeps the full shelf when no book has been opened", () => {
    const books = [
      makeBook("older", undefined, "2024-01-01T00:00:00.000Z"),
      makeBook("newer", undefined, "2024-01-02T00:00:00.000Z"),
    ];

    expect(
      buildLibraryHomePresentation({
        books,
        filteredBooks: books,
        searchQuery: "",
        groupFilter: null,
        editing: false,
      })
    ).toEqual({
      featuredBook: null,
      shelfBooks: books,
      featuredLayout: false,
    });
  });

  it.each([
    ["a search query with surrounding whitespace", "  recent  ", null, false],
    ["a selected group", "", "favorites", false],
    ["editing mode", "", null, true],
  ])("disables the feature for %s and keeps the full active filtered dataset", (
    _context,
    searchQuery,
    groupFilter,
    editing
  ) => {
    const featuredCandidate = makeBook("recent", "2024-01-03T00:00:00.000Z");
    const filteredBook = makeBook("filtered", "2024-01-02T00:00:00.000Z");
    const books = [featuredCandidate, filteredBook, makeBook("unread")];
    const filteredBooks = [featuredCandidate, filteredBook];

    expect(
      buildLibraryHomePresentation({
        books,
        filteredBooks,
        searchQuery,
        groupFilter,
        editing,
      })
    ).toEqual({
      featuredBook: null,
      shelfBooks: filteredBooks,
      featuredLayout: false,
    });
  });

  it("allows a single opened book to live only in the feature", () => {
    const book = makeBook("only", "2024-01-03T00:00:00.000Z");

    expect(
      buildLibraryHomePresentation({
        books: [book],
        filteredBooks: [book],
        searchQuery: "",
        groupFilter: null,
        editing: false,
      })
    ).toEqual({
      featuredBook: book,
      shelfBooks: [],
      featuredLayout: true,
    });
  });
});
