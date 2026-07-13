"use client";

import type { RefObject } from "react";
import MotionBookCover from "@/app/MotionBookCover";
import type { LibraryViewMode } from "@/lib/appPreferences";
import type { BookGroup, BookRecord } from "@/lib/db";
import {
  formatLibraryProgressValue,
  getBookProgressPercent,
  type ReadingProgressMap,
} from "@/lib/libraryProgress";
import { formatBookSize } from "@/lib/libraryPresentation";
import { UI_TEXT } from "@/lib/uiText";
import styles from "./page.module.css";

export type LibrarySurfaceProps = {
  className: string;
  ariaHidden: boolean;
  data: {
    books: BookRecord[];
    visibleBooks: BookRecord[];
    filteredBookCount: number;
    groups: BookGroup[];
    progressMap: ReadingProgressMap;
    loading: boolean;
    importError: string | null;
  };
  view: {
    searchQuery: string;
    mode: LibraryViewMode;
    activeCollectionName: string;
    groupFilter: string | null;
    visibleBookCount: number;
  };
  editing: {
    library: boolean;
    selectedBookIds: string[];
    selectedCountLabel: string;
    allVisibleSelected: boolean;
  };
  sentinelRef: RefObject<HTMLDivElement | null>;
  actions: {
    importBooks: () => void;
    openCollections: () => void;
    setSearchQuery: (query: string) => void;
    setViewMode: (mode: LibraryViewMode) => void;
    toggleLibraryEditing: () => void;
    selectAllVisible: () => void;
    pressBook: (book: BookRecord, originId: string) => void;
    openBookActions: (book: BookRecord) => void;
  };
};

