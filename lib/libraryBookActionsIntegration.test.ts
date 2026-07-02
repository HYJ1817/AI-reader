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

  it("renders library item progress without visual tracks", () => {
    expect(librarySource).toContain("formatLibraryProgressValue(progress)");
    expect(librarySource).not.toContain("bookListProgressTrack");
    expect(librarySource).not.toContain("bookGridProgress");
    expect(moduleCss).not.toContain(".bookListProgressTrack");
    expect(moduleCss).not.toContain(".bookGridProgress");
  });
});

describe("book delete confirmation", () => {
  it("keeps single-book deletion in a separate confirmation dialog", () => {
    const sheetStart = overlaysSource.indexOf(
      "className={styles.bookActionSheet}"
    );
    const sheetEnd = overlaysSource.indexOf("</BottomSheet>", sheetStart);
    const bookActionSheet = overlaysSource.slice(sheetStart, sheetEnd);

    expect(sheetStart).toBeGreaterThanOrEqual(0);
    expect(sheetEnd).toBeGreaterThan(sheetStart);
    expect(bookActionSheet).not.toContain("deleteConfirmBox");
    expect(bookActionSheet).not.toContain("bookAction.deleteConfirmOpen ?");
    expect(overlaysSource).toContain(
      "{actionBook && bookAction.deleteConfirmOpen && ("
    );
    expect(overlaysSource).toContain("styles.bookDeleteDialogOverlay");
    expect(overlaysSource).toContain('role="dialog"');
    expect(overlaysSource).toContain("aria-modal=\"true\"");
  });
});
