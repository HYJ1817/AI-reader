import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8"
);

describe("persistent app surfaces", () => {
  it("keeps all primary tabs mounted while switching", () => {
    expect(pageSource).not.toContain('{activeTab === "reading" && !openBook && (');
    expect(pageSource).not.toContain('{activeTab === "settings" && (');

    for (const [component, tab] of [
      ["LibrarySurface", "library"],
      ["ReadingDashboard", "reading"],
      ["SettingsSurface", "settings"],
    ] as const) {
      const navigationClass = `getNavigationSurfaceClass("${tab}")`;
      const componentInvocation =
        pageSource.match(new RegExp(`<${component}\\b[\\s\\S]*?\\/>`))?.[0] ?? "";

      expect(pageSource).toContain(navigationClass);
      expect(
        componentInvocation.includes(`<${component}`),
        `Home should keep <${component}> mounted`
      ).toBe(true);
      expect(
        componentInvocation.includes("className={") &&
          componentInvocation.includes(navigationClass),
        `<${component} should use ${navigationClass} in className`
      ).toBe(true);
    }
  });

  it("renders one shared bottom-tab indicator", () => {
    expect(pageSource).toContain("styles.tabIndicator");
    expect(pageSource).toContain('"--tab-index": getNavigationTabIndex(activeTab)');
  });
});
