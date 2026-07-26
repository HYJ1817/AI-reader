import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8"
);
const hookUrl = new URL("../app/useBookCoverBackfill.ts", import.meta.url);
const hookSource = existsSync(hookUrl) ? readFileSync(hookUrl, "utf8") : "";

describe("background book cover integration", () => {
  it("uses one shared hook for startup and restored metadata", () => {
    expect(pageSource).toContain('from "@/app/useBookCoverBackfill"');
    expect(pageSource).toContain("startBookCoverBackfill(storedBooks)");
    expect(pageSource).toContain("startBookCoverBackfill(restoredBooks)");
  });

  it("supplies the latest rendered Library books as queue priority", () => {
    expect(pageSource).toContain("visibleBookIds");
    expect(pageSource).toContain("libraryHomePresentation.featuredBook?.id");
    expect(pageSource).toContain("...visibleBooks.map((book) => book.id)");
    expect(hookSource).toContain("visibleBookIdsRef.current");
    expect(hookSource).toContain("getVisibleBookIds: () => visibleBookIdsRef.current");
  });

  it("cancels stale runs and publishes each successful cover functionally", () => {
    expect(hookSource).toContain("new AbortController()");
    expect(hookSource).toContain("currentRunRef.current?.abort()");
    expect(hookSource).toContain("setBooks((currentBooks)");
    expect(hookSource).toContain("mergeBookCoverMetadata(");
  });

  it("schedules cover work without making startup or restore await it", () => {
    expect(hookSource).toContain("requestIdleCallback");
    expect(pageSource).not.toContain(
      "await startBookCoverBackfill(restoredBooks)"
    );
  });
});
