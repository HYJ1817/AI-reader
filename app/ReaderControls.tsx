"use client";

import { useEffect, useState } from "react";
import { normalizeProgressPercent } from "@/lib/readerProgress";
import styles from "./page.module.css";
import { UI_TEXT } from "@/lib/uiText";

type Props = {
  onBack: () => void;
  onContents: () => void;
  hasToc: boolean;
  progressPercent: number;
  currentPage: number;
  totalPages: number;
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
  progressPercent,
  currentPage,
  totalPages,
  onOpenSettings,
  onAsk,
  onOpenGoal,
  visible = true,
  todayMinutes,
  targetMinutes,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const progress = targetMinutes > 0 ? Math.min(todayMinutes / targetMinutes, 1) : 0;
  const readingProgress = normalizeProgressPercent(progressPercent);
  const safeTotalPages = Math.max(1, totalPages);
  const safeCurrentPage = Math.min(safeTotalPages, Math.max(1, currentPage));
  const remainingPages = Math.max(0, safeTotalPages - safeCurrentPage);
  const topHint = `\u672c\u7ae0\u8fd8\u5269 ${remainingPages} \u9875`;
  const pageLabel = `${safeCurrentPage}/${safeTotalPages}\u9875`;
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);
  const actionPanelOpen = visible && menuOpen;

  useEffect(() => {
    if (visible) return;
    const frame = window.requestAnimationFrame(() => setMenuOpen(false));
    return () => window.cancelAnimationFrame(frame);
  }, [visible]);

  const closeMenu = () => setMenuOpen(false);

  const handleContents = () => {
    if (!hasToc) return;
    closeMenu();
    onContents();
  };

  const handleSettings = () => {
    closeMenu();
    onOpenSettings();
  };

  const handleAsk = () => {
    closeMenu();
    onAsk();
  };

  const handleGoal = () => {
    closeMenu();
    onOpenGoal();
  };

  return (
    <div className={`${styles.readerChrome} ${visible ? "" : styles.readerChromeControlsHidden}`}>
      <button className={styles.readerOverlayClose} onClick={onBack} title={UI_TEXT.LIBRARY} aria-label={UI_TEXT.LIBRARY}>
        <svg width="34" height="34" viewBox="0 0 34 34" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M9 9l16 16M25 9L9 25" strokeLinecap="round" />
        </svg>
      </button>

      <div className={styles.readerTopHint}>
        <span>{topHint}</span>
      </div>

      <div className={`${styles.readerActionPanel} ${actionPanelOpen ? styles.readerActionPanelOpen : ""}`}>
        <div className={styles.readerActionPanelHeader}>
          <button onClick={handleContents} disabled={!hasToc}>
            <span>{UI_TEXT.CONTENTS} · {readingProgress}%</span>
          </button>
          <button onClick={closeMenu} aria-label={UI_TEXT.CLOSE}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M6 9h16M6 14h16M6 19h16" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <button className={styles.readerActionPanelSearch} onClick={handleAsk}>
          <span>{"\u5728\u56fe\u4e66\u4e2d\u641c\u7d22"}</span>
          <svg width="29" height="29" viewBox="0 0 29 29" fill="none" stroke="currentColor" strokeWidth="2.4">
            <circle cx="12.5" cy="12.5" r="7.5" />
            <path d="M18 18l5 5" strokeLinecap="round" />
          </svg>
        </button>

        <button className={styles.readerActionPanelSetting} onClick={handleSettings}>
          <span>{"\u4e3b\u9898\u4e0e\u8bbe\u7f6e"}</span>
          <strong>{"\u5927\u5c0f"}</strong>
        </button>

        <div className={styles.readerActionPanelDock}>
          <button onClick={handleAsk} aria-label={UI_TEXT.ASK_AI}>
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 20c5-9 9-9 14-10" strokeLinecap="round" />
              <path d="M7 11c4 0 8 3 10 8" strokeLinecap="round" />
              <path d="M7 20h16" strokeLinecap="round" />
            </svg>
          </button>
          <button onClick={handleGoal} aria-label={UI_TEXT.READING_GOAL}>
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 9.5A8 8 0 1 0 23 15" strokeLinecap="round" />
              <path d="M21 5v4.5h4.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M15 10v5l3.5 2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button onClick={handleContents} disabled={!hasToc} aria-label={UI_TEXT.CONTENTS}>
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 9h14M8 15h14M8 21h14" strokeLinecap="round" />
            </svg>
          </button>
          <button onClick={handleSettings} aria-label={UI_TEXT.READER_APPEARANCE}>
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 6h10a2 2 0 0 1 2 2v16l-7-4-7 4V8a2 2 0 0 1 2-2z" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <button
        className={`${styles.readerCornerMenuButton} ${actionPanelOpen ? styles.readerCornerMenuButtonOpen : ""}`}
        onClick={() => setMenuOpen((open) => !open)}
        title={UI_TEXT.CONTENTS}
        aria-label={UI_TEXT.CONTENTS}
      >
        <svg width="34" height="34" viewBox="0 0 34 34" fill="none" stroke="currentColor" strokeWidth="2.8">
          <path d="M9 11h16M9 17h16M9 23h16" strokeLinecap="round" />
          <circle cx="9" cy="28" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="17" cy="28" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="25" cy="28" r="1.3" fill="currentColor" stroke="none" />
        </svg>
      </button>

      <div className={`${styles.readerPageBadge} ${actionPanelOpen ? styles.readerPageBadgeMenuOpen : ""}`}>
        <span>{pageLabel}</span>
      </div>

      <button
        className={styles.readerGoalMini}
        onClick={handleGoal}
        title={UI_TEXT.READING_GOAL}
        aria-label={UI_TEXT.READING_GOAL}
      >
        <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
          <circle
            cx="15"
            cy="15"
            r={radius}
            fill="none"
            stroke="var(--ios-separator)"
            strokeWidth="2.5"
          />
          <circle
            cx="15"
            cy="15"
            r={radius}
            fill="none"
            stroke="var(--ios-tint)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 15 15)"
          />
        </svg>
        <span className={styles.goalRingStack}>
          <span className={styles.goalRingMinutes}>{todayMinutes}</span>
        </span>
      </button>
    </div>
  );
}
