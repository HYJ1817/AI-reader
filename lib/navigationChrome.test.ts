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
const globalsCss = readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8"
);

function cssRule(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  const end = css.indexOf("}", start);
  return start < 0 || end < 0 ? "" : css.slice(start, end);
}

function globalRule(selector: string): string {
  const start = globalsCss.indexOf(`${selector} {`);
  const end = globalsCss.indexOf("}", start);
  return start < 0 || end < 0 ? "" : globalsCss.slice(start, end);
}

function cssBlock(source: string, start: number): string {
  const open = source.indexOf("{", start);
  if (start < 0 || open < 0) return "";

  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  return "";
}

function nestedGlobalRule(container: string, selector: string): string {
  const containerStart = globalsCss.indexOf(`${container} {`);
  const containerBlock = cssBlock(globalsCss, containerStart);
  const selectorStart = containerBlock.indexOf(`${selector} {`);
  return cssBlock(containerBlock, selectorStart);
}

describe("compact root chrome", () => {
  it("uses one safe-area-aware dimension contract", () => {
    const appRule = cssRule(".app");
    const surfaceRule = cssRule(".appSurface");
    const barRule = cssRule(".tabBar");
    const batchRule = cssRule(".libraryBatchBar");

    expect(appRule).toContain("--root-tab-height: 76px");
    expect(appRule).toContain("--root-tab-offset: 8px");
    expect(surfaceRule).toContain("var(--root-tab-height)");
    expect(surfaceRule).toContain("var(--root-tab-offset)");
    expect(surfaceRule).toContain("var(--safe-bottom)");
    expect(barRule).toContain("bottom: calc(var(--safe-bottom) + var(--root-tab-offset))");
    expect(barRule).toContain("height: var(--root-tab-height)");
    expect(barRule).toContain("width: min(302px, calc(100vw - 32px))");
    expect(barRule).toContain("left: 50%");
    expect(barRule).toContain("right: auto");
    expect(barRule).toContain("transform: translate3d(-50%, 0, 0)");
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

    expect(titleRule).toContain("font-size: var(--type-title)");
    expect(titleRule).toContain("font-weight: 750");
    expect(titleRule).toContain("line-height: 1.1");
    expect(actionRule).toContain("min-height: 44px");
    expect(textActionRule).toContain("min-height: 44px");
    expect(tabRule).toContain("min-height: 44px");
    expect(iconRule).toContain("width: 21px");
    expect(iconRule).toContain("height: 21px");
    expect(labelRule).toContain("font-size: var(--type-caption)");
  });

  it("uses a theme-aware frosted pill with a violet active backing", () => {
    const barRule = cssRule(".tabBar");
    const indicatorRule = cssRule(".tabIndicator");
    const backingRule = cssRule(".tabIndicator::after");
    const solidIconRule = cssRule(".tabIconSolid");

    expect(barRule).toContain("border-radius: 33px");
    expect(barRule).toContain("padding: 3px 16px 5px");
    expect(barRule).toContain("background: var(--root-tab-fill)");
    expect(barRule).toContain("backdrop-filter: blur(14px) saturate(112%)");
    expect(barRule).toContain("border: 0.5px solid var(--root-tab-border)");
    expect(barRule).toContain("box-shadow: var(--root-tab-shadow)");
    expect(indicatorRule).toContain("width: calc((100% - 32px) / 3)");
    expect(indicatorRule).toContain("height: 31px");
    expect(backingRule).toContain("width: 31px");
    expect(backingRule).toContain("height: 31px");
    expect(backingRule).toContain("border-radius: 10px");
    expect(backingRule).toContain("background: var(--root-tab-accent)");
    expect(backingRule).not.toContain("height: 2px");
    expect(solidIconRule).toContain("fill: currentColor");
  });

  it("defines theme-specific root-tab material and content tokens", () => {
    const rootRule = globalRule(":root");
    const lightRule = globalRule('[data-reader-theme="light"]');
    const sepiaRule = globalRule('[data-reader-theme="sepia"]');
    const darkRule = globalRule('[data-reader-theme="dark"]');

    for (const rule of [rootRule, lightRule, sepiaRule, darkRule]) {
      expect(rule).toContain("--root-tab-fill:");
      expect(rule).toContain("--root-tab-border:");
      expect(rule).toContain("--root-tab-shadow:");
      expect(rule).toContain("--root-tab-content:");
    }
    expect(rootRule).toContain("--root-tab-accent: #7d55e7");
    expect(rootRule).toContain("--root-tab-active-icon: #ffffff");
    expect(sepiaRule).toContain("--root-tab-content: #776953");
  });

  it("uses the dark navigation material for the system dark scheme", () => {
    const systemDarkRule = nestedGlobalRule(
      "@media (prefers-color-scheme: dark)",
      ":root"
    );

    expect(systemDarkRule).toContain(
      "--root-tab-fill: rgba(44, 44, 46, 0.72)"
    );
    expect(systemDarkRule).toContain(
      "--root-tab-border: rgba(255, 255, 255, 0.1)"
    );
    expect(systemDarkRule).toContain(
      "--root-tab-shadow: 0 3px 8px rgba(0, 0, 0, 0.24)"
    );
    expect(systemDarkRule).toContain("--root-tab-content: #aeaeb2");
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
    expect(navigationSource).toContain("ROOT_TAB_TRANSITION");
    expect(navigationSource).toContain('data-root-tab-indicator="true"');
    expect(navigationSource).toContain('data-root-tab-gear="true"');
    expect(navigationSource).toContain('fillRule="evenodd"');
    expect(navigationSource).toContain('clipRule="evenodd"');
    expect(navigationSource).toContain("styles.tabIconSolid");
    expect(navigationSource).not.toContain("MOTION_SPRING.navigation");
  });
});
