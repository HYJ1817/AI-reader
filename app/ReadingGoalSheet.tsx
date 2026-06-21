"use client";

import { useMemo, useState } from "react";
import { UI_TEXT } from "@/lib/uiText";
import {
  getReadingGoalArcPercent,
  getReadingGoalContinueSubtitle,
} from "@/lib/readingGoalDisplay";
import BottomSheet from "./BottomSheet";
import styles from "./page.module.css";

type Props = {
  todayMinutes: number;
  targetMinutes: number;
  goalInputValue: number;
  bookTitle?: string | null;
  onGoalInputChange: (value: number) => void;
  onSaveGoal: () => void;
  onClose: () => void;
  onContinue: () => void;
};

export default function ReadingGoalSheet({
  todayMinutes,
  targetMinutes,
  goalInputValue,
  bookTitle,
  onGoalInputChange,
  onSaveGoal,
  onClose,
  onContinue,
}: Props) {
  const [editingTarget, setEditingTarget] = useState(false);
  const progressPercent = useMemo(
    () => getReadingGoalArcPercent(todayMinutes, targetMinutes),
    [targetMinutes, todayMinutes]
  );
  const continueSubtitle = useMemo(
    () => getReadingGoalContinueSubtitle(bookTitle),
    [bookTitle]
  );

  function openTargetEditor() {
    onGoalInputChange(targetMinutes);
    setEditingTarget(true);
  }

  function saveTarget() {
    onSaveGoal();
    setEditingTarget(false);
  }

  return (
    <BottomSheet onClose={onClose} className={styles.goalSheet} ariaLabel={UI_TEXT.READING_GOAL}>
      {(close) => (
        <>
        <button
          className={styles.goalCloseButton}
          onClick={() => close()}
          title={UI_TEXT.CLOSE}
          aria-label={UI_TEXT.CLOSE}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
          </svg>
        </button>

        <div className={styles.goalHero}>
          <h2 className={styles.goalHeroTitle}>{UI_TEXT.READING_GOAL}</h2>
          <p className={styles.goalHeroSubtitle}>{UI_TEXT.READING_GOAL_SUBTITLE}</p>

          <div className={styles.goalArcWrap} aria-label={UI_TEXT.TODAY_READING_PROGRESS}>
            <svg className={styles.goalArc} viewBox="0 0 320 220" aria-hidden="true">
              <path
                className={styles.goalArcTrack}
                d="M38 170 A122 122 0 1 1 282 170"
                pathLength={100}
              />
              <path
                className={styles.goalArcProgress}
                d="M38 170 A122 122 0 1 1 282 170"
                pathLength={100}
                style={{ strokeDasharray: `${progressPercent} 100` }}
              />
            </svg>

            <div className={styles.goalArcCenter}>
              <span className={styles.goalArcLabel}>{UI_TEXT.TODAY_READING_PROGRESS}</span>
              <span className={styles.goalArcNumber}>{todayMinutes}</span>
              <button className={styles.goalTargetButton} onClick={openTargetEditor}>
                <span>
                  {`(${UI_TEXT.TARGET} ${targetMinutes} ${UI_TEXT.MINUTES})`}
                </span>
                <span className={styles.goalChevron}>›</span>
              </button>
            </div>
          </div>

          {editingTarget && (
            <div className={styles.goalTargetEditor}>
              <label className={styles.goalRangeLabel}>
                <span>{UI_TEXT.TARGET} ({UI_TEXT.MINUTES})</span>
                <span className={styles.goalRangeValue}>{goalInputValue}</span>
              </label>
              <input
                type="range"
                className={styles.goalRangeInput}
                min={1}
                max={1440}
                step={1}
                value={goalInputValue}
                onChange={(e) => onGoalInputChange(Number(e.target.value))}
              />
              <div className={styles.goalTargetActions}>
                <button className={styles.secondaryButton} onClick={() => setEditingTarget(false)}>
                  {UI_TEXT.CANCEL}
                </button>
                <button className={styles.primaryButton} onClick={saveTarget}>
                  {UI_TEXT.SAVE_GOAL}
                </button>
              </div>
            </div>
          )}

          <button className={styles.goalContinueButton} onClick={() => close(onContinue)}>
            <span>{UI_TEXT.CONTINUE_READING}</span>
            <small>{continueSubtitle}</small>
          </button>
        </div>
        </>
      )}
    </BottomSheet>
  );
}
