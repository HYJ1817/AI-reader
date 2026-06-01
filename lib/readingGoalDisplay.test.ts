import { describe, expect, it } from "vitest";
import {
  getReadingGoalArcPercent,
  getReadingGoalContinueSubtitle,
} from "./readingGoalDisplay";

describe("getReadingGoalArcPercent", () => {
  it("returns progress against the target as a clamped percentage", () => {
    expect(getReadingGoalArcPercent(11, 120)).toBe(9.2);
    expect(getReadingGoalArcPercent(180, 120)).toBe(100);
    expect(getReadingGoalArcPercent(-5, 120)).toBe(0);
  });

  it("returns zero when the target is invalid", () => {
    expect(getReadingGoalArcPercent(10, 0)).toBe(0);
    expect(getReadingGoalArcPercent(10, Number.NaN)).toBe(0);
  });
});

describe("getReadingGoalContinueSubtitle", () => {
  it("uses the open book title when present", () => {
    expect(getReadingGoalContinueSubtitle("高兴【作者：贾平凹】")).toBe(
      "高兴【作者：贾平凹】"
    );
  });

  it("falls back to a library prompt when no book is open", () => {
    expect(getReadingGoalContinueSubtitle(null)).toBe("从书库选择一本书");
    expect(getReadingGoalContinueSubtitle("   ")).toBe("从书库选择一本书");
  });
});
