import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8"
);

describe("surface architecture", () => {
  it.each([
    "LibrarySurface",
    "ReadingDashboard",
    "SettingsSurface",
    "AppNavigation",
    "AppPushSurfaces",
    "ReadingSession",
    "AppOverlays",
  ])("renders <%s> from Home", (component) => {
    expect(
      pageSource.includes(`<${component}`),
      `Home should render <${component}>`
    ).toBe(true);
  });

  it.each([
    "styles.collectionList",
    "styles.readingGoalCard",
    "styles.settingsNativeList",
    "styles.tabIndicator",
    "styles.readerShell",
    "styles.bookActionHero",
  ])("keeps %s out of the orchestration page", (styleReference) => {
    expect(
      pageSource.includes(styleReference),
      `Home should not contain ${styleReference}`
    ).toBe(false);
  });

  it.each([
    "ReaderSettingsPanel",
    "TocDrawer",
    "AiSettingsSheet",
    "ReadingGoalSheet",
    "BottomSheet",
  ])("keeps <%s> inside AppOverlays", (component) => {
    expect(
      pageSource.includes(`<${component}`),
      `Home should not render <${component}> directly`
    ).toBe(false);
  });

  it("keeps Home within the orchestration size target", () => {
    expect(pageSource.trimEnd().split(/\r?\n/).length).toBeLessThanOrEqual(1935);
  });
});
