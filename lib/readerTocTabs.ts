export const READER_TOC_TABS = [
  "chapters",
  "bookmarks",
  "highlights",
] as const;

export type ReaderTocTab = (typeof READER_TOC_TABS)[number];

function clampTabIndex(index: number): number {
  return Math.min(READER_TOC_TABS.length - 1, Math.max(0, Math.round(index)));
}

export function getReaderTocTabScrollLeft(
  index: number,
  width: number
): number {
  return clampTabIndex(index) * Math.max(0, width);
}

export function getNearestReaderTocTabIndex(
  scrollLeft: number,
  width: number
): number {
  return width <= 0 ? 0 : clampTabIndex(scrollLeft / width);
}
