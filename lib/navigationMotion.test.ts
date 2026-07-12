import { describe, expect, it } from "vitest";
import {
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
});
