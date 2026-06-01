import { describe, expect, it } from "vitest";
import type { ReadingPosition } from "./db";
import {
  buildReadingProgressMap,
  formatLibraryProgressLabel,
  getBookProgressPercent,
} from "./libraryProgress";

function makePosition(
  bookId: string,
  progressPercent: number,
  updatedAt = "2024-01-01T00:00:00.000Z"
): ReadingPosition {
  return {
    bookId,
    locator: "loc",
    progressPercent,
    updatedAt,
  };
}

describe("buildReadingProgressMap", () => {
  it("normalizes progress values by book id", () => {
    const map = buildReadingProgressMap([
      makePosition("a", 42.4),
      makePosition("b", 160),
      makePosition("c", -10),
    ]);

    expect(map).toEqual({
      a: 42,
      b: 100,
      c: 0,
    });
  });

  it("keeps the latest duplicate position for a book", () => {
    const map = buildReadingProgressMap([
      makePosition("a", 20, "2024-01-01T00:00:00.000Z"),
      makePosition("a", 65, "2024-01-03T00:00:00.000Z"),
      makePosition("a", 40, "2024-01-02T00:00:00.000Z"),
    ]);

    expect(map.a).toBe(65);
  });
});

describe("getBookProgressPercent", () => {
  it("returns zero for books with no saved progress", () => {
    expect(getBookProgressPercent({ a: 30 }, "missing")).toBe(0);
  });
});

describe("formatLibraryProgressLabel", () => {
  it("labels unread books as not started", () => {
    expect(formatLibraryProgressLabel(0)).toBe("未开始");
  });

  it("labels finished books as completed", () => {
    expect(formatLibraryProgressLabel(100)).toBe("已读完");
  });

  it("formats in-progress books as a percentage", () => {
    expect(formatLibraryProgressLabel(37)).toBe("已读 37%");
  });
});
