import { describe, expect, it } from "vitest";
import {
  COMPACT_PUSH_OFFSETS,
  ROOT_TAB_OFFSETS,
  getCompactPushOffsets,
  getPushTransition,
  getPushMotionProfile,
  getRootTabOffsets,
  getNavigationSurfaceState,
  getNavigationTabIndex,
} from "./navigationMotion";

describe("navigation motion", () => {
  it("keeps a stable tab order for the shared indicator", () => {
    expect(getNavigationTabIndex("library")).toBe(0);
    expect(getNavigationTabIndex("reading")).toBe(1);
    expect(getNavigationTabIndex("settings")).toBe(2);
  });

  it("places inactive surfaces before or after the active tab", () => {
    expect(getNavigationSurfaceState("library", "reading")).toBe("before");
    expect(getNavigationSurfaceState("reading", "reading")).toBe("active");
    expect(getNavigationSurfaceState("settings", "reading")).toBe("after");
  });

  it("uses short directional offsets for root travel", () => {
    expect(getRootTabOffsets("library", "settings")).toEqual({
      outgoing: -6,
      incoming: 10,
    });
    expect(getRootTabOffsets("settings", "library")).toEqual({
      outgoing: 6,
      incoming: -10,
    });
    expect(getRootTabOffsets("reading", "reading")).toEqual({
      outgoing: 0,
      incoming: 0,
    });
  });

  it("uses compact navigation motion for focused configuration and search", () => {
    expect(getPushMotionProfile("ai-provider-configure")).toBe("compact");
    expect(getPushMotionProfile("library-search")).toBe("compact");
    expect(getPushMotionProfile("ai-providers")).toBe("depth");
    expect(getPushMotionProfile("collections")).toBe("depth");
    expect(getPushMotionProfile("custom-background")).toBe("depth");
    expect(getPushMotionProfile(undefined)).toBe("depth");
  });

  it("keeps root travel separate from compact pushed pages", () => {
    expect(COMPACT_PUSH_OFFSETS).toEqual({ incoming: 22, covered: -12 });
    expect(ROOT_TAB_OFFSETS).toEqual({ incoming: 10, outgoing: 6 });
    expect(getCompactPushOffsets(1)).toEqual({ incoming: 22, covered: -12 });
    expect(getCompactPushOffsets(-1)).toEqual({ incoming: -22, covered: 12 });
  });

  it("uses role timing for push enter, exit, and reduced motion", () => {
    expect(getPushTransition("enter", false).duration).toBe(0.28);
    expect(getPushTransition("exit", false).duration).toBe(0.2);
    expect(getPushTransition("enter", true).duration).toBe(0.1);
  });
});
