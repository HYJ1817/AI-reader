import { describe, expect, it } from "vitest";
import {
  getReaderSwipeAction,
  getReaderSwipeSettleDuration,
  getReaderSwipeSettleOffset,
  getReaderSwipeVisualOffset,
  hasActiveReaderSwipeOffset,
  isReaderSwipeSettleTransition,
} from "./readerSwipe";

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

describe("getReaderSwipeVisualOffset", () => {
  it("tracks the finger one-to-one within the page-turn range", () => {
    expect(getReaderSwipeVisualOffset(72, 390)).toBe(72);
    expect(getReaderSwipeVisualOffset(-96, 390)).toBe(-96);
  });

  it("tracks across the full viewport and caps only beyond one page", () => {
    expect(getReaderSwipeVisualOffset(300, 390)).toBe(300);
    expect(getReaderSwipeVisualOffset(-300, 390)).toBe(-300);
    expect(getReaderSwipeVisualOffset(460, 390)).toBe(390);
    expect(getReaderSwipeVisualOffset(-460, 390)).toBe(-390);
  });
});

describe("getReaderSwipeSettleOffset", () => {
  it("continues an accepted swipe in the same direction", () => {
    expect(getReaderSwipeSettleOffset("next", -84, 390)).toBe(-390);
    expect(getReaderSwipeSettleOffset("prev", 92, 390)).toBe(390);
  });

  it("rebounds a rejected swipe to rest", () => {
    expect(getReaderSwipeSettleOffset("none", 46, 390)).toBe(0);
  });

  it("returns rest for invalid viewport widths", () => {
    expect(getReaderSwipeSettleOffset("next", -84, Number.NaN)).toBe(0);
    expect(getReaderSwipeSettleOffset("prev", 84, 0)).toBe(0);
  });
});

describe("getReaderSwipeSettleDuration", () => {
  it("uses one duration policy for accepted and rejected swipes", () => {
    expect(getReaderSwipeSettleDuration("next", false)).toBe(160);
    expect(getReaderSwipeSettleDuration("prev", false)).toBe(160);
    expect(getReaderSwipeSettleDuration("none", false)).toBe(180);
    expect(getReaderSwipeSettleDuration("next", true)).toBe(0);
  });
});

describe("hasActiveReaderSwipeOffset", () => {
  it("recognizes an interrupted page-turn position", () => {
    expect(hasActiveReaderSwipeOffset(18)).toBe(true);
    expect(hasActiveReaderSwipeOffset(-18)).toBe(true);
  });

  it("ignores rest positions and invalid values", () => {
    expect(hasActiveReaderSwipeOffset(0)).toBe(false);
    expect(hasActiveReaderSwipeOffset(0.25)).toBe(false);
    expect(hasActiveReaderSwipeOffset(Number.NaN)).toBe(false);
  });
});

describe("isReaderSwipeSettleTransition", () => {
  it("accepts only the reader element's transform transition", () => {
    expect(
      isReaderSwipeSettleTransition({
        propertyName: "transform",
        targetIsReader: true,
      })
    ).toBe(true);
    expect(
      isReaderSwipeSettleTransition({
        propertyName: "opacity",
        targetIsReader: true,
      })
    ).toBe(false);
    expect(
      isReaderSwipeSettleTransition({
        propertyName: "transform",
        targetIsReader: false,
      })
    ).toBe(false);
  });
});
