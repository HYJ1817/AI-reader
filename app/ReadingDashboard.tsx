"use client";

import type { CSSProperties } from "react";
import BookCover from "@/app/BookCover";
import type { BookRecord } from "@/lib/db";
import { formatLibraryProgressLabel } from "@/lib/libraryProgress";
import type { ReadingDayInsight } from "@/lib/readingInsights";
import { UI_TEXT } from "@/lib/uiText";
import styles from "./page.module.css";

export type ReadingDashboardProps = {
  className: string;
  ariaHidden: boolean;
  todayMinutes: number;
  targetMinutes: number;
  goalRingBackground: CSSProperties["background"];
  totalMinutes: number;
  insights: ReadingDayInsight[];
  latestBook: BookRecord | null;
  latestBookProgress: number;
  onOpenGoal: () => void;
  onOpenBook: (book: BookRecord) => void;
  onImport: () => void;
};

function formatBookSize(size: number): string {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

export default function ReadingDashboard({
  className,
  ariaHidden,
  todayMinutes,
  targetMinutes,
  goalRingBackground,
  totalMinutes,
  insights,
  latestBook,
  latestBookProgress,
  onOpenGoal,
  onOpenBook,
  onImport,
}: ReadingDashboardProps) {
  return (
    <div className={className} aria-hidden={ariaHidden}>
      <div className={styles.pageHeader}>
        <h1 className={styles.libraryTitle}>{UI_TEXT.READING}</h1>
      </div>

      <button className={styles.readingGoalCard} onClick={onOpenGoal}>
        <span
          className={styles.dashboardGoalRing}
          style={{ background: goalRingBackground }}
        >
          <span>{todayMinutes}</span>
          <small>{targetMinutes}</small>
        </span>
        <span className={styles.readingGoalText}>
          <strong>{UI_TEXT.TODAY_READING}</strong>
          <small>
            {UI_TEXT.TODAY_READING_PROGRESS} · {todayMinutes}/{targetMinutes}{" "}
            {UI_TEXT.MINUTES}
          </small>
        </span>
        <span className={styles.continueChevron}>{"\u203a"}</span>
      </button>

      <section className={styles.dashboardSection}>
        <div className={styles.sectionHeader}>
          <h2>{UI_TEXT.CONTINUE_READING}</h2>
        </div>
        {latestBook ? (
          <button
            className={styles.featureBookCard}
            onClick={() => onOpenBook(latestBook)}
          >
            <BookCover
              title={latestBook.title}
              format={latestBook.format}
              coverImageBlob={latestBook.coverImageBlob}
            />
            <span className={styles.featureBookText}>
              <strong>{latestBook.title}</strong>
              <small>
                {latestBook.format.toUpperCase()}
                {" \u00b7 "}
                {formatBookSize(latestBook.size)}
              </small>
              <span className={styles.libraryProgressRow}>
                <span className={styles.libraryProgressTrack} aria-hidden="true">
                  <span style={{ width: `${latestBookProgress}%` }} />
                </span>
                <span>{formatLibraryProgressLabel(latestBookProgress)}</span>
              </span>
            </span>
            <span className={styles.continueChevron}>{"\u203a"}</span>
          </button>
        ) : (
          <button className={styles.featureBookCard} onClick={onImport}>
            <span className={styles.emptyCoverMini}>
              <svg
                width="26"
                height="26"
                viewBox="0 0 26 26"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M5 4h7v18H5V4zm9 0h7v18h-7V4z" />
                <path d="M12 8h2M12 18h2" />
              </svg>
            </span>
            <span className={styles.featureBookText}>
              <strong>{UI_TEXT.NO_BOOK_OPEN}</strong>
              <small>{UI_TEXT.SELECT_BOOK_HINT}</small>
            </span>
            <span className={styles.continueChevron}>{"\u203a"}</span>
          </button>
        )}
      </section>

      <section className={styles.readingWeekCard}>
        <div className={styles.sectionHeader}>
          <h2>{UI_TEXT.LAST_SEVEN_DAYS}</h2>
          <span>
            {UI_TEXT.TOTAL_READING}: {totalMinutes} {UI_TEXT.MINUTES}
          </span>
        </div>
        <div className={styles.weekBars}>
          {insights.map((day) => (
            <div
              key={day.date}
              className={day.isToday ? styles.weekBarToday : ""}
            >
              <span className={styles.weekBarTrack}>
                <span
                  style={{
                    height: `${Math.max(
                      day.progress * 100,
                      day.minutes > 0 ? 10 : 0
                    )}%`,
                  }}
                />
              </span>
              <small>{day.label}</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
