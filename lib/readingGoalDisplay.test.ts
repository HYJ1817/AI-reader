import { describe, expect, it } from "vitest";
import {
  formatReadingGoalDuration,
  getReadingGoalArcPercent,
  getReadingGoalDisplay,
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

describe("formatReadingGoalDuration", () => {
  it.each([
    [0, "0:00"],
    [5, "0:05"],
    [65, "1:05"],
    [1440, "24:00"],
  ])("formats %i minutes as %s", (minutes, expected) => {
    expect(formatReadingGoalDuration(minutes)).toBe(expected);
  });

  it("normalizes invalid and negative input", () => {
    expect(formatReadingGoalDuration(-2)).toBe("0:00");
    expect(formatReadingGoalDuration(Number.NaN)).toBe("0:00");
  });
});

describe("getReadingGoalDisplay", () => {
  it("returns remaining minutes before completion", () => {
    expect(getReadingGoalDisplay(35, 120)).toEqual({
      remainingMinutes: 85,
      completed: false,
    });
  });

  it("clamps remaining minutes and marks completion", () => {
    expect(getReadingGoalDisplay(180, 120)).toEqual({
      remainingMinutes: 0,
      completed: true,
    });
  });
});
