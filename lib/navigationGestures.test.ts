import { describe, expect, it } from "vitest";
import {
  canSheetClaimGesture,
  shouldCompleteSheetDismiss,
} from "./navigationGestures";

describe("sheet gestures", () => {
  it("claims headers and top-of-scroll downward body drags", () => {
    expect(
      canSheetClaimGesture({ fromHeader: true, scrollTop: 80, deltaY: 12 })
    ).toBe(true);
    expect(
      canSheetClaimGesture({ fromHeader: false, scrollTop: 0, deltaY: 12 })
    ).toBe(true);
    expect(
      canSheetClaimGesture({ fromHeader: false, scrollTop: 20, deltaY: 12 })
    ).toBe(false);
  });

  it("does not claim upward or stationary movement", () => {
    expect(
      canSheetClaimGesture({ fromHeader: true, scrollTop: 0, deltaY: 0 })
    ).toBe(false);
    expect(
      canSheetClaimGesture({ fromHeader: true, scrollTop: 0, deltaY: -12 })
    ).toBe(false);
  });

  it("dismisses by distance or directional velocity", () => {
    expect(shouldCompleteSheetDismiss(180, 100, 520)).toBe(true);
    expect(shouldCompleteSheetDismiss(40, 950, 520)).toBe(true);
    expect(shouldCompleteSheetDismiss(40, 180, 520)).toBe(false);
    expect(shouldCompleteSheetDismiss(40, -950, 520)).toBe(false);
  });
});
