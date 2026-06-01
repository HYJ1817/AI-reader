"use client";

import { normalizeProgressPercent } from "@/lib/readerProgress";
import styles from "./page.module.css";
import { UI_TEXT } from "@/lib/uiText";

type Props = {
  onBack: () => void;
  onContents: () => void;
  hasToc: boolean;
  onPrev: () => void;
  onNext: () => void;
  progressPercent: number;
  onOpenSettings: () => void;
  onAsk: () => void;
  onOpenGoal: () => void;
  bookTitle?: string;
  visible?: boolean;
  todayMinutes: number;
  targetMinutes: number;
};

export default function ReaderControls({
  onBack,
  onContents,
  hasToc,
  onPrev,
  onNext,
  progressPercent,
  onOpenSettings,
  onAsk,
  onOpenGoal,
  bookTitle,
  visible = true,
  todayMinutes,
  targetMinutes,
}: Props) {
  const progress = targetMinutes > 0 ? Math.min(todayMinutes / targetMinutes, 1) : 0;
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  return (
    <div className={`${styles.readerChrome} ${visible ? "" : styles.readerChromeControlsHidden}`}>
      <div className={styles.readerTopBar}>
        <button className={styles.chromeButton} onClick={onBack} title={UI_TEXT.LIBRARY} aria-label={UI_TEXT.LIBRARY}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M11 4L6 9l5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {bookTitle && (
          <span className={styles.readerTopTitle} title={bookTitle}>{bookTitle}</span>
        )}
        <div className={styles.readerTopSpacer} />
        <button
          className={styles.goalRingButton}
          onClick={onOpenGoal}
          title={UI_TEXT.READING_GOAL}
          aria-label={UI_TEXT.READING_GOAL}
        >
          <svg width="44" height="44" viewBox="0 0 48 48" aria-hidden="true">
            <circle
              cx="24"
              cy="24"
              r={radius}
              fill="none"
              stroke="var(--ios-separator)"
              strokeWidth="4"
            />
            <circle
              cx="24"
              cy="24"
              r={radius}
              fill="none"
              stroke="var(--ios-tint)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 24 24)"
            />
          </svg>
          <span className={styles.goalRingStack}>
            <span className={styles.goalRingMinutes}>{todayMinutes}</span>
            <span className={styles.goalRingTarget}>{targetMinutes}</span>
          </span>
        </button>
        <button className={styles.chromeButton} onClick={onContents} disabled={!hasToc} title={UI_TEXT.CONTENTS} aria-label={UI_TEXT.CONTENTS}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 4h12M3 9h8M3 14h10" strokeLinecap="round" />
          </svg>
        </button>
        <button className={styles.chromeButton} onClick={onAsk} title={UI_TEXT.ASK_AI} aria-label={UI_TEXT.ASK_AI}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="9" cy="9" r="7" />
            <path d="M7 7.2c0-1.1.9-2 2-2s2 .9 2 2c0 1-.8 1.8-1.8 2v1.1" strokeLinecap="round" />
            <circle cx="9" cy="13.2" r=".6" fill="currentColor" stroke="none" />
          </svg>
        </button>
        <button className={styles.chromeButton} onClick={onOpenSettings} title={UI_TEXT.READER_APPEARANCE} aria-label={UI_TEXT.READER_APPEARANCE}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="9" cy="9" r="2.5" />
            <path d="M9 1.5v2m0 9v2M1.5 9h2m9 0h2M3.3 3.3l1.3 1.3m8.2 8.2l1.3 1.3M3.3 14.7l1.3-1.3m8.2-8.2l1.3-1.3" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className={styles.readerBottomPill}>
        <button className={styles.pillButton} onClick={onPrev} title={UI_TEXT.PREV_PAGE} aria-label={UI_TEXT.PREV_PAGE}>
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M11 4L6 9l5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className={styles.pillProgress}>{normalizeProgressPercent(progressPercent)}%</span>
        <button className={styles.pillButton} onClick={onNext} title={UI_TEXT.NEXT_PAGE} aria-label={UI_TEXT.NEXT_PAGE}>
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M7 4l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