export default function LibrarySurface({
  className,
  ariaHidden,
  data,
  view,
  editing,
  sentinelRef,
  actions,
}: LibrarySurfaceProps) {
  const {
    books,
    visibleBooks,
    filteredBookCount,
    groups,
    progressMap,
    loading,
    importError,
  } = data;
  return (
    <div className={className} aria-hidden={ariaHidden}>
      <div className={styles.pageHeader}>
        <h1 className={styles.libraryTitle}>{UI_TEXT.LIBRARY}</h1>
        <div className={styles.pageHeaderActions}>
          {books.length > 0 && (
            <button
              className={styles.libraryTextButton}
              onClick={actions.toggleLibraryEditing}
            >
              {editing.library ? UI_TEXT.DONE : UI_TEXT.EDIT}
            </button>
          )}
          {!editing.library && (
            <button
              className={styles.libraryActionButton}
              title={UI_TEXT.IMPORT}
              aria-label={UI_TEXT.IMPORT}
              onClick={actions.importBooks}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M10 3v10m0 0l-3-3m3 3l3-3M3 17h14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {UI_TEXT.IMPORT}
            </button>
          )}
        </div>
      </div>

      <div>
          <button className={styles.collectionEntryRow} onClick={actions.openCollections}>
            <span className={styles.collectionEntryIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                <path d="M4 6.5h6.5c1.1 0 2 .9 2 2v9.5H6a2 2 0 0 1-2-2V6.5Z" />
                <path d="M12.5 8.5c0-1.1.9-2 2-2H21V16a2 2 0 0 1-2 2h-6.5V8.5Z" />
              </svg>
            </span>
            <span className={styles.collectionEntryText}>
              <strong>{UI_TEXT.COLLECTIONS}</strong>
              <small>{books.length} {UI_TEXT.BOOK_COUNT}</small>
            </span>
            <span className={styles.continueChevron}>{"\u203a"}</span>
          </button>

          {books.length > 0 && (
            <div className={styles.librarySearchRow}>
              <label className={styles.librarySearchBox}>
                <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                  <circle cx="9" cy="9" r="5.5" />
                  <path d="m13 13 3.5 3.5" strokeLinecap="round" />
                </svg>
                <input
                  type="search"
                  value={view.searchQuery}
                  onChange={(event) => actions.setSearchQuery(event.target.value)}
                  placeholder={UI_TEXT.SEARCH_LIBRARY_PLACEHOLDER}
                  aria-label={UI_TEXT.SEARCH}
                />
              </label>
              <div className={styles.libraryViewToggle} aria-label={UI_TEXT.GRID_VIEW}>
                {(["grid", "list"] as const).map((mode) => (
                  <button
                    key={mode}
                    className={view.mode === mode ? styles.libraryViewActive : ""}
                    onClick={() => actions.setViewMode(mode)}
                    aria-label={mode === "grid" ? UI_TEXT.GRID_VIEW : UI_TEXT.LIST_VIEW}
                    title={mode === "grid" ? UI_TEXT.GRID_VIEW : UI_TEXT.LIST_VIEW}
                  >
                    {mode === "grid" ? (
                      <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                        <rect x="3" y="3" width="5" height="5" rx="1" />
                        <rect x="12" y="3" width="5" height="5" rx="1" />
                        <rect x="3" y="12" width="5" height="5" rx="1" />
                        <rect x="12" y="12" width="5" height="5" rx="1" />
                      </svg>
                    ) : (
                      <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                        <path d="M4 5h12M4 10h12M4 15h12" strokeLinecap="round" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className={styles.emptyStateCompact}>
              <p className={styles.emptyText}>{UI_TEXT.LOADING}</p>
            </div>
          ) : books.length === 0 ? (
            <div className={styles.emptyStateCompact}>
              {importError && <p className={styles.importError}>{importError}</p>}
              <h2 className={styles.emptyTitle}>{UI_TEXT.NO_BOOKS}</h2>
              <p className={styles.emptyText}>{UI_TEXT.NO_BOOKS_HINT}</p>
              <button className={styles.primaryButton} onClick={actions.importBooks}>
                {UI_TEXT.IMPORT}
              </button>
            </div>
          ) : (
            <div className={styles.bookList}>
              {importError && <p className={styles.importError}>{importError}</p>}
              <div className={styles.sectionHeader}>
                <h2>{UI_TEXT.RECENT_BOOKS}</h2>
                {editing.library ? (
                  <button className={styles.libraryTextButton} onClick={actions.selectAllVisible}>
                    {editing.allVisibleSelected ? UI_TEXT.CLEAR_SELECTION : UI_TEXT.SELECT_ALL}
                  </button>
                ) : (
                  <span>{view.activeCollectionName} · {filteredBookCount}</span>
                )}
              </div>
              {editing.library && (
                <p className={styles.selectionSummary}>{editing.selectedCountLabel}</p>
              )}
              {filteredBookCount === 0 ? (
                <div className={styles.emptyStateCompact}>
                  <h2 className={styles.emptyTitle}>{UI_TEXT.NO_MATCHING_BOOKS}</h2>
                  <p className={styles.emptyText}>{view.searchQuery || UI_TEXT.UNGROUPED}</p>
                </div>
              ) : view.mode === "grid" ? (
                <div className={styles.bookGrid}>
                  {visibleBooks.map((book) => {
                    const isSelected = editing.selectedBookIds.includes(book.id);
                    const progress = getBookProgressPercent(progressMap, book.id);
                    const originId = `library-grid-${book.id}`;
                    return (
                      <div
                        key={book.id}
                        className={`${styles.bookGridCell} ${editing.library ? styles.bookSelectable : ""} ${isSelected ? styles.bookSelected : ""}`}
                      >
                        <button
                          className={styles.bookGridItem}
                          onClick={() => actions.pressBook(book, originId)}
                          aria-pressed={editing.library ? isSelected : undefined}
                        >
                          <MotionBookCover book={book} originId={originId} />
                          <span className={styles.bookGridTitle}>{book.title}</span>
                          <span className={styles.bookGridMeta}>
                            {formatLibraryProgressValue(progress)}
                          </span>
                        </button>
                        {editing.library ? (
                          <span className={styles.selectionBadge} aria-hidden="true">
                            {isSelected && <Checkmark />}
                          </span>
                        ) : (
                          <MoreButton
                            className={styles.bookGridMoreButton}
                            size={18}
                            onClick={() => actions.openBookActions(book)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <ul className={styles.bookItems}>
                  {visibleBooks.map((book) => {
                    const isSelected = editing.selectedBookIds.includes(book.id);
                    const progress = getBookProgressPercent(progressMap, book.id);
                    const originId = `library-list-${book.id}`;
                    return (
                      <li
                        key={book.id}
                        className={`${styles.bookItem} ${editing.library ? styles.bookSelectable : ""} ${isSelected ? styles.bookSelected : ""}`}
                        onClick={() => actions.pressBook(book, originId)}
                      >
                        {editing.library && (
                          <span className={styles.selectionBadgeInline} aria-hidden="true">
                            {isSelected && <Checkmark />}
                          </span>
                        )}
                        <MotionBookCover book={book} originId={originId} />
                        <div className={styles.bookInfo}>
                          <span className={styles.bookTitle}>{book.title}</span>
                          <span className={styles.bookMeta}>
                            {book.format.toUpperCase()}{" \u00b7 "}{formatBookSize(book.size)}
                          </span>
                          <span className={styles.bookListProgressRow}>
                            {formatLibraryProgressValue(progress)}
                          </span>
                          {book.groupIds && book.groupIds.length > 0 && (
                            <span className={styles.bookGroupLabels}>
                              {book.groupIds
                                .map((groupId) => groups.find((group) => group.id === groupId)?.name)
                                .filter(Boolean)
                                .join(", ")}
                            </span>
                          )}
                        </div>
                        {!editing.library && (
                          <MoreButton
                            className={styles.bookMoreButton}
                            onClick={(event) => {
                              event.stopPropagation();
                              actions.openBookActions(book);
                            }}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {view.visibleBookCount < filteredBookCount && (
                <div ref={sentinelRef} className={styles.libraryLoadSentinel} aria-hidden="true" />
              )}
            </div>
          )}
        </div>
    </div>
  );
}

function Checkmark() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3.5 8.3 6.7 11.5 12.8 4.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MoreButton({
  className,
  size = 20,
  onClick,
}: {
  className: string;
  size?: number;
  onClick: React.MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <button
      className={className}
      title={UI_TEXT.MORE}
      aria-label={UI_TEXT.MORE_OPTIONS}
      onClick={onClick}
    >
      <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <circle cx="10" cy="4" r="1.5" />
        <circle cx="10" cy="10" r="1.5" />
        <circle cx="10" cy="16" r="1.5" />
      </svg>
    </button>
  );
}
