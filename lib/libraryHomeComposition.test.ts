import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8"
);

describe("Library home composition", () => {
  it("derives render windows and counts from one presentation result", () => {
    expect(source).toContain("buildLibraryHomePresentation");
    expect(source).toContain("libraryHomePresentation.shelfBooks");
    expect(source).toContain("libraryHomePresentation.featuredBook?.id");
    expect(source).toContain(
      "filteredBookCount: libraryShelfBooks.length"
    );
    expect(source).toContain(
      "featuredBook: libraryHomePresentation.featuredBook"
    );
    expect(source).not.toContain(
      "const visibleBooks = filteredBooks.slice(0, visibleBookCount)"
    );
  });
});
