export type TapGestureInput = {
  durationMs: number;
  deltaX: number;
  deltaY: number;
  maxDurationMs?: number;
  maxDistancePx?: number;
};

export const READER_GESTURE_MOVEMENT_THRESHOLD_PX = 18;

export function isTapGesture({
  durationMs,
  deltaX,
  deltaY,
  maxDurationMs = 420,
  maxDistancePx = READER_GESTURE_MOVEMENT_THRESHOLD_PX,
}: TapGestureInput): boolean {
  if (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > maxDurationMs) {
    return false;
  }

  return Math.hypot(deltaX, deltaY) <= maxDistancePx;
}

export type ScrollIntentInput = {
  deltaX: number;
  deltaY: number;
  thresholdPx?: number;
};

export function isScrollIntent({
  deltaX,
  deltaY,
  thresholdPx = READER_GESTURE_MOVEMENT_THRESHOLD_PX,
}: ScrollIntentInput): boolean {
  return Math.hypot(deltaX, deltaY) >= thresholdPx;
}

export type ChromeScrollInput = {
  elapsedSinceChromeTapMs: number;
  suppressionMs?: number;
};

export function shouldHideChromeForScroll({
  elapsedSinceChromeTapMs,
  suppressionMs = 240,
}: ChromeScrollInput): boolean {
  return !Number.isFinite(elapsedSinceChromeTapMs) || elapsedSinceChromeTapMs >= suppressionMs;
}

export type ReducedReaderMotionInput = {
  appPreference: boolean;
  systemPreference: boolean;
};

export function shouldReduceReaderMotion({
  appPreference,
  systemPreference,
}: ReducedReaderMotionInput): boolean {
  return appPreference || systemPreference;
}

export function clampSheetDrag(translationY: number, sheetHeight: number): number {
  const safeHeight = Number.isFinite(sheetHeight) ? Math.max(0, sheetHeight) : 0;
  const safeTranslation = Number.isFinite(translationY) ? translationY : 0;
  return Math.min(safeHeight, Math.max(0, safeTranslation));
}

export function getTransformTranslateY(transform: string): number {
  if (!transform || transform === "none") return 0;

  const match = transform.match(/^matrix(3d)?\(([^)]+)\)$/);
  if (!match) return 0;

  const values = match[2].split(",").map((value) => Number(value.trim()));
  const translateY = match[1] ? values[13] : values[5];
  return Number.isFinite(translateY) ? translateY : 0;
}

export type SheetDragTranslationInput = {
  baseTranslationY: number;
  pointerDeltaY: number;
  sheetHeight: number;
};

export function getSheetDragTranslation({
  baseTranslationY,
  pointerDeltaY,
  sheetHeight,
}: SheetDragTranslationInput): number {
  const safeBase = Number.isFinite(baseTranslationY) ? baseTranslationY : 0;
  const safeDelta = Number.isFinite(pointerDeltaY) ? pointerDeltaY : 0;
  return clampSheetDrag(safeBase + safeDelta, sheetHeight);
}

export function getSheetBackdropOpacity(
  translationY: number,
  sheetHeight: number
): number {
  if (
    !Number.isFinite(translationY) ||
    !Number.isFinite(sheetHeight) ||
    sheetHeight <= 0
  ) {
    return 1;
  }

  const progress = clampSheetDrag(translationY, sheetHeight) / sheetHeight;
  return 1 - Math.pow(progress, 0.85) * 0.64;
}

export type SheetCloseTransitionInput = {
  propertyName: string;
  targetIsPanel: boolean;
};

export function isSheetCloseTransition({
  propertyName,
  targetIsPanel,
}: SheetCloseTransitionInput): boolean {
  return targetIsPanel && propertyName === "transform";
}

export function canInterruptSheetPhase(phase: string): boolean {
  return phase === "entering" || phase === "open" || phase === "closing";
}

export type SheetDismissInput = {
  translationY: number;
  velocityY: number;
  sheetHeight: number;
};

export function shouldDismissSheet({
  translationY,
  velocityY,
  sheetHeight,
}: SheetDismissInput): boolean {
  const safeHeight = Math.max(1, sheetHeight);
  const distanceThreshold = Math.min(140, safeHeight * 0.28);
  const intentDistanceThreshold = Math.min(120, safeHeight * 0.18);
  const fastFlick = velocityY >= 900 && translationY >= 24;
  const committedDrag =
    velocityY >= 480 && translationY >= intentDistanceThreshold;

  return translationY >= distanceThreshold || committedDrag || fastFlick;
}
