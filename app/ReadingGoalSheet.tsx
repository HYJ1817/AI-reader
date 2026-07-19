"use client";

import { useMemo, useRef, useState, type RefObject } from "react";
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

export default function ReadingGoalSheet(props: Props) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <BottomSheet
      onClose={props.onClose}
      onBeforeClose={() =>
        props.onGoalInputChange(props.targetMinutes)
      }
      className={styles.goalMotionSheet}
      ariaLabel={UI_TEXT.READING_GOAL}
      showGrabber={false}
      initialFocusRef={closeButtonRef}
    >
      {(closeSheet) => (
        <ReadingGoalContent
          todayMinutes={props.todayMinutes}
          targetMinutes={props.targetMinutes}
          goalInputValue={props.goalInputValue}
          onGoalInputChange={props.onGoalInputChange}
          onSaveGoal={props.onSaveGoal}
          closeSheet={closeSheet}
          closeButtonRef={closeButtonRef}
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
  closeButtonRef,
}: Omit<Props, "onClose"> & {
  closeSheet: CloseSheet;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
}) {
  const [editingTarget, setEditingTarget] = useState(false);
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
      <div className={styles.goalScreen}>
        <button
          ref={closeButtonRef}
          className={styles.goalCloseButton}
          onClick={() => closeSheet()}
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
