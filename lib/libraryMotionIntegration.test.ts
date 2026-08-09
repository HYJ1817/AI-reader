import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../app/LibrarySurface.tsx", import.meta.url),
  "utf8"
);
const resultsSource = readFileSync(
  new URL("../app/LibraryBookResults.tsx", import.meta.url),
  "utf8"
);

describe("library state motion", () => {
  it("keeps book layout keyed by stable IDs and retains removal presence", () => {
    expect(resultsSource).toContain("LayoutGroup");
    expect(resultsSource).toContain("AnimatePresence");
    expect(resultsSource).toContain('layout={reduceMotion ? false : "position"}');
    expect(resultsSource).toContain("key={book.id}");
    expect(resultsSource).toContain("opacity: 0, scale: 0.96");
    expect(source).not.toContain("key={view.searchQuery}");
    expect(source).not.toContain("key={view.mode}");
  });

  it("staggers only the first six genuinely new books", () => {
    expect(source).toContain("previousBookSnapshot");
    expect(source).toContain("newlyAddedBookIds");
    expect(source).toContain(".slice(0, 6)");
    expect(resultsSource).toContain("entranceIndex * 0.03");
  });

  it("moves one shared indicator between grid and list modes", () => {
    expect(source).toContain("library-view-indicator");
    expect(source).toContain("styles.libraryViewIndicator");
    expect(source).toContain("layoutId=");
  });
});
