import { describe, expect, it } from "vitest";
import {
  getAnchoredPrependScrollTop,
  getWorkspaceManualScrollOwnership,
  isWorkspaceNearBottom,
  shouldRestoreWorkspacePrependAnchor,
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

  it("updates manual ownership through post-release momentum and releases at bottom", () => {
    expect(
      getWorkspaceManualScrollOwnership({
        scrollHeight: 1_000,
        clientHeight: 100,
        scrollTop: 520,
      })
    ).toEqual({
      nearBottom: false,
      manualAway: true,
      ownedScrollTop: 520,
    });
    expect(
      getWorkspaceManualScrollOwnership({
        scrollHeight: 1_000,
        clientHeight: 100,
        scrollTop: 460,
      })
    ).toEqual({
      nearBottom: false,
      manualAway: true,
      ownedScrollTop: 460,
    });
    expect(
      getWorkspaceManualScrollOwnership({
        scrollHeight: 1_000,
        clientHeight: 100,
        scrollTop: 852,
      })
    ).toEqual({
      nearBottom: true,
      manualAway: false,
      ownedScrollTop: null,
    });
  });

  it("does not restore a stale prepend anchor after user interaction", () => {
    expect(shouldRestoreWorkspacePrependAnchor(4, 4)).toBe(true);
    expect(shouldRestoreWorkspacePrependAnchor(4, 5)).toBe(false);
  });
});
