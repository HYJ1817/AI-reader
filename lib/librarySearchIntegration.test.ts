import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pushSurfaces = readFileSync(
  new URL("../app/AppPushSurfaces.tsx", import.meta.url),
  "utf8"
);
const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const searchSurfaceUrl = new URL(
  "../app/LibrarySearchSurface.tsx",
  import.meta.url
);
const searchSurface = existsSync(searchSurfaceUrl)
  ? readFileSync(searchSurfaceUrl, "utf8")
  : "";

describe("library search surface", () => {
  it("routes a global search surface through the push stack", () => {
    expect(pushSurfaces).toContain('case "library-search"');
    expect(searchSurface).toContain('data-library-search-surface="true"');
    expect(searchSurface).toContain("<LibraryBookResults");
    expect(searchSurface).toContain('originPrefix="library-search"');
  });

  it("searches all books and follows the shared library view mode", () => {
    expect(page).toContain(
      "filterBooksByQuery(books, librarySearchQuery)"
    );
    expect(page).toContain("mode: libraryView");
    expect(page).not.toContain(
      "filterBooksByQuery(\n    groupFilteredBooks"
    );
  });

  it("exposes recoverable empty and no-match states", () => {
    expect(searchSurface).toContain('aria-label={UI_TEXT.SEARCH}');
    expect(searchSurface).toContain("UI_TEXT.NO_MATCHING_BOOKS");
    expect(searchSurface).toContain("UI_TEXT.CLEAR_SEARCH");
    expect(searchSurface).toContain("UI_TEXT.IMPORT_BOOKS");
  });
});
