export const READING_GOAL_MIN_MINUTES = 0;
export const READING_GOAL_MAX_MINUTES = 1440;
export const READING_GOAL_WHEEL_VIRTUAL_RADIUS = 7;
export const READING_GOAL_WHEEL_SMOOTHING_MS = 250;
export const READING_GOAL_WHEEL_TICK_INTERVAL_MS = 36;

export function clampReadingGoalWheelPosition(value: number): number {
  if (!Number.isFinite(value)) return READING_GOAL_MIN_MINUTES;
  return Math.min(
    READING_GOAL_MAX_MINUTES,
    Math.max(READING_GOAL_MIN_MINUTES, value)
  );
}

export function clampReadingGoalMinutes(value: number): number {
  return Math.round(clampReadingGoalWheelPosition(value));
}

export function getReadingGoalWheelSelectedValue(position: number): number {
  return clampReadingGoalMinutes(position);
}

export function getReadingGoalWheelDeltaRows(
  deltaY: number,
  deltaMode: number,
  rowHeightPx: number,
  viewportHeightPx: number
): number {
  if (
    !Number.isFinite(deltaY) ||
    !Number.isFinite(deltaMode) ||
    !Number.isFinite(rowHeightPx) ||
    !Number.isFinite(viewportHeightPx) ||
    rowHeightPx <= 0
  ) {
    return 0;
  }

  let deltaRows: number;
  if (deltaMode === 0) {
    deltaRows = deltaY / rowHeightPx;
  } else if (deltaMode === 1) {
    deltaRows = deltaY;
  } else if (deltaMode === 2) {
    const rowsPerPage =
      viewportHeightPx > 0 ? Math.max(1, viewportHeightPx / rowHeightPx) : 1;
    deltaRows = deltaY * rowsPerPage;
  } else {
    return 0;
  }

  return Number.isFinite(deltaRows) ? deltaRows : 0;
}

export function getReadingGoalWheelDragTarget(
  target: number,
  previousY: number,
  nextY: number,
  rowHeightPx: number
): number {
  const safeTarget = clampReadingGoalWheelPosition(target);
  if (
    !Number.isFinite(previousY) ||
    !Number.isFinite(nextY) ||
    !Number.isFinite(rowHeightPx) ||
    rowHeightPx <= 0
  ) {
    return safeTarget;
  }
  return clampReadingGoalWheelPosition(
    safeTarget + (previousY - nextY) / rowHeightPx
  );
}

export function getReadingGoalWheelValues(
  position: number,
  radius = READING_GOAL_WHEEL_VIRTUAL_RADIUS
): number[] {
  const safeRadius = Math.max(
    0,
    Math.floor(Number.isFinite(radius) ? radius : 0)
  );
  const length = Math.min(
    READING_GOAL_MAX_MINUTES - READING_GOAL_MIN_MINUTES + 1,
    safeRadius * 2 + 1
  );
  const center = getReadingGoalWheelSelectedValue(position);
  const maxStart = READING_GOAL_MAX_MINUTES - length + 1;
  const start = Math.min(
    maxStart,
    Math.max(READING_GOAL_MIN_MINUTES, center - safeRadius)
  );
  return Array.from({ length }, (_, index) => start + index);
}

export type ReadingGoalWheelVisualState = {
  offsetSteps: number;
  blurPx: number;
  opacity: number;
  emphasis: number;
};

export function getReadingGoalWheelVisualState(
  itemValue: number,
  position: number
): ReadingGoalWheelVisualState {
  const offsetSteps = itemValue - clampReadingGoalWheelPosition(position);
  const distance = Math.abs(offsetSteps);
  return {
    offsetSteps,
    blurPx: distance * 2,
    opacity: Math.max(0.05, 1 - distance * 0.25),
    emphasis: Math.max(0, 1 - distance),
  };
}

export function getReadingGoalWheelAnimationMix(
  elapsedMs: number,
  smoothingMs = READING_GOAL_WHEEL_SMOOTHING_MS
): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return 1;
  if (!Number.isFinite(smoothingMs) || smoothingMs <= 0) return 1;
  return 1 - Math.exp(-elapsedMs / smoothingMs);
}

export function shouldPlayReadingGoalTick(
  previousValue: number,
  nextValue: number,
  nowMs: number,
  lastTickMs: number
): boolean {
  return (
    previousValue !== nextValue &&
    Number.isFinite(nowMs) &&
    Number.isFinite(lastTickMs) &&
    nowMs - lastTickMs >= READING_GOAL_WHEEL_TICK_INTERVAL_MS
  );
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
  if (!Object.prototype.hasOwnProperty.call(changes, key)) return null;
  return clampReadingGoalMinutes(value + changes[key]);
}
