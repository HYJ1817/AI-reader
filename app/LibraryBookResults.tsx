"use client";

import type { CSSProperties } from "react";
import { AnimatePresence, LayoutGroup, m } from "motion/react";
import { useAppReducedMotion } from "@/app/AppMotionRoot";
import MotionBookCover from "@/app/MotionBookCover";
import type { LibraryViewMode } from "@/lib/appPreferences";
import type { BookGroup, BookMetadata } from "@/lib/db";
import {
  getBookProgressPercent,
  type ReadingProgressMap,
} from "@/lib/libraryProgress";
import { buildLibraryBookPresentation } from "@/lib/libraryPresentation";
import { MOTION_DURATION, MOTION_SPRING } from "@/lib/motionSystem";
import { UI_TEXT } from "@/lib/uiText";
import styles from "./page.module.css";

export type LibraryBookResultsProps = {
  books: BookMetadata[];
  groups: BookGroup[];
  mode: LibraryViewMode;
  progressMap: ReadingProgressMap;
  editing: boolean;
  selectedBookIds: readonly string[];
  entranceOrder: ReadonlyMap<string, number>;
  originPrefix: string;
  layoutGroupId: string;
  onPressBook: (book: BookMetadata, originId: string) => void;
  onOpenBookActions: (book: BookMetadata) => void;
};

export default function LibraryBookResults({
  books,
  groups,
  mode,
  progressMap,
  editing,
  selectedBookIds,
  entranceOrder,
  originPrefix,
  layoutGroupId,
  onPressBook,
  onOpenBookActions,
}: LibraryBookResultsProps) {
  const reduceMotion = useAppReducedMotion();

  return (
    <LayoutGroup id={layoutGroupId}>
      <div data-library-result-mode={mode}>
        {mode === "grid" ? (
          <m.div
            className={styles.bookGrid}
            layout={reduceMotion ? false : "position"}
          >
            <AnimatePresence initial={false} mode="popLayout">
              {books.map((book) => {
                const isSelected = selectedBookIds.includes(book.id);
                const progress = getBookProgressPercent(progressMap, book.id);
                const presentation = buildLibraryBookPresentation(book, progress);
                const originId = `${originPrefix}-${mode}-${book.id}`;
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
                    className={`${styles.bookGridCell} ${editing ? styles.bookSelectable : ""} ${isSelected ? styles.bookSelected : ""}`}
                    data-library-book-state={presentation.state}
                  >
                    <button
                      type="button"
                      className={styles.bookGridItem}
                      data-library-book-open="true"
                      onClick={() => onPressBook(book, originId)}
                      aria-pressed={editing ? isSelected : undefined}
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
                    {editing ? (
                      <span className={styles.selectionBadge} aria-hidden="true">
                        {isSelected && <Checkmark />}
                      </span>
                    ) : (
                      <MoreButton
                        className={styles.bookGridMoreButton}
                        size={18}
                        onClick={() => onOpenBookActions(book)}
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
              {books.map((book) => {
                const isSelected = selectedBookIds.includes(book.id);
                const progress = getBookProgressPercent(progressMap, book.id);
                const presentation = buildLibraryBookPresentation(book, progress);
                const originId = `${originPrefix}-${mode}-${book.id}`;
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
                    className={`${styles.bookItem} ${editing ? styles.bookSelectable : ""} ${isSelected ? styles.bookSelected : ""}`}
                    data-library-book-state={presentation.state}
                  >
                    <button
                      type="button"
                      className={styles.bookItemMain}
                      data-library-book-open="true"
                      aria-pressed={editing ? isSelected : undefined}
                      onClick={() => onPressBook(book, originId)}
                    >
                      {editing && (
                        <span
                          className={styles.selectionBadgeInline}
                          aria-hidden="true"
                        >
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
                                style={{
                                  "--library-progress-scale":
                                    presentation.progressPercent / 100,
                                } as CSSProperties}
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
                              .map(
                                (groupId) =>
                                  groups.find((group) => group.id === groupId)
                                    ?.name
                              )
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                        )}
                      </span>
                    </button>
                    {!editing && (
                      <MoreButton
                        className={styles.bookMoreButton}
                        onClick={() => onOpenBookActions(book)}
                      />
                    )}
                  </m.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </LayoutGroup>
  );
}

function Checkmark() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        d="M3.5 8.3 6.7 11.5 12.8 4.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
      type="button"
      className={className}
      data-library-book-more="true"
      title={UI_TEXT.MORE}
      aria-label={UI_TEXT.MORE_OPTIONS}
      onClick={onClick}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <circle cx="10" cy="4" r="1.5" />
        <circle cx="10" cy="10" r="1.5" />
        <circle cx="10" cy="16" r="1.5" />
      </svg>
    </button>
  );
}
