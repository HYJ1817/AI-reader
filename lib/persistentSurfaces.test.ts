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
    expect(pageSource).toContain('getNavigationSurfaceClass("library")');
    expect(pageSource).toContain('getNavigationSurfaceClass("reading")');
    expect(pageSource).toContain('getNavigationSurfaceClass("settings")');
  });

  it("renders one shared bottom-tab indicator", () => {
    expect(pageSource).toContain("styles.tabIndicator");
    expect(pageSource).toContain('"--tab-index": getNavigationTabIndex(activeTab)');
  });
});
