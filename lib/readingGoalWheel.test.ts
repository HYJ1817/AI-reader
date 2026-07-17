import { describe, expect, it } from "vitest";
import {
  READING_GOAL_MAX_MINUTES,
  READING_GOAL_MIN_MINUTES,
  clampReadingGoalMinutes,
  clampReadingGoalWheelPosition,
  getReadingGoalWheelAnimationMix,
  getReadingGoalWheelDeltaRows,
  getReadingGoalWheelDragTarget,
  getReadingGoalWheelSelectedValue,
  getReadingGoalWheelValues,
  getReadingGoalWheelValueForKey,
  getReadingGoalWheelVisualState,
  shouldPlayReadingGoalTick,
} from "./readingGoalWheel";

describe("reading-goal wheel domain", () => {
  it("uses the inclusive 0 through 1440 range", () => {
    expect(READING_GOAL_MIN_MINUTES).toBe(0);
    expect(READING_GOAL_MAX_MINUTES).toBe(1440);
  });
});

describe("clampReadingGoalMinutes", () => {
  it.each([
    [-1, 0],
    [0, 0],
    [120.8, 121],
    [1600, 1440],
    [NaN, 0],
  ])("clamps %p to %i", (value, expected) => {
    expect(clampReadingGoalMinutes(value)).toBe(expected);
  });
});

describe("clampReadingGoalWheelPosition", () => {
  it("keeps fractional positions and clamps invalid values", () => {
    expect(clampReadingGoalWheelPosition(120.25)).toBe(120.25);
    expect(clampReadingGoalWheelPosition(-1)).toBe(0);
    expect(clampReadingGoalWheelPosition(1600)).toBe(1440);
    expect(clampReadingGoalWheelPosition(Infinity)).toBe(0);
  });
});

describe("wheel selection and dragging", () => {
  it("rounds the selected value at the midpoint", () => {
    expect(getReadingGoalWheelSelectedValue(119.49)).toBe(119);
    expect(getReadingGoalWheelSelectedValue(119.5)).toBe(120);
  });

  it("derives a clamped drag target", () => {
    expect(getReadingGoalWheelDragTarget(120, 200, 181, 38)).toBe(120.5);
  });

  it("returns the bounded current target for boundary or invalid drags", () => {
    expect(getReadingGoalWheelDragTarget(0, 200, 181, 38)).toBe(0.5);
    expect(getReadingGoalWheelDragTarget(0, 181, 200, 38)).toBe(0);
    expect(getReadingGoalWheelDragTarget(120, 200, 181, 0)).toBe(120);
    expect(getReadingGoalWheelDragTarget(120, Infinity, 181, 38)).toBe(120);
  });
});

describe("getReadingGoalWheelDeltaRows", () => {
  it("normalizes pixel deltas by the measured row height", () => {
    expect(getReadingGoalWheelDeltaRows(76, 0, 38, 190)).toBe(2);
    expect(getReadingGoalWheelDeltaRows(-19, 0, 38, 190)).toBe(-0.5);
  });

  it("treats line deltas as wheel rows", () => {
    expect(getReadingGoalWheelDeltaRows(3, 1, 38, 190)).toBe(3);
    expect(getReadingGoalWheelDeltaRows(-2, 1, 38, 190)).toBe(-2);
  });

  it("scales page deltas by the viewport row count", () => {
    expect(getReadingGoalWheelDeltaRows(1, 2, 38, 190)).toBe(5);
    expect(getReadingGoalWheelDeltaRows(-2, 2, 38, 190)).toBe(-10);
  });

  it("falls back to one row per page unit for an invalid viewport", () => {
    expect(getReadingGoalWheelDeltaRows(2, 2, 38, 0)).toBe(2);
    expect(getReadingGoalWheelDeltaRows(2, 2, 38, -1)).toBe(2);
  });

  it("rejects invalid deltas, modes, and row measurements", () => {
    expect(getReadingGoalWheelDeltaRows(NaN, 0, 38, 190)).toBe(0);
    expect(getReadingGoalWheelDeltaRows(2, NaN, 38, 190)).toBe(0);
    expect(getReadingGoalWheelDeltaRows(2, 3, 38, 190)).toBe(0);
    expect(getReadingGoalWheelDeltaRows(2, 0, 0, 190)).toBe(0);
    expect(getReadingGoalWheelDeltaRows(2, 0, Infinity, 190)).toBe(0);
    expect(getReadingGoalWheelDeltaRows(2, 2, 38, Infinity)).toBe(0);
  });
});

describe("getReadingGoalWheelValues", () => {
  it("returns an intact 15-value window at ordinary selections and boundaries", () => {
    expect(getReadingGoalWheelValues(120)).toEqual([
      113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126,
      127,
    ]);
    expect(getReadingGoalWheelValues(0)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
    ]);
    expect(getReadingGoalWheelValues(1440)).toEqual([
      1426, 1427, 1428, 1429, 1430, 1431, 1432, 1433, 1434, 1435, 1436,
      1437, 1438, 1439, 1440,
    ]);
  });
});

describe("getReadingGoalWheelVisualState", () => {
  it("uses step-based blur, fade, and emphasis", () => {
    expect(getReadingGoalWheelVisualState(122, 120)).toEqual({
      offsetSteps: 2,
      blurPx: 4,
      opacity: 0.5,
      emphasis: 0,
    });
    expect(getReadingGoalWheelVisualState(140, 120)).toEqual({
      offsetSteps: 20,
      blurPx: 40,
      opacity: 0.05,
      emphasis: 0,
    });
    expect(getReadingGoalWheelVisualState(120, 120.25)).toEqual({
      offsetSteps: -0.25,
      blurPx: 0.5,
      opacity: 0.9375,
      emphasis: 0.75,
    });
  });
});

describe("getReadingGoalWheelValueForKey", () => {
  it.each([
    ["ArrowUp", 119],
    ["ArrowDown", 121],
    ["PageUp", 110],
    ["PageDown", 130],
    ["Home", 0],
    ["End", 1440],
  ])("maps %s to %i", (key, expected) => {
    expect(getReadingGoalWheelValueForKey(120, key)).toBe(expected);
  });

  it("does not loop at boundaries and ignores unrelated keys", () => {
    expect(getReadingGoalWheelValueForKey(0, "ArrowUp")).toBe(0);
    expect(getReadingGoalWheelValueForKey(1440, "ArrowDown")).toBe(1440);
    expect(getReadingGoalWheelValueForKey(120, "Enter")).toBeNull();
    expect(getReadingGoalWheelValueForKey(120, "constructor")).toBeNull();
  });
});

describe("getReadingGoalWheelAnimationMix", () => {
  it("uses exponential smoothing and falls back to an immediate mix", () => {
    expect(getReadingGoalWheelAnimationMix(250)).toBeCloseTo(1 - Math.exp(-1));
    expect(getReadingGoalWheelAnimationMix(0)).toBe(0);
    expect(getReadingGoalWheelAnimationMix(20, 0)).toBe(1);
    expect(getReadingGoalWheelAnimationMix(NaN)).toBe(1);
  });
});

describe("shouldPlayReadingGoalTick", () => {
  it("ticks only for a changed minute after the minimum interval", () => {
    expect(shouldPlayReadingGoalTick(120, 121, 1000, 0)).toBe(true);
    expect(shouldPlayReadingGoalTick(120, 120, 1000, 0)).toBe(false);
    expect(shouldPlayReadingGoalTick(120, 121, 20, 0)).toBe(false);
    expect(shouldPlayReadingGoalTick(120, 121, 40, 0)).toBe(true);
  });
});
