"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  formatReadingGoalDuration,
  getReadingGoalArcPercent,
  getReadingGoalDisplay,
} from "@/lib/readingGoalDisplay";
import { UI_TEXT } from "@/lib/uiText";
import BottomSheet, { type CloseSheet } from "./BottomSheet";
import ReadingGoalWheel from "./ReadingGoalWheel";
import styles from "./page.module.css";

type Props = {
  todayMinutes: number;
  targetMinutes: number;
  goalInputValue: number;
  onGoalInputChange: (value: number) => void;
  onSaveGoal: () => void;
  onClose: () => void;
};

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export default function ReadingGoalSheet(props: Props) {
  return (
    <BottomSheet
      onClose={props.onClose}
      className={styles.goalMotionSheet}
      ariaLabel={UI_TEXT.READING_GOAL}
      showGrabber={false}
    >
      {(closeSheet) => (
        <ReadingGoalContent
          todayMinutes={props.todayMinutes}
          targetMinutes={props.targetMinutes}
          goalInputValue={props.goalInputValue}
          onGoalInputChange={props.onGoalInputChange}
          onSaveGoal={props.onSaveGoal}
          closeSheet={closeSheet}
        />
      )}
    </BottomSheet>
  );
}

function ReadingGoalContent({
  todayMinutes,
  targetMinutes,
  goalInputValue,
  onGoalInputChange,
  onSaveGoal,
  closeSheet,
}: Omit<Props, "onClose"> & { closeSheet: CloseSheet }) {
  const [editingTarget, setEditingTarget] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const progressPercent = useMemo(
    () => getReadingGoalArcPercent(todayMinutes, targetMinutes),
    [targetMinutes, todayMinutes]
  );
  const duration = useMemo(
    () => formatReadingGoalDuration(todayMinutes),
    [todayMinutes]
  );
  const display = useMemo(
    () => getReadingGoalDisplay(todayMinutes, targetMinutes),
    [targetMinutes, todayMinutes]
  );

  const closeGoal = useCallback(() => {
    onGoalInputChange(targetMinutes);
    closeSheet();
  }, [closeSheet, onGoalInputChange, targetMinutes]);

  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeButtonRef.current?.focus();

    function handleDialogKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeGoal();
        return;
      }

      if (event.key !== "Tab") return;
      const focusableElements =
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (!focusableElements?.length) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleDialogKeyDown);
    return () => {
      document.removeEventListener("keydown", handleDialogKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [closeGoal]);

  function openTargetEditor() {
    onGoalInputChange(targetMinutes);
    setEditingTarget(true);
  }

  function saveTarget() {
    onSaveGoal();
    setEditingTarget(false);
  }

  return (
    <div className={styles.goalOverlay}>
      <div
        ref={dialogRef}
        className={styles.goalScreen}
      >
        <button
          ref={closeButtonRef}
          className={styles.goalCloseButton}
          onClick={closeGoal}
          title={UI_TEXT.CLOSE}
          aria-label={UI_TEXT.CLOSE}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 22 22"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="M5 5l12 12M17 5L5 17" strokeLinecap="round" />
          </svg>
        </button>

        <div className={styles.goalProgressRegion}>
          <div
            className={styles.goalArcWrap}
            role="progressbar"
            aria-label={UI_TEXT.TODAY_READING_PROGRESS}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
          >
            <svg
              className={styles.goalArc}
              viewBox="0 0 320 205"
              aria-hidden="true"
            >
              <path
                className={styles.goalArcTrack}
                d="M22 180 A138 138 0 0 1 298 180"
                pathLength="100"
              />
              {progressPercent > 0 && (
                <path
                  className={styles.goalArcProgress}
                  d="M22 180 A138 138 0 0 1 298 180"
                  pathLength="100"
                  style={{ strokeDasharray: `${progressPercent} 100` }}
                />
              )}
            </svg>

            <div className={styles.goalArcCenter}>
              <strong className={styles.goalDuration}>{duration}</strong>
              <span className={styles.goalTargetText}>
                （目标 {targetMinutes} 分钟）
              </span>
            </div>
          </div>

          <div className={styles.goalDivider} />

          <div className={styles.goalProgressCopy} aria-live="polite">
            <h2 className={styles.goalProgressHeading}>今日阅读进度</h2>
            <p
              className={[
                styles.goalRemaining,
                display.completed ? styles.goalRemainingComplete : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {display.completed
                ? "今日目标已完成"
                : `还需 ${display.remainingMinutes} 分钟`}
            </p>
            <p className={styles.goalStatus}>
              {display.completed
                ? "继续保持阅读节奏"
                : "你正朝着每日目标奋进"}
            </p>
          </div>
        </div>

        {editingTarget ? (
          <div className={styles.goalEditor}>
            <h3 className={styles.goalEditorHeading}>每日阅读目标</h3>
            <span className={styles.goalEditorUnit}>分钟/天</span>
            <ReadingGoalWheel
              value={goalInputValue}
              onChange={onGoalInputChange}
              ariaLabel="每日阅读目标分钟数"
            />
            <button className={styles.goalBottomAction} onClick={saveTarget}>
              {UI_TEXT.DONE}
            </button>
          </div>
        ) : (
          <div className={styles.goalActionArea}>
            <button
              className={styles.goalBottomAction}
              onClick={openTargetEditor}
            >
              调整目标
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
