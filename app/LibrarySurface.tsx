"use client";

import { useState, type RefObject } from "react";
import { AnimatePresence, LayoutGroup, m } from "motion/react";
import { useAppReducedMotion } from "@/app/AppMotionRoot";
import MotionBookCover from "@/app/MotionBookCover";
import type { LibraryViewMode } from "@/lib/appPreferences";
import type { BookGroup, BookRecord } from "@/lib/db";
import {
  getBookProgressPercent,
  type ReadingProgressMap,
} from "@/lib/libraryProgress";
import { buildLibraryBookPresentation } from "@/lib/libraryPresentation";
import { MOTION_DURATION, MOTION_SPRING } from "@/lib/motionSystem";
import { UI_TEXT } from "@/lib/uiText";
import styles from "./page.module.css";

export type LibrarySurfaceProps = {
  className: string;
  ariaHidden: boolean;
  data: {
    books: BookRecord[];
    visibleBooks: BookRecord[];
    filteredBookCount: number;
    featuredBook: BookRecord | null;
    featuredLayout: boolean;
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
    featuredBook,
    featuredLayout,
    groups,
    progressMap,
    loading,
    importError,
  } = data;
  const reduceMotion = useAppReducedMotion();
  const bookIds = books.map((book) => book.id);
  const visibleBookIds = visibleBooks.map((book) => book.id);
  const currentSignature = JSON.stringify({
    bookIds,
    visibleBookIds,
    count: view.visibleBookCount,
    searchQuery: view.searchQuery,
    groupFilter: view.groupFilter,
  });
  const [libraryMotionSnapshot, setLibraryMotionSnapshot] = useState<{
    signature: string;
    bookIds: Set<string>;
    ids: Set<string>;
    count: number;
    searchQuery: string;
    groupFilter: string | null;
    entranceOrder: Map<string, number>;
  }>(() => ({
    signature: currentSignature,
    bookIds: new Set(bookIds),
    ids: new Set(visibleBookIds),
    count: view.visibleBookCount,
    searchQuery: view.searchQuery,
    groupFilter: view.groupFilter,
    entranceOrder: new Map(),
  }));

  if (libraryMotionSnapshot.signature !== currentSignature) {
    const previousBookSnapshot = libraryMotionSnapshot;
    const newlyAddedBookIds = new Set(
      bookIds.filter((bookId) => !previousBookSnapshot.bookIds.has(bookId))
    );

    if (
      previousBookSnapshot.searchQuery === view.searchQuery &&
      previousBookSnapshot.groupFilter === view.groupFilter &&
      view.visibleBookCount > previousBookSnapshot.count
    ) {
      for (const bookId of visibleBookIds) {
        if (!previousBookSnapshot.ids.has(bookId)) {
          newlyAddedBookIds.add(bookId);
        }
      }
    }

    setLibraryMotionSnapshot({
      signature: currentSignature,
      bookIds: new Set(bookIds),
      ids: new Set(visibleBookIds),
      count: view.visibleBookCount,
      searchQuery: view.searchQuery,
      groupFilter: view.groupFilter,
      entranceOrder: new Map(
        visibleBooks
          .filter((book) => newlyAddedBookIds.has(book.id))
          .slice(0, 6)
          .map((book, index) => [book.id, index])
      ),
    });
  }

  const entranceOrder = libraryMotionSnapshot.entranceOrder;
  const featuredOriginId = featuredBook
    ? `library-${view.mode}-${featuredBook.id}`
    : "";
  const featuredProgress = featuredBook
    ? getBookProgressPercent(progressMap, featuredBook.id)
    : 0;
  const featuredPresentation = featuredBook
    ? buildLibraryBookPresentation(featuredBook, featuredProgress)
    : null;

  return (
    <div
      className={className}
      aria-hidden={ariaHidden}
      data-library-loading={loading ? "true" : "false"}
    >
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
              <div
                className={styles.libraryViewToggle}
                role="group"
                aria-label={UI_TEXT.GRID_VIEW}
              >
                {(["grid", "list"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={view.mode === mode ? styles.libraryViewActive : ""}
                    onClick={() => actions.setViewMode(mode)}
                    aria-pressed={view.mode === mode}
                    aria-label={mode === "grid" ? UI_TEXT.GRID_VIEW : UI_TEXT.LIST_VIEW}
                    title={mode === "grid" ? UI_TEXT.GRID_VIEW : UI_TEXT.LIST_VIEW}
                  >
                    {view.mode === mode && (
                      <m.span
                        className={styles.libraryViewIndicator}
                        layoutId={
                          reduceMotion ? undefined : "library-view-indicator"
                        }
                        transition={MOTION_SPRING.navigation}
                        aria-hidden="true"
                      />
                    )}
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
            <>
            <AnimatePresence initial={false} mode="popLayout">
              {featuredBook && featuredPresentation && (
                <m.section
                  key={featuredBook.id}
                  className={styles.libraryFeatured}
                  data-library-featured="true"
                  initial={
                    reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }
                  }
                  animate={
                    reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }
                  }
                  exit={
                    reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }
                  }
                  transition={
                    reduceMotion
                      ? { duration: MOTION_DURATION.reduced }
                      : { duration: MOTION_DURATION.state }
                  }
                >
                  <button
                    type="button"
                    className={styles.libraryFeaturedButton}
                    aria-label={`${UI_TEXT.CONTINUE_READING}：${featuredBook.title}`}
                    onClick={() =>
                      actions.pressBook(featuredBook, featuredOriginId)
                    }
                  >
                    <MotionBookCover
                      book={featuredBook}
                      originId={featuredOriginId}
                    />
                    <span className={styles.libraryFeaturedCopy}>
                      <span className={styles.libraryFeaturedContext}>
                        {featuredPresentation.lastReadLabel}
                      </span>
                      <span className={styles.libraryFeaturedTitle}>
                        {featuredBook.title}
                      </span>
                      <span className={styles.libraryFeaturedSource}>
                        {featuredPresentation.sourceLabel}
                      </span>
                      {featuredPresentation.showProgress && (
                        <span className={styles.libraryFeaturedProgress}>
                          <span aria-hidden="true">
                            <span
                              style={{
                                width: `${featuredPresentation.progressPercent}%`,
                              }}
                            />
                          </span>
                          <small>{featuredPresentation.progressLabel}</small>
                        </span>
                      )}
                      <span className={styles.libraryFeaturedContinue}>
                        {UI_TEXT.CONTINUE_READING}
                        <span aria-hidden="true">{"\u203a"}</span>
                      </span>
                    </span>
                  </button>
                </m.section>
              )}
            </AnimatePresence>
            <div className={styles.bookList} data-library-shelf="true">
              {importError && <p className={styles.importError}>{importError}</p>}
              <div className={styles.sectionHeader}>
                <h2>
                  {featuredLayout ? UI_TEXT.OTHER_BOOKS : UI_TEXT.RECENT_BOOKS}
                </h2>
                {editing.library ? (
                  <button className={styles.libraryTextButton} onClick={actions.selectAllVisible}>
                    {editing.allVisibleSelected ? UI_TEXT.CLEAR_SELECTION : UI_TEXT.SELECT_ALL}
                  </button>
                ) : (
                  <button
                    className={styles.libraryShelfAction}
                    data-library-collections="true"
                    aria-label={`${UI_TEXT.COLLECTIONS}：${view.activeCollectionName}，${filteredBookCount} ${UI_TEXT.BOOK_COUNT}`}
                    onClick={actions.openCollections}
                  >
                    <span>{view.activeCollectionName}</span>
                    <small>{filteredBookCount}</small>
                    <span aria-hidden="true">{"\u203a"}</span>
                  </button>
                )}
              </div>
              {editing.library && (
                <p className={styles.selectionSummary}>{editing.selectedCountLabel}</p>
              )}
              {filteredBookCount === 0 && !featuredLayout ? (
                <div className={styles.emptyStateCompact}>
                  <h2 className={styles.emptyTitle}>{UI_TEXT.NO_MATCHING_BOOKS}</h2>
                  <p className={styles.emptyText}>{view.searchQuery || UI_TEXT.UNGROUPED}</p>
                </div>
              ) : filteredBookCount > 0 ? (
                <LayoutGroup id="library-books">
                {view.mode === "grid" ? (
                <m.div
                  className={styles.bookGrid}
                  layout={reduceMotion ? false : "position"}
                >
                  <AnimatePresence initial={false} mode="popLayout">
                  {visibleBooks.map((book) => {
                    const isSelected = editing.selectedBookIds.includes(book.id);
                    const progress = getBookProgressPercent(progressMap, book.id);
                    const presentation = buildLibraryBookPresentation(book, progress);
                    const originId = `library-grid-${book.id}`;
                    const entranceIndex = entranceOrder.get(book.id);
                    return (
                      <m.div
                        key={book.id}
                        layout={reduceMotion ? false : "position"}
                        initial={
                          reduceMotion || entranceIndex === undefined
                            ? false
                            : { opacity: 0, y: 8, scale: 0.985 }
                        }
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={
                          reduceMotion
                            ? { opacity: 0 }
                            : { opacity: 0, scale: 0.96 }
                        }
                        transition={
                          reduceMotion
                            ? { duration: MOTION_DURATION.reduced }
                            : {
                                layout: MOTION_SPRING.navigation,
                                duration: MOTION_DURATION.state,
                                delay:
                                  entranceIndex === undefined
                                    ? 0
                                    : entranceIndex * 0.03,
                              }
                        }
                        className={`${styles.bookGridCell} ${editing.library ? styles.bookSelectable : ""} ${isSelected ? styles.bookSelected : ""}`}
                        data-library-book-state={presentation.state}
                      >
                        <button
                          className={styles.bookGridItem}
                          onClick={() => actions.pressBook(book, originId)}
                          aria-pressed={editing.library ? isSelected : undefined}
                        >
                          <MotionBookCover book={book} originId={originId} />
                          <span className={styles.bookGridTitle}>{book.title}</span>
                          <span className={styles.bookGridMeta}>
                            {presentation.progressLabel}
                            {presentation.state !== "unread" && (
                              <> · {presentation.lastReadLabel}</>
                            )}
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
                      </m.div>
                    );
                  })}
                  </AnimatePresence>
                </m.div>
              ) : (
                <ul className={styles.bookItems}>
                  <AnimatePresence initial={false} mode="popLayout">
                  {visibleBooks.map((book) => {
                    const isSelected = editing.selectedBookIds.includes(book.id);
                    const progress = getBookProgressPercent(progressMap, book.id);
                    const presentation = buildLibraryBookPresentation(book, progress);
                    const originId = `library-list-${book.id}`;
                    const entranceIndex = entranceOrder.get(book.id);
                    return (
                      <m.li
                        key={book.id}
                        layout={reduceMotion ? false : "position"}
                        initial={
                          reduceMotion || entranceIndex === undefined
                            ? false
                            : { opacity: 0, y: 8, scale: 0.985 }
                        }
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={
                          reduceMotion
                            ? { opacity: 0 }
                            : { opacity: 0, scale: 0.96 }
                        }
                        transition={
                          reduceMotion
                            ? { duration: MOTION_DURATION.reduced }
                            : {
                                layout: MOTION_SPRING.navigation,
                                duration: MOTION_DURATION.state,
                                delay:
                                  entranceIndex === undefined
                                    ? 0
                                    : entranceIndex * 0.03,
                              }
                        }
                        className={`${styles.bookItem} ${editing.library ? styles.bookSelectable : ""} ${isSelected ? styles.bookSelected : ""}`}
                        data-library-book-state={presentation.state}
                      >
                        <button
                          type="button"
                          className={styles.bookItemMain}
                          data-library-book-open="true"
                          aria-pressed={editing.library ? isSelected : undefined}
                          onClick={() => actions.pressBook(book, originId)}
                        >
                          {editing.library && (
                            <span className={styles.selectionBadgeInline} aria-hidden="true">
                              {isSelected && <Checkmark />}
                            </span>
                          )}
                          <MotionBookCover book={book} originId={originId} />
                          <span className={styles.bookInfo}>
                            <span
                              className={styles.bookTitle}
                              data-library-book-title="true"
                            >
                              {book.title}
                            </span>
                            <span className={styles.bookMeta}>
                              <span>{presentation.sourceLabel}</span>
                              <span aria-hidden="true">·</span>
                              <span>{presentation.lastReadLabel}</span>
                            </span>
                            {presentation.showProgress ? (
                              <span
                                className={styles.bookListProgressRow}
                                data-library-book-progress="true"
                              >
                                <span
                                  className={styles.bookListProgressTrack}
                                  aria-hidden="true"
                                >
                                  <span
                                    style={{ width: `${presentation.progressPercent}%` }}
                                  />
                                </span>
                                <span>{presentation.progressLabel}</span>
                              </span>
                            ) : (
                              <span className={styles.bookListProgressRow}>
                                {presentation.progressLabel}
                              </span>
                            )}
                            {book.groupIds && book.groupIds.length > 0 && (
                              <span className={styles.bookGroupLabels}>
                                {book.groupIds
                                  .map((groupId) => groups.find((group) => group.id === groupId)?.name)
                                  .filter(Boolean)
                                  .join(", ")}
                              </span>
                            )}
                          </span>
                        </button>
                        {!editing.library && (
                          <MoreButton
                            className={styles.bookMoreButton}
                            onClick={() => {
                              actions.openBookActions(book);
                            }}
                          />
                        )}
                      </m.li>
                    );
                  })}
                  </AnimatePresence>
                </ul>
              )}
                </LayoutGroup>
              ) : null}
              {view.visibleBookCount < filteredBookCount && (
                <div ref={sentinelRef} className={styles.libraryLoadSentinel} aria-hidden="true" />
              )}
            </div>
            </>
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
      data-library-book-more="true"
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
