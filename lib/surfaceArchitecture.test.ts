import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8"
);

describe("surface architecture", () => {
  it("renders focused application surfaces from Home", () => {
    for (const component of [
      "LibrarySurface",
      "ReadingDashboard",
      "SettingsSurface",
      "AppOverlays",
    ]) {
      expect(
        pageSource.includes(`<${component}`),
        `Home should render <${component}`
      ).toBe(true);
    }
  });

  it("keeps large surface markup out of the orchestration page", () => {
    for (const styleReference of [
      "styles.collectionList",
      "styles.readingGoalCard",
      "styles.settingsNativeList",
      "styles.bookActionHero",
    ]) {
      expect(
        pageSource.includes(styleReference),
        `Home should not contain ${styleReference}`
      ).toBe(false);
    }
  });
});
