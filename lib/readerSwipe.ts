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
