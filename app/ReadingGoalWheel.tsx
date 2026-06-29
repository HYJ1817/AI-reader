"use client";

import {
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";
import {
  clampReadingGoalMinutes,
  getReadingGoalWheelDragState,
  getReadingGoalWheelValues,
  getReadingGoalWheelValueForKey,
  READING_GOAL_MAX_MINUTES,
  READING_GOAL_MIN_MINUTES,
} from "@/lib/readingGoalWheel";
import styles from "./page.module.css";

type ReadingGoalWheelProps = {
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
};

type PointerDrag = {
  pointerId: number;
  startY: number;
  startValue: number;
  lastValue: number;
};

const ROW_HEIGHT = 34;

export default function ReadingGoalWheel({
  value,
  onChange,
  ariaLabel,
}: ReadingGoalWheelProps) {
  const dragRef = useRef<PointerDrag | null>(null);
  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const visibleValues = getReadingGoalWheelValues(value);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const nextValue = getReadingGoalWheelValueForKey(value, event.key);
    if (nextValue === null) return;
    event.preventDefault();
    setDragOffsetPx(0);
    setIsDragging(false);
    onChange(nextValue);
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (event.deltaY === 0) return;
    event.preventDefault();
    setDragOffsetPx(0);
    setIsDragging(false);
    onChange(clampReadingGoalMinutes(value + (event.deltaY > 0 ? 1 : -1)));
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startValue: value,
      lastValue: value,
    };
    setDragOffsetPx(0);
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dragState = getReadingGoalWheelDragState(
      drag.startValue,
      drag.startY - event.clientY,
      ROW_HEIGHT
    );
    setDragOffsetPx(dragState.offsetPx);
    if (dragState.value === drag.lastValue) return;
    drag.lastValue = dragState.value;
    onChange(dragState.value);
  };

  const finishPointerDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setIsDragging(false);
    setDragOffsetPx(0);
  };

  return (
    <div
      className={[styles.goalWheel, isDragging ? styles.goalWheelDragging : ""]
        .filter(Boolean)
        .join(" ")}
      role="spinbutton"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={READING_GOAL_MIN_MINUTES}
      aria-valuemax={READING_GOAL_MAX_MINUTES}
      aria-valuenow={value}
      aria-valuetext={`${value} 分钟`}
      onKeyDown={handleKeyDown}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointerDrag}
      onPointerCancel={finishPointerDrag}
    >
      <div className={styles.goalWheelBand} aria-hidden="true" />
      <div className={styles.goalWheelRows} aria-hidden="true">
        {visibleValues.map((visibleValue) => {
          const offset = visibleValue - value;
          const distance = Math.abs(offset);
          const rowStyle = {
            "--goal-wheel-offset": `${offset * ROW_HEIGHT}px`,
            "--goal-wheel-drag-offset": `${dragOffsetPx}px`,
          } as CSSProperties;

          return (
            <div
              className={[
                styles.goalWheelRow,
                distance === 0 ? styles.goalWheelRowSelected : "",
                distance === 1 ? styles.goalWheelRowNeighbor : "",
                distance >= 2 ? styles.goalWheelRowEdge : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={rowStyle}
              key={visibleValue}
            >
              {visibleValue}
            </div>
          );
        })}
      </div>
    </div>
  );
}
