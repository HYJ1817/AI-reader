import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const surface = readFileSync(
  new URL("../app/LibrarySurface.tsx", import.meta.url),
  "utf8"
);
const resultsUrl = new URL("../app/LibraryBookResults.tsx", import.meta.url);
const results = existsSync(resultsUrl) ? readFileSync(resultsUrl, "utf8") : "";
const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const copy = readFileSync(new URL("./uiText.ts", import.meta.url), "utf8");
const css = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);

describe("library empty and recovery states", () => {
  it("shows only the central import action for an empty library", () => {
    expect(surface).toContain("books.length > 0 && !editing.library");
    expect(surface).toContain("UI_TEXT.LOCAL_STORAGE_ONLY");
    expect(surface).toContain("UI_TEXT.IMPORT_BOOKS");
  });

  it("announces import errors and offers a retry label", () => {
    expect(surface).toContain('role="alert"');
    expect(surface).toContain("UI_TEXT.RESELECT_FILE");
  });

  it("recovers search and collection empty states one condition at a time", () => {
    expect(surface).toContain("actions.showAllBooks");
    expect(surface).toContain("UI_TEXT.CLEAR_SEARCH");
    expect(surface).toContain("UI_TEXT.VIEW_ALL_BOOKS");
    expect(page).toContain("showAllBooks: () => setGroupFilter(null)");
  });

  it("shares the complete list and grid renderer with search", () => {
    expect(results).toContain('mode === "grid"');
    expect(results).toContain("data-library-result-mode={mode}");
    expect(results).toContain("originPrefix");
    expect(results).toContain("layoutGroupId");
    expect(surface).toContain("<LibraryBookResults");
    expect(surface).not.toContain("visibleBooks.map((book)");
  });

  it("keeps primary touch targets at least 44px high", () => {
    expect(css).toMatch(/\.primaryButton\s*\{[^}]*min-height:\s*44px/s);
  });

  it("defines safe user-facing import errors", () => {
    expect(copy).toContain("ERROR_LOCAL_STORAGE_UNAVAILABLE");
    expect(copy).toContain("ERROR_STORAGE_FULL");
    expect(copy).toContain("ERROR_INVALID_BOOK_FILE");
  });
});
