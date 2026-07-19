"use client";

import { AnimatePresence, m } from "motion/react";
import AnimatedNumber from "@/app/AnimatedNumber";
import { useAppReducedMotion } from "@/app/AppMotionRoot";
import MotionBookCover from "@/app/MotionBookCover";
import type { BookRecord } from "@/lib/db";
import { formatLibraryProgressLabel } from "@/lib/libraryProgress";
import { MOTION_DURATION } from "@/lib/motionSystem";
import { buildReadingDashboardPresentation } from "@/lib/readingDashboardPresentation";
import type { ReadingDayInsight } from "@/lib/readingInsights";
import { UI_TEXT } from "@/lib/uiText";
import styles from "./page.module.css";

export type ReadingDashboardProps = {
  className: string;
  ariaHidden: boolean;
  todayMinutes: number;
  targetMinutes: number;
  goalPercent: number;
  totalMinutes: number;
  insights: ReadingDayInsight[];
  latestBook: BookRecord | null;
  latestBookProgress: number;
  onOpenGoal: () => void;
  onOpenBook: (book: BookRecord, originId: string) => void;
  onImport: () => void;
};

export default function ReadingDashboard({
  className,
  ariaHidden,
  todayMinutes,
  targetMinutes,
  goalPercent,
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
  const presentation = buildReadingDashboardPresentation({
    hasBook: latestBook !== null,
    progressPercent: latestBookProgress,
    totalMinutes,
  });
  const safeGoalPercent = Math.max(0, Math.min(goalPercent, 100));

  return (
    <div
      className={className}
      aria-hidden={ariaHidden}
      data-reading-dashboard-state={presentation.state}
    >
      <div className={styles.pageHeader}>
        <h1 className={styles.libraryTitle}>{UI_TEXT.READING}</h1>
      </div>

      <section
        className={styles.readingDashboardSection}
        data-reading-primary="true"
      >
        {latestBook ? (
          <>
            <div className={styles.sectionHeader}>
              <h2>{presentation.primaryHeading}</h2>
            </div>
            <button
              className={styles.featureBookCard}
              aria-label={`${presentation.primaryActionLabel}：${latestBook.title}`}
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
                {presentation.showProgress ? (
                  <span className={styles.libraryProgressRow}>
                    <span
                      className={styles.libraryProgressTrack}
                      aria-hidden="true"
                    >
                      <span style={{ width: `${latestBookProgress}%` }} />
                    </span>
                    <span>{formatLibraryProgressLabel(latestBookProgress)}</span>
                  </span>
                ) : (
                  <small>{formatLibraryProgressLabel(latestBookProgress)}</small>
                )}
              </span>
              <span className={styles.continueChevron}>{"\u203a"}</span>
            </button>
          </>
        ) : (
          <div className={styles.readingEmptyState}>
            <span className={styles.emptyCoverMini} aria-hidden="true">
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
            <h2>{UI_TEXT.START_READING}</h2>
            <p>{UI_TEXT.READING_EMPTY_HINT}</p>
            <button className={styles.primaryButton} onClick={onImport}>
              {UI_TEXT.IMPORT_BOOKS}
            </button>
          </div>
        )}
      </section>

      {presentation.showGoal && (
        <section
          className={styles.readingDashboardSection}
          data-reading-goal="true"
        >
          <button
            className={styles.readingGoalCard}
            aria-label={UI_TEXT.READING_GOAL}
            onClick={onOpenGoal}
          >
            <span
              className={styles.dashboardGoalRing}
              data-reading-goal-ring="true"
              data-goal-percent={safeGoalPercent}
            >
              <svg
                className={styles.dashboardGoalRingSvg}
                viewBox="0 0 64 64"
                aria-hidden="true"
              >
                <path
                  className={styles.dashboardGoalArcBase}
                  data-goal-arc="base"
                  d="M 13 44 A 23 23 0 1 1 51 44"
                  pathLength="100"
                />
                <path
                  className={styles.dashboardGoalArcProgress}
                  data-goal-arc="progress"
                  d="M 13 44 A 23 23 0 1 1 51 44"
                  pathLength="100"
                  style={{
                    strokeDasharray: `${safeGoalPercent} 100`,
                    opacity: safeGoalPercent > 0 ? 1 : 0,
                  }}
                />
              </svg>
              <span className={styles.dashboardGoalCurrent}>
                <AnimatedNumber value={todayMinutes} />
              </span>
              <small className={styles.dashboardGoalTarget}>
                <AnimatedNumber value={targetMinutes} />
              </small>
            </span>
            <span className={styles.readingGoalText}>
              <strong>{UI_TEXT.TODAY_READING}</strong>
              <small>{todayMinutes}/{targetMinutes} {UI_TEXT.MINUTES}</small>
            </span>
            <span className={styles.continueChevron}>{"\u203a"}</span>
          </button>
        </section>
      )}

      {presentation.showWeek && (
        <section
          className={`${styles.readingDashboardSection} ${styles.readingWeekCard}`}
          data-reading-week="true"
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
      )}
    </div>
  );
}
