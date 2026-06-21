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
    "styles.bookActionHero",
  ])("keeps %s out of the orchestration page", (styleReference) => {
    expect(
      pageSource.includes(styleReference),
      `Home should not contain ${styleReference}`
    ).toBe(false);
  });
});
