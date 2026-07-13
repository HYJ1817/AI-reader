import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { shouldShowBottomTabs } from "./navigationVisibility";

const navigationSource = readFileSync(
  new URL("../app/AppNavigation.tsx", import.meta.url),
  "utf8"
);
const css = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);

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

  it("mounts the batch command bar through Motion presence", () => {
    expect(navigationSource).toContain("AnimatePresence");
    expect(navigationSource).toContain("<m.div");
    expect(navigationSource).toContain("MOTION_DURATION.state");
    expect(css).not.toContain("batchBarEnter");
  });
});
