"use client";

import {
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";
import {
  clampReadingGoalMinutes,
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
};

const ROW_HEIGHT = 34;

export default function ReadingGoalWheel({
  value,
  onChange,
  ariaLabel,
}: ReadingGoalWheelProps) {
  const dragRef = useRef<PointerDrag | null>(null);
  const visibleValues = getReadingGoalWheelValues(value);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const nextValue = getReadingGoalWheelValueForKey(value, event.key);
    if (nextValue === null) return;
    event.preventDefault();
    onChange(nextValue);
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (event.deltaY === 0) return;
    event.preventDefault();
    onChange(clampReadingGoalMinutes(value + (event.deltaY > 0 ? 1 : -1)));
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startValue: value,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const steps = Math.round((drag.startY - event.clientY) / ROW_HEIGHT);
    onChange(clampReadingGoalMinutes(drag.startValue + steps));
  };

  const finishPointerDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  return (
    <div
      className={styles.goalWheel}
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
