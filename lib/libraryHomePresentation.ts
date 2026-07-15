import {
  selectRecentlyOpenedLibraryBook,
  type LibraryShelfBook,
} from "./libraryShelves";

export type LibraryHomePresentationInput<T extends LibraryShelfBook> = {
  books: T[];
  filteredBooks: T[];
  searchQuery: string;
  groupFilter: string | null;
  editing: boolean;
};

export type LibraryHomePresentation<T extends LibraryShelfBook> = {
  featuredBook: T | null;
  shelfBooks: T[];
  featuredLayout: boolean;
};

export function buildLibraryHomePresentation<T extends LibraryShelfBook>({
  books,
  filteredBooks,
  searchQuery,
  groupFilter,
  editing,
}: LibraryHomePresentationInput<T>): LibraryHomePresentation<T> {
  const canFeature =
    !editing && searchQuery.trim() === "" && groupFilter === null;
  const featuredBook = canFeature
    ? selectRecentlyOpenedLibraryBook(books)
    : null;

  return {
    featuredBook,
    shelfBooks: featuredBook
      ? filteredBooks.filter((book) => book.id !== featuredBook.id)
      : filteredBooks,
    featuredLayout: featuredBook !== null,
  };
}
