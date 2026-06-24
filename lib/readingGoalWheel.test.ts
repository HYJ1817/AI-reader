import { describe, expect, it } from "vitest";
import {
  clampReadingGoalMinutes,
  getReadingGoalWheelValues,
  getReadingGoalWheelValueForKey,
} from "./readingGoalWheel";

describe("clampReadingGoalMinutes", () => {
  it("clamps and rounds values into the supported range", () => {
    expect(clampReadingGoalMinutes(0)).toBe(1);
    expect(clampReadingGoalMinutes(120.8)).toBe(121);
    expect(clampReadingGoalMinutes(1600)).toBe(1440);
  });
});

describe("getReadingGoalWheelValues", () => {
  it("returns five values centered around ordinary selections", () => {
    expect(getReadingGoalWheelValues(120)).toEqual([118, 119, 120, 121, 122]);
  });

  it("keeps a five-value window at both boundaries", () => {
    expect(getReadingGoalWheelValues(1)).toEqual([1, 2, 3, 4, 5]);
    expect(getReadingGoalWheelValues(1440)).toEqual([
      1436, 1437, 1438, 1439, 1440,
    ]);
  });
});

describe("getReadingGoalWheelValueForKey", () => {
  it.each([
    ["ArrowUp", 119],
    ["ArrowDown", 121],
    ["PageUp", 110],
    ["PageDown", 130],
    ["Home", 1],
    ["End", 1440],
  ])("maps %s to %i", (key, expected) => {
    expect(getReadingGoalWheelValueForKey(120, key)).toBe(expected);
  });

  it("returns null for unrelated keys and clamps boundaries", () => {
    expect(getReadingGoalWheelValueForKey(120, "Enter")).toBeNull();
    expect(getReadingGoalWheelValueForKey(1, "ArrowUp")).toBe(1);
    expect(getReadingGoalWheelValueForKey(1440, "ArrowDown")).toBe(1440);
  });
});
