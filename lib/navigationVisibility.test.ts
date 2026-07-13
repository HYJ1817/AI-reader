import { describe, expect, it } from "vitest";
import { shouldShowBottomTabs } from "./navigationVisibility";

describe("shouldShowBottomTabs", () => {
  it.each(["library", "reading", "settings"] as const)(
    "hides the bottom tabs while the reader covers %s",
    (tab) => {
      expect(shouldShowBottomTabs(tab, true)).toBe(false);
    }
  );

  it("does not couple an inactive saved book to bottom-tab visibility", () => {
    expect(shouldShowBottomTabs("reading", false)).toBe(true);
  });

  it("shows the bottom tabs on the main library, reading dashboard, and settings tabs", () => {
    expect(shouldShowBottomTabs("library", false)).toBe(true);
    expect(shouldShowBottomTabs("reading", false)).toBe(true);
    expect(shouldShowBottomTabs("settings", false)).toBe(true);
  });
});
