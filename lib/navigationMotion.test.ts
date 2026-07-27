import { describe, expect, it } from "vitest";
import {
  COMPACT_PUSH_OFFSETS,
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

  it("uses compact directional offsets for root travel", () => {
    expect(getRootTabOffsets("library", "settings")).toEqual({
      outgoing: -12,
      incoming: 22,
    });
    expect(getRootTabOffsets("settings", "library")).toEqual({
      outgoing: 12,
      incoming: -22,
    });
    expect(getRootTabOffsets("reading", "reading")).toEqual({
      outgoing: 0,
      incoming: 0,
    });
  });

  it("uses compact navigation motion only for provider configuration", () => {
    expect(getPushMotionProfile("ai-provider-configure")).toBe("compact");
    expect(getPushMotionProfile("ai-providers")).toBe("depth");
    expect(getPushMotionProfile("collections")).toBe("depth");
    expect(getPushMotionProfile("custom-background")).toBe("depth");
    expect(getPushMotionProfile(undefined)).toBe("depth");
  });

  it("shares root navigation travel distances with compact pushes", () => {
    expect(COMPACT_PUSH_OFFSETS).toEqual({ incoming: 22, covered: -12 });
    expect(getRootTabOffsets("library", "settings")).toEqual({
      outgoing: COMPACT_PUSH_OFFSETS.covered,
      incoming: COMPACT_PUSH_OFFSETS.incoming,
    });
  });
});
