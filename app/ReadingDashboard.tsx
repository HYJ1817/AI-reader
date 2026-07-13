"use client";

import type { CSSProperties } from "react";
import { AnimatePresence, m } from "motion/react";
import AnimatedNumber from "@/app/AnimatedNumber";
import { useAppReducedMotion } from "@/app/AppMotionRoot";
import MotionBookCover from "@/app/MotionBookCover";
import type { BookRecord } from "@/lib/db";
import { formatLibraryProgressLabel } from "@/lib/libraryProgress";
import { MOTION_DURATION } from "@/lib/motionSystem";
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
  onOpenBook: (book: BookRecord, originId: string) => void;
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
  const reduceMotion = useAppReducedMotion();
  const latestBookOriginId = latestBook
    ? `reading-dashboard-${latestBook.id}`
    : null;

  return (
    <div className={className} aria-hidden={ariaHidden}>
      <div className={styles.pageHeader}>
        <h1 className={styles.libraryTitle}>{UI_TEXT.READING}</h1>
      </div>

      <section className={styles.readingDashboardSection}>
        <button className={styles.readingGoalCard} onClick={onOpenGoal}>
          <span
            className={styles.dashboardGoalRing}
            style={{ background: goalRingBackground }}
          >
            <span><AnimatedNumber value={todayMinutes} /></span>
            <small><AnimatedNumber value={targetMinutes} /></small>
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
      </section>

      <section className={styles.readingDashboardSection}>
        <div className={styles.sectionHeader}>
          <h2>{UI_TEXT.CONTINUE_READING}</h2>
        </div>
        {latestBook ? (
          <button
            className={styles.featureBookCard}
            onClick={() =>
              onOpenBook(latestBook, latestBookOriginId ?? latestBook.id)
            }
          >
            <MotionBookCover
              book={latestBook}
              originId={latestBookOriginId ?? latestBook.id}
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

      <section
        className={`${styles.readingDashboardSection} ${styles.readingWeekCard}`}
      >
        <div className={styles.sectionHeader}>
          <h2>{UI_TEXT.LAST_SEVEN_DAYS}</h2>
          <span>
            {UI_TEXT.TOTAL_READING}: <AnimatedNumber value={totalMinutes} /> {UI_TEXT.MINUTES}
          </span>
        </div>
        <div className={styles.weekBars}>
          {insights.map((day) => (
            <div
              key={day.date}
              className={day.isToday ? styles.weekBarToday : ""}
            >
              <span className={styles.weekBarTrack}>
                <AnimatePresence initial={false} mode="popLayout">
                  <m.span
                    key={`${day.date}:${day.minutes}`}
                    initial={{
                      opacity: 0,
                      scaleY: reduceMotion ? 1 : 0.7,
                    }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    exit={{
                      opacity: 0,
                      scaleY: reduceMotion ? 1 : 0.9,
                    }}
                    transition={{
                      duration: reduceMotion
                        ? MOTION_DURATION.reduced
                        : MOTION_DURATION.state,
                    }}
                    style={{
                      height: `${Math.max(
                        day.progress * 100,
                        day.minutes > 0 ? 10 : 0
                      )}%`,
                    }}
                  />
                </AnimatePresence>
              </span>
              <small>{day.label}</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
