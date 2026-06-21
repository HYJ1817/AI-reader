export type ReaderSwipeAction = "prev" | "next" | "none";

type ReaderSwipeInput = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

const MIN_HORIZONTAL_DISTANCE = 64;
const HORIZONTAL_DOMINANCE_RATIO = 1.35;

export function getReaderSwipeAction({
  startX,
  startY,
  endX,
  endY,
}: ReaderSwipeInput): ReaderSwipeAction {
  if (![startX, startY, endX, endY].every(Number.isFinite)) return "none";

  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (absX < MIN_HORIZONTAL_DISTANCE) return "none";
  if (absX < absY * HORIZONTAL_DOMINANCE_RATIO) return "none";

  return deltaX > 0 ? "prev" : "next";
}

export function getReaderSwipeVisualOffset(
  deltaX: number,
  viewportWidth: number
): number {
  if (!Number.isFinite(deltaX) || !Number.isFinite(viewportWidth)) return 0;
  const maxOffset = Math.max(0, viewportWidth);
  return Math.min(maxOffset, Math.max(-maxOffset, deltaX));
}

export function getReaderSwipeSettleOffset(
  action: ReaderSwipeAction,
  currentOffset: number,
  viewportWidth: number
): number {
  if (!Number.isFinite(currentOffset) || !Number.isFinite(viewportWidth)) return 0;
  const width = Math.max(0, viewportWidth);
  if (width === 0 || action === "none") return 0;

  return action === "prev" ? width : -width;
}

export function hasActiveReaderSwipeOffset(offset: number): boolean {
  return Number.isFinite(offset) && Math.abs(offset) >= 0.5;
}

export type ReaderSwipeSettleTransitionInput = {
  propertyName: string;
  targetIsReader: boolean;
};

export function isReaderSwipeSettleTransition({
  propertyName,
  targetIsReader,
}: ReaderSwipeSettleTransitionInput): boolean {
  return targetIsReader && propertyName === "transform";
}
