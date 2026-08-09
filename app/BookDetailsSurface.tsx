"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { AnimatePresence, m } from "motion/react";
import type { BookMetadata } from "@/lib/db";
import { buildBookDetailsPresentation } from "@/lib/bookDetailsPresentation";
import { bookCoverLayoutId } from "@/lib/sharedBookTransition";
import { UI_TEXT } from "@/lib/uiText";
import MotionBookCover from "./MotionBookCover";
import { MoreHorizontalIcon } from "./UiGlyphs";
import { useAppReducedMotion } from "./AppMotionRoot";
import styles from "./page.module.css";

export type BookDetailsSurfaceProps = {
  book: BookMetadata;
  progressPercent: number;
  lastReadAt?: string;
  originId?: string;
  metadataRunning: boolean;
  onBack: () => void;
  onRead: (originId: string) => void;
  onOpenContents: (originId: string) => void;
  onEnrich: (mode: "automatic" | "manual") => void;
};

export default function BookDetailsSurface({
  book,
  progressPercent,
  originId,
  metadataRunning,
  onBack,
  onRead,
  onOpenContents,
  onEnrich,
}: BookDetailsSurfaceProps) {
  const presentation = buildBookDetailsPresentation(book, progressPercent);
  const reduceMotion = useAppReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const detailOriginId = `book-details-${book.id}`;

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        !menuRef.current?.contains(target) &&
        !menuButtonRef.current?.contains(target)
      ) setMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const metadataStatus = metadataRunning
    ? UI_TEXT.METADATA_PENDING
    : book.enrichment?.status === "failed"
      ? UI_TEXT.METADATA_FAILED
      : presentation.sourceSummary
        ? `已补全 · ${presentation.sourceSummary}`
        : "图书与进度仅保存在本机";

  return (
    <section
      className={styles.bookDetailsSurface}
      data-book-details="true"
      data-push-route="book-details"
    >
      <header className={styles.bookDetailsNavigation}>
        <button
          type="button"
          className={styles.bookDetailsCircleButton}
          onClick={onBack}
          aria-label={UI_TEXT.BACK}
        >
          <BackIcon />
        </button>
        <div className={styles.bookDetailsMenuAnchor}>
          <button
            ref={menuButtonRef}
            type="button"
            className={styles.bookDetailsCircleButton}
            aria-label={UI_TEXT.MORE_OPTIONS}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? menuId : undefined}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MoreHorizontalIcon />
          </button>
          <AnimatePresence initial={false}>
            {menuOpen && (
              <m.div
                ref={menuRef}
                id={menuId}
                role="menu"
                className={styles.bookDetailsMenu}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: reduceMotion ? 0.1 : 0.18 }}
              >
                <button
                  type="button"
                  role="menuitem"
                  disabled={metadataRunning}
                  onClick={() => {
                    onEnrich("manual");
                    setMenuOpen(false);
                  }}
                >
                  <RefreshIcon />
                  <span>
                    {metadataRunning
                      ? UI_TEXT.RESCRAPING_METADATA
                      : presentation.metadataActionLabel}
                  </span>
                </button>
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <div className={styles.bookDetailsHero}>
        <m.div
          className={styles.bookDetailsHeroCover}
          layoutId={
            !reduceMotion && originId ? bookCoverLayoutId(originId) : undefined
          }
          transition={{ type: "spring", stiffness: 430, damping: 42, mass: 0.8 }}
        >
          <MotionBookCover book={book} originId={detailOriginId} />
        </m.div>
        <div className={styles.bookDetailsHeroCopy}>
          <p className={styles.bookDetailsFormat}>{book.format.toUpperCase()}</p>
          <h1>{presentation.title}</h1>
          {presentation.authors.length > 0 && (
            <p className={styles.bookDetailsAuthors}>
              {presentation.authors.join("、")}
            </p>
          )}
          {presentation.subjects.length > 0 && (
            <div className={styles.bookDetailsHeroTags} aria-label={UI_TEXT.TAGS}>
              {presentation.subjects.slice(0, 3).map((subject) => (
                <span key={subject}>{subject}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.bookDetailsActions}>
        <button
          type="button"
          className={styles.bookDetailsPrimaryAction}
          onClick={() => onRead(detailOriginId)}
        >
          <BookOpenIcon />
          <span>{presentation.primaryActionLabel}</span>
        </button>
        {presentation.showContentsAction && (
          <button
            type="button"
            className={styles.bookDetailsSecondaryAction}
            onClick={() => onOpenContents(detailOriginId)}
          >
            <ContentsIcon />
            <span>{UI_TEXT.CONTENTS}</span>
          </button>
        )}
      </div>

      <p className={styles.bookDetailsMetadataStatus} aria-live="polite">
        {metadataStatus}
      </p>

      <section className={styles.bookDetailsProgressCard} aria-label={UI_TEXT.READING_PROGRESS}>
        <div>
          <span>阅读状态</span>
          <strong>{presentation.readingStatusLabel}</strong>
        </div>
        <div>
          <span>{UI_TEXT.READING_PROGRESS}</span>
          <strong>{presentation.progressPercent}%</strong>
        </div>
        <div>
          <span>{UI_TEXT.LAST_OPENED_AT}</span>
          <strong>{presentation.lastReadLabel}</strong>
        </div>
        <span className={styles.bookDetailsProgressTrack} aria-hidden="true">
          <span style={{ width: `${presentation.progressPercent}%` }} />
        </span>
      </section>

      {(presentation.description || presentation.subjects.length > 0) && (
        <section className={styles.bookDetailsCard}>
          {presentation.subjects.length > 0 && (
            <div className={styles.bookDetailsSection}>
              <h2>{UI_TEXT.TAGS}</h2>
              <div className={styles.bookDetailsTags}>
                {presentation.subjects.map((subject) => (
                  <span key={subject}>{subject}</span>
                ))}
              </div>
            </div>
          )}
          {presentation.description && (
            <div className={styles.bookDetailsSection}>
              <h2>{UI_TEXT.DESCRIPTION}</h2>
              <p>{presentation.description}</p>
            </div>
          )}
        </section>
      )}

      <section className={styles.bookDetailsCard}>
        <div className={styles.bookDetailsSection}>
          <h2>图书信息</h2>
          <dl className={styles.bookDetailsMetadataList}>
            {presentation.metadataRows.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </section>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m15 5-7 7 7 7" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
    </svg>
  );
}

function BookOpenIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 5.5A4.5 4.5 0 0 1 7.5 4H11v16H7.5A4.5 4.5 0 0 0 3 21.5zM21 5.5A4.5 4.5 0 0 0 16.5 4H13v16h3.5a4.5 4.5 0 0 1 4.5 1.5z" />
    </svg>
  );
}

function ContentsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  );
}
