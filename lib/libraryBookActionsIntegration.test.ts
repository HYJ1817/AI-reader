import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatLibraryProgressValue } from "./libraryProgress";

const librarySource = readFileSync(
  new URL("../app/LibrarySurface.tsx", import.meta.url),
  "utf8"
);
const overlaysSource = readFileSync(
  new URL("../app/AppOverlays.tsx", import.meta.url),
  "utf8"
);
const pageSource = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8"
);
const moduleCss = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);

describe("library book progress presentation", () => {
  it("formats saved progress as a numeric percentage only", () => {
    expect(formatLibraryProgressValue(0)).toBe("0%");
    expect(formatLibraryProgressValue(44.4)).toBe("44%");
    expect(formatLibraryProgressValue(100)).toBe("100%");
  });

  it("renders semantic progress with a compact visual track", () => {
    expect(librarySource).toContain("buildLibraryBookPresentation(book, progress)");
    expect(librarySource).toContain('data-library-book-progress="true"');
    expect(librarySource).toContain("bookListProgressTrack");
    expect(librarySource).not.toContain("bookGridProgress");
    expect(moduleCss).toContain(".bookListProgressTrack");
    expect(moduleCss).not.toContain(".bookGridProgress");
  });
});

describe("book delete confirmation", () => {
  it("keeps single-book deletion in a separate navigation sheet route", () => {
    const sheetStart = overlaysSource.indexOf(
      "className={styles.bookActionSheet}"
    );
    const sheetEnd = overlaysSource.indexOf("</BottomSheet>", sheetStart);
    const bookActionSheet = overlaysSource.slice(sheetStart, sheetEnd);

    expect(sheetStart).toBeGreaterThanOrEqual(0);
    expect(sheetEnd).toBeGreaterThan(sheetStart);
    expect(bookActionSheet).not.toContain("deleteConfirmBox");
    expect(bookActionSheet).not.toContain("bookAction.deleteConfirmOpen ?");
    expect(overlaysSource).toContain('case "book-delete"');
    expect(overlaysSource).toContain("<BookDeleteSheet");
    expect(overlaysSource).not.toContain("bookAction.deleteConfirmOpen");
  });
});

describe("book group actions", () => {
  it("carries the active book id from the overlay into group mutations", () => {
    expect(overlaysSource).toContain(
      "actions.toggleBookGroup(book.id, item.id)"
    );
    expect(overlaysSource).toContain("actions.createGroup(book.id)");
    expect(pageSource).toContain(
      "async function handleToggleGroup(bookId: string, groupId: string)"
    );
    expect(pageSource).toContain(
      "async function handleCreateGroup(bookId: string)"
    );
    expect(pageSource).toContain(
      "const currentBook = books.find((book) => book.id === bookId)"
    );
  });
});
