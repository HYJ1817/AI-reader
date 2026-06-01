import { describe, expect, it } from "vitest";
import { shouldShowBottomTabs } from "./navigationVisibility";

describe("shouldShowBottomTabs", () => {
  it("keeps the bottom tabs visible while a book is open in reading", () => {
    expect(shouldShowBottomTabs("reading", true)).toBe(true);
  });

  it("shows the bottom tabs on the main library and settings tabs", () => {
    expect(shouldShowBottomTabs("library", false)).toBe(true);
    expect(shouldShowBottomTabs("settings", false)).toBe(true);
  });
});
