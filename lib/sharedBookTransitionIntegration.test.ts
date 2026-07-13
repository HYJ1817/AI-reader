import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function optionalSource(path: string): string {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const transitionSource = optionalSource("../app/SharedBookTransition.tsx");
const coverSource = optionalSource("../app/MotionBookCover.tsx");
const librarySource = optionalSource("../app/LibrarySurface.tsx");
const dashboardSource = optionalSource("../app/ReadingDashboard.tsx");
const stackSource = optionalSource("../app/NavigationStack.tsx");
const pageSource = optionalSource("../app/page.tsx");
const readerBookStateSource = optionalSource("../app/useReaderBookState.ts");
const legacyPresentationUrl = new URL(
  "../app/useReaderPresentation.ts",
  import.meta.url
);

describe("shared reader presentation integration", () => {
  it("registers stable visible cover origins without projecting reduced motion", () => {
    expect(coverSource).toContain("layoutId={reduceMotion ? undefined : layoutId}");
    expect(coverSource).toContain("data-book-cover-origin={originId}");
    expect(coverSource).toContain("IntersectionObserver");
    expect(coverSource).toContain("useAppReducedMotion");
  });

  it("keeps reader exits present and restores a visible source", () => {
    expect(transitionSource).toContain("AnimatePresence");
    expect(transitionSource).toContain("getBookTransitionMode");
    expect(transitionSource).toContain("MOTION_SPRING.sharedBook");
    expect(transitionSource).toContain('data-reader-presented="true"');
    expect(transitionSource).toContain("closest<HTMLButtonElement>");
    expect(transitionSource).not.toContain("EpubReader");
    expect(stackSource).toContain("active && !readerPresented ? 1 : 0");
  });

  it("uses unique origins at every book entry point", () => {
    expect(librarySource).toContain("MotionBookCover");
    expect(librarySource).toContain('library-grid-${book.id}');
    expect(librarySource).toContain('library-list-${book.id}');
    expect(dashboardSource).toContain("MotionBookCover");
    expect(dashboardSource).toContain('reading-dashboard-${latestBook.id}');
  });

  it("drives the reader from navigation state without the two-frame hook", () => {
    expect(pageSource).toContain("navigation.state.reader");
    expect(pageSource).toContain("navigation.presentReader(book.id");
    expect(pageSource).toContain("<SharedBookTransition");
    expect(pageSource).toContain("navigation.dismissReader()");
    expect(readerBookStateSource).toContain(
      "books.find((book) => book.id === readerEntry.bookId)"
    );
    expect(readerBookStateSource).toContain("removeInvalid(readerEntry.key)");
    expect(pageSource).not.toContain("useReaderPresentation");
    expect(existsSync(legacyPresentationUrl)).toBe(false);
  });
});
