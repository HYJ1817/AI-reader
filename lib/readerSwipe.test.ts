import { describe, expect, it } from "vitest";
import { getReaderSwipeAction } from "./readerSwipe";

describe("getReaderSwipeAction", () => {
  it("returns next for a clear left swipe", () => {
    expect(getReaderSwipeAction({ startX: 260, startY: 100, endX: 140, endY: 106 })).toBe("next");
  });

  it("returns prev for a clear right swipe", () => {
    expect(getReaderSwipeAction({ startX: 120, startY: 100, endX: 238, endY: 104 })).toBe("prev");
  });

  it("ignores small horizontal movement", () => {
    expect(getReaderSwipeAction({ startX: 120, startY: 100, endX: 92, endY: 103 })).toBe("none");
  });

  it("ignores mostly vertical movement", () => {
    expect(getReaderSwipeAction({ startX: 180, startY: 100, endX: 90, endY: 210 })).toBe("none");
  });

  it("ignores invalid coordinates", () => {
    expect(getReaderSwipeAction({ startX: 0, startY: 0, endX: Number.NaN, endY: 0 })).toBe("none");
  });
});
