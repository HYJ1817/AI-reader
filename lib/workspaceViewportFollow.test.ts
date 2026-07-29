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
    expect(getAnchoredPrependScrollTop(800, 1200, 1800)).toBe(1400);
  });
});
