export type BookTransitionMode = "shared" | "fallback";

export function bookCoverLayoutId(originId: string): string {
  return `book-cover-${originId}`;
}

export function getBookTransitionMode(
  sourceVisible: boolean,
  sourceBookId: string | null,
  activeBookId: string
): BookTransitionMode {
  return sourceVisible && sourceBookId === activeBookId ? "shared" : "fallback";
}
