import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const navigationSource = readFileSync(
  new URL("../app/AppNavigation.tsx", import.meta.url),
  "utf8"
);
const css = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);

function cssRule(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  const end = css.indexOf("}", start);
  return start < 0 || end < 0 ? "" : css.slice(start, end);
}

describe("compact root chrome", () => {
  it("uses one safe-area-aware dimension contract", () => {
    const appRule = cssRule(".app");
    const surfaceRule = cssRule(".appSurface");
    const barRule = cssRule(".tabBar");
    const batchRule = cssRule(".libraryBatchBar");

    expect(appRule).toContain("--root-tab-height: 60px");
    expect(appRule).toContain("--root-tab-offset: 8px");
    expect(surfaceRule).toContain("var(--root-tab-height)");
    expect(surfaceRule).toContain("var(--root-tab-offset)");
    expect(surfaceRule).toContain("var(--safe-bottom)");
    expect(barRule).toContain("bottom: calc(var(--safe-bottom) + var(--root-tab-offset))");
    expect(barRule).toContain("height: var(--root-tab-height)");
    expect(batchRule).toContain("var(--root-tab-height)");
    expect(batchRule).toContain("var(--root-tab-offset)");
  });

  it("reduces title and navigation scale without shrinking targets", () => {
    const titleRule = cssRule(".libraryTitle");
    const actionRule = cssRule(".libraryActionButton");
    const textActionRule = cssRule(".libraryTextButton");
    const tabRule = cssRule(".tab");
    const iconRule = cssRule(".tabIcon");
    const labelRule = cssRule(".tabLabel");

    expect(titleRule).toContain("font-size: 34px");
    expect(titleRule).toContain("font-weight: 750");
    expect(titleRule).toContain("line-height: 1.1");
    expect(actionRule).toContain("min-height: 44px");
    expect(textActionRule).toContain("min-height: 44px");
    expect(tabRule).toContain("min-height: 44px");
    expect(iconRule).toContain("width: 24px");
    expect(iconRule).toContain("height: 24px");
    expect(labelRule).toContain("font-size: 11px");
  });

  it("uses one quiet surface and a small moving line instead of nested capsules", () => {
    const barRule = cssRule(".tabBar");
    const glintRule = cssRule(".tabBar::before");
    const trackRule = cssRule(".tabIndicator");
    const lineRule = cssRule(".tabIndicator::after");
    const activeRule = cssRule(".activeTab");

    expect(barRule).toContain("border-radius: 22px");
    expect(barRule).toContain("0 2px 8px rgba(0, 0, 0, 0.08)");
    expect(barRule).not.toContain("inset 0 1px");
    expect(glintRule).toContain("content: none");
    expect(trackRule).toContain("background: transparent");
    expect(trackRule).toContain("box-shadow: none");
    expect(lineRule).toContain("width: 24px");
    expect(lineRule).toContain("height: 2px");
    expect(lineRule).toContain("background: var(--tint)");
    expect(activeRule).toContain("color: var(--tint)");
  });

  it("exposes the active destination semantically without changing handlers", () => {
    expect(navigationSource).toContain('aria-label="主要导航"');
    expect(navigationSource).toContain(
      'aria-current={activeTab === "library" ? "page" : undefined}'
    );
    expect(navigationSource).toContain(
      'aria-current={activeTab === "reading" ? "page" : undefined}'
    );
    expect(navigationSource).toContain(
      'aria-current={activeTab === "settings" ? "page" : undefined}'
    );
    expect(navigationSource).toContain("onClick={onOpenLibrary}");
    expect(navigationSource).toContain("onClick={onOpenReading}");
    expect(navigationSource).toContain("onClick={onOpenSettings}");
    expect(navigationSource).toContain('layoutId="root-tab-indicator"');
  });
});

