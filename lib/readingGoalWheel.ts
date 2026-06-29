export const READING_GOAL_MIN_MINUTES = 1;
export const READING_GOAL_MAX_MINUTES = 1440;

export function clampReadingGoalMinutes(value: number): number {
  const rounded = Number.isFinite(value)
    ? Math.round(value)
    : READING_GOAL_MIN_MINUTES;
  return Math.min(
    READING_GOAL_MAX_MINUTES,
    Math.max(READING_GOAL_MIN_MINUTES, rounded)
  );
}

export function getReadingGoalWheelValues(value: number): number[] {
  const selected = clampReadingGoalMinutes(value);
  const maxStart = READING_GOAL_MAX_MINUTES - 4;
  const start = Math.min(
    maxStart,
    Math.max(READING_GOAL_MIN_MINUTES, selected - 2)
  );
  return Array.from({ length: 5 }, (_, index) => start + index);
}

export type ReadingGoalWheelDragState = {
  value: number;
  offsetPx: number;
};

export function getReadingGoalWheelDragState(
  startValue: number,
  dragDeltaPx: number,
  rowHeightPx: number
): ReadingGoalWheelDragState {
  const selectedStart = clampReadingGoalMinutes(startValue);
  if (
    !Number.isFinite(dragDeltaPx) ||
    !Number.isFinite(rowHeightPx) ||
    rowHeightPx <= 0
  ) {
    return { value: selectedStart, offsetPx: 0 };
  }

  const rawValue = selectedStart + dragDeltaPx / rowHeightPx;
  const value = clampReadingGoalMinutes(rawValue);
  if (
    (value === READING_GOAL_MIN_MINUTES &&
      rawValue < READING_GOAL_MIN_MINUTES) ||
    (value === READING_GOAL_MAX_MINUTES &&
      rawValue > READING_GOAL_MAX_MINUTES)
  ) {
    return { value, offsetPx: 0 };
  }

  return {
    value,
    offsetPx: (value - selectedStart) * rowHeightPx - dragDeltaPx,
  };
}

export function getReadingGoalWheelValueForKey(
  value: number,
  key: string
): number | null {
  const changes: Record<string, number> = {
    ArrowUp: -1,
    ArrowDown: 1,
    PageUp: -10,
    PageDown: 10,
  };

  if (key === "Home") return READING_GOAL_MIN_MINUTES;
  if (key === "End") return READING_GOAL_MAX_MINUTES;
  if (!(key in changes)) return null;
  return clampReadingGoalMinutes(value + changes[key]);
}
