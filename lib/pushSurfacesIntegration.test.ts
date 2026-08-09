import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function optionalSource(path: string): string {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const registrySource = optionalSource("../app/AppPushSurfaces.tsx");
const stackSource = optionalSource("../app/NavigationStack.tsx");
const pageSource = optionalSource("../app/page.tsx");
const stylesSource = optionalSource("../app/page.module.css");
const globalsSource = optionalSource("../app/globals.css");
const sheetSource = optionalSource("../app/MotionSheet.tsx");
const readerSource = optionalSource("../app/ReadingSession.tsx");
const epubSource = optionalSource("../app/EpubReader.tsx");
const appNavigationSource = optionalSource("./appNavigation.ts");
const navigationHistorySource = optionalSource("./navigationHistory.ts");
const overlaysSource = optionalSource("../app/AppOverlays.tsx");
const bookActionSource = overlaysSource;
const navigationTabsSource = optionalSource("./navigationMotion.ts");
const rootNavigationSource = optionalSource("../app/AppNavigation.tsx");

describe("pushed application surfaces", () => {
  it.each([
    ["collections", "LibraryCollectionsSurface"],
    ["ai-providers", "AiSettingsSurface"],
    ["ai-provider-configure", "AiSettingsSurface"],
    ["custom-background", "CustomBackgroundSettingsSurface"],
  ])("maps %s to %s", (route, component) => {
    expect(registrySource).toContain(`case "${route}"`);
    expect(registrySource).toContain(`<${component}`);
  });

  it("renders push entries with interruptible Motion presence", () => {
    expect(stackSource).toContain("AnimatePresence");
    expect(stackSource).toContain('x: "100%"');
    expect(stackSource).toContain('"-30%"');
    expect(stackSource).toContain("pushDepthOverlay");
    expect(stackSource).not.toContain("brightness(0.94)");
    expect(stackSource).toContain("useAppReducedMotion");
    expect(stackSource).toContain("styles.rootParallaxLayer");
  });

  it("arbitrates edge back without stealing reader or sheet gestures", () => {
    expect(stackSource).toContain("useMotionValue");
    expect(stackSource).toContain("useTransform");
    expect(stackSource).toContain("canStartEdgeBack");
    expect(stackSource).toContain("shouldCompleteEdgeBack");
    expect(stackSource).toContain("deltaX <= 12");
    expect(stackSource).toContain("absX <= absY * 1.25");
    expect(sheetSource).toContain('data-navigation-gesture-owner="sheet"');
    expect(readerSource).toContain('data-navigation-gesture-owner="reader"');
    expect(epubSource).toContain('data-navigation-gesture-owner="reader"');
    expect(stylesSource).toMatch(
      /\.pushSurface\s*\{[^}]*touch-action:\s*pan-y;/s
    );
    expect(stylesSource).toMatch(
      /\.edgeBackGestureRegion\s*\{[^}]*touch-action:\s*none;/s
    );
    expect(globalsSource).toMatch(
      /html,\s*body\s*\{[^}]*overscroll-behavior-x:\s*none;/s
    );
  });

  it("drives all subviews from typed navigation commands", () => {
    for (const route of [
      "collections",
      "ai-providers",
      "ai-provider-configure",
      "custom-background",
    ]) {
      expect(pageSource).toContain(`navigation.push("${route}"`);
    }
    expect(pageSource).not.toContain("libraryScreen");
    expect(pageSource).not.toContain("aiSettingsSheetOpen");
  });

  it("keeps compact provider navigation and long metadata inside the viewport", () => {
    expect(stylesSource).toMatch(
      /\.providerNavButton\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/s
    );
    expect(stylesSource).toMatch(
      /\.providerChoiceText small\s*\{[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/s
    );
  });

  it("registers the reading workspace as a book-owned sheet", () => {
    expect(appNavigationSource).toContain('"reading-workspace"');
    expect(navigationHistorySource).toContain('"reading-workspace"');
    expect(overlaysSource).toContain("ReadingWorkspaceSheet");
    expect(overlaysSource).toContain('case "reading-workspace"');
    expect(bookActionSource).toContain("UI_TEXT.READING_WORKSPACE");
    expect(bookActionSource).toContain("openReadingWorkspace");
  });

  it("keeps the workspace out of the three root tabs", () => {
    expect(navigationTabsSource).toMatch(
      /"library",\s*"reading",\s*"settings",/
    );
    expect(navigationTabsSource).not.toContain('"workspace"');
    expect(rootNavigationSource.match(/data-navigation-tab=/g)).toHaveLength(3);
  });
});
