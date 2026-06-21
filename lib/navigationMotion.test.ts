import { describe, expect, it } from "vitest";
import {
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
});
