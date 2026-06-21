import { describe, expect, it } from "vitest";
import { shouldShowBottomTabs } from "./navigationVisibility";

describe("shouldShowBottomTabs", () => {
  it("hides the bottom tabs while a book is open in reading", () => {
    expect(shouldShowBottomTabs("reading", true)).toBe(false);
  });

  it("shows the bottom tabs on the main library, reading dashboard, and settings tabs", () => {
    expect(shouldShowBottomTabs("library", false)).toBe(true);
    expect(shouldShowBottomTabs("reading", false)).toBe(true);
    expect(shouldShowBottomTabs("settings", false)).toBe(true);
  });
});
