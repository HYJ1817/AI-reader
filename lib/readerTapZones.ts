export type ReaderTapAction = "prev" | "next" | "chrome";

type ReaderTapInput = {
  clientX: number;
  left: number;
  width: number;
};

const EDGE_RATIO = 0.28;

export function getReaderTapAction({
  clientX,
  left,
  width,
}: ReaderTapInput): ReaderTapAction {
  if (!Number.isFinite(width) || width <= 0) return "chrome";

  const x = clientX - left;
  if (x <= width * EDGE_RATIO) return "prev";
  if (x >= width * (1 - EDGE_RATIO)) return "next";
  return "chrome";
}
