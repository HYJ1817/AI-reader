"use client";

import type { RefObject } from "react";
import LibraryBookResults from "@/app/LibraryBookResults";
import type { LibraryViewMode } from "@/lib/appPreferences";
import type { BookGroup, BookMetadata } from "@/lib/db";
import type { ReadingProgressMap } from "@/lib/libraryProgress";
import { UI_TEXT } from "@/lib/uiText";
import styles from "./page.module.css";

export type LibrarySearchSurfaceProps = {
  books: BookMetadata[];
  groups: BookGroup[];
  visibleBooks: BookMetadata[];
  query: string;
  mode: LibraryViewMode;
  progressMap: ReadingProgressMap;
  loading: boolean;
  importError: string | null;
  totalMatchCount: number;
  sentinelRef: RefObject<HTMLDivElement | null>;
  onClearQuery: () => void;
  onImportBooks: () => void;
  onPressBook: (book: BookMetadata, originId: string) => void;
  onOpenBookActions: (book: BookMetadata) => void;
};

const EMPTY_ENTRANCE_ORDER = new Map<string, number>();

export default function LibrarySearchSurface({
  books,
  groups,
  visibleBooks,
  query,
  mode,
  progressMap,
  loading,
  importError,
  totalMatchCount,
  sentinelRef,
  onClearQuery,
  onImportBooks,
  onPressBook,
  onOpenBookActions,
}: LibrarySearchSurfaceProps) {
  return (
    <section
      className={styles.librarySearchSurface}
      data-library-search-surface="true"
      aria-label={UI_TEXT.SEARCH}
    >
      <h1 className={styles.screenReaderOnly}>{UI_TEXT.SEARCH}</h1>
      {loading ? (
        <div className={styles.emptyStateCompact}>
          <p className={styles.emptyText}>{UI_TEXT.LOADING}</p>
        </div>
      ) : books.length === 0 ? (
        <div className={styles.emptyStateCompact}>
          {importError && (
            <p className={styles.importError} role="alert">
              {importError}
            </p>
          )}
          <h2 className={styles.emptyTitle}>{UI_TEXT.NO_BOOKS}</h2>
          <p className={styles.emptyText}>{UI_TEXT.NO_BOOKS_HINT}</p>
          <p className={styles.emptyPrivacyText}>{UI_TEXT.LOCAL_STORAGE_ONLY}</p>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={onImportBooks}
          >
            {importError ? UI_TEXT.RESELECT_FILE : UI_TEXT.IMPORT_BOOKS}
          </button>
        </div>
      ) : totalMatchCount === 0 ? (
        <div className={styles.emptyStateCompact}>
          <h2 className={styles.emptyTitle}>{UI_TEXT.NO_MATCHING_BOOKS}</h2>
          <p className={styles.emptyText}>{query}</p>
          <button
            type="button"
            className={styles.emptyRecoveryButton}
            onClick={onClearQuery}
          >
            {UI_TEXT.CLEAR_SEARCH}
          </button>
        </div>
      ) : (
        <div className={styles.librarySearchResults}>
          <LibraryBookResults
            books={visibleBooks}
            groups={groups}
            mode={mode}
            progressMap={progressMap}
            editing={false}
            selectedBookIds={[]}
            entranceOrder={EMPTY_ENTRANCE_ORDER}
            originPrefix="library-search"
            layoutGroupId="library-search-books"
            onPressBook={onPressBook}
            onOpenBookActions={onOpenBookActions}
          />
          {visibleBooks.length < totalMatchCount && (
            <div
              ref={sentinelRef}
              className={styles.libraryLoadSentinel}
              aria-hidden="true"
            />
          )}
        </div>
      )}
    </section>
  );
}
