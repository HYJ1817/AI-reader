import { describe, expect, it } from "vitest";
import {
  getSheetPageBoundary,
  getSheetPageTarget,
  getSheetViewportHeight,
} from "./sheetStackMotion";

describe("sheet page stack motion", () => {
  it("keeps the active page at rest and the parent mounted behind it", () => {
    expect(getSheetPageTarget(0, false)).toEqual({ opacity: 1, x: 0 });
    expect(getSheetPageTarget(-1, false)).toEqual({ opacity: 1, x: 0 });
    expect(getSheetPageTarget(1, false)).toEqual({ opacity: 0.92, x: -12 });
    expect(getSheetPageTarget(3, false)).toEqual({ opacity: 0.92, x: -12 });
  });

  it("removes covered-page visibility and travel under reduced motion", () => {
    expect(getSheetPageTarget(0, true)).toEqual({ opacity: 1, x: 0 });
    expect(getSheetPageTarget(1, true)).toEqual({ opacity: 0, x: 0 });
  });

  it.each([
    ["forward", "enter", { opacity: 0, x: 24 }],
    ["forward", "exit", { opacity: 0, x: -12 }],
    ["backward", "enter", { opacity: 0, x: -12 }],
    ["backward", "exit", { opacity: 0, x: 24 }],
    ["replace", "enter", { opacity: 0, x: 0 }],
    ["replace", "exit", { opacity: 0, x: 0 }],
  ] as const)("uses the %s %s boundary", (direction, phase, expected) => {
    expect(getSheetPageBoundary(direction, phase, false)).toEqual(expected);
  });

  it.each([
    ["forward", "enter"],
    ["forward", "exit"],
    ["backward", "enter"],
    ["backward", "exit"],
    ["replace", "enter"],
    ["replace", "exit"],
  ] as const)("removes the %s %s boundary under reduced motion", (direction, phase) => {
    expect(getSheetPageBoundary(direction, phase, true)).toEqual({
      opacity: 0,
      x: 0,
    });
  });

  it("holds the last measured height only while the final page exits", () => {
    expect(getSheetViewportHeight(420, 360, true)).toBe(420);
    expect(getSheetViewportHeight(undefined, 360, true)).toBe(360);
    expect(getSheetViewportHeight(undefined, 360, false)).toBe("auto");
    expect(getSheetViewportHeight(undefined, undefined, true)).toBe("auto");
  });
});
