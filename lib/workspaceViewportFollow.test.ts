import { describe, expect, it } from "vitest";
import {
  getAnchoredPrependScrollTop,
  isWorkspaceNearBottom,
  shouldFollowWorkspaceViewport,
} from "./workspaceViewportFollow";

describe("workspace viewport following", () => {
  it("uses a bounded bottom threshold", () => {
    expect(isWorkspaceNearBottom(1000, 500, 452)).toBe(true);
    expect(isWorkspaceNearBottom(1000, 500, 400)).toBe(false);
  });

  it("never follows while the user owns scrolling", () => {
    expect(
      shouldFollowWorkspaceViewport({
        nearBottom: true,
        userInteracting: true,
        visible: true,
      })
    ).toBe(false);
  });

  it("preserves the visible anchor when older rows prepend", () => {
    expect(
      getAnchoredPrependScrollTop({
        currentScrollTop: 800,
        previousAnchorTop: 120,
        nextAnchorTop: 720,
      })
    ).toBe(1400);
  });

  it("uses anchor movement instead of total height during concurrent tail growth", () => {
    expect(
      getAnchoredPrependScrollTop({
        currentScrollTop: 800,
        previousAnchorTop: 120,
        nextAnchorTop: 420,
      })
    ).toBe(1100);
  });
});
