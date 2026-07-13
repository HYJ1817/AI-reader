import { describe, expect, it } from "vitest";
import {
  canStartEdgeBack,
  canSheetClaimGesture,
  shouldCompleteEdgeBack,
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

describe("edge back gestures", () => {
  it("starts only from the left edge on a push page", () => {
    expect(
      canStartEdgeBack({ clientX: 18, hasPush: true, inReader: false })
    ).toBe(true);
    expect(
      canStartEdgeBack({ clientX: 30, hasPush: true, inReader: false })
    ).toBe(false);
    expect(
      canStartEdgeBack({ clientX: 10, hasPush: true, inReader: true })
    ).toBe(false);
  });

  it("completes from distance or directional velocity", () => {
    expect(shouldCompleteEdgeBack(130, 120, 390)).toBe(true);
    expect(shouldCompleteEdgeBack(42, 720, 390)).toBe(true);
    expect(shouldCompleteEdgeBack(42, 120, 390)).toBe(false);
    expect(shouldCompleteEdgeBack(160, -720, 390)).toBe(true);
  });
});
