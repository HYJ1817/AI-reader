import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const globals = readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8"
);
const moduleCss = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);

const semanticTokens = [
  "--app-bg",
  "--surface-primary",
  "--surface-secondary",
  "--text-primary",
  "--text-secondary",
  "--text-tertiary",
  "--text-placeholder",
  "--text-disabled",
  "--icon-tertiary",
  "--separator",
  "--tint",
  "--control-fill",
  "--overlay-fill",
  "--sheet-fill",
  "--reader-control-surface",
  "--reader-control-surface-raised",
  "--reader-control-fill",
  "--reader-control-text",
  "--reader-control-muted",
  "--reader-control-border",
];

function rule(selector: string): string {
  const start = moduleCss.indexOf(`${selector} {`);
  const end = moduleCss.indexOf("}", start);
  return moduleCss.slice(start, end);
}

describe("semantic visual tokens", () => {
  it("defines the full token set for root and reader themes", () => {
    for (const token of semanticTokens) {
      expect(
        globals.match(new RegExp(`${token}:`, "g"))?.length
      ).toBeGreaterThanOrEqual(4);
    }
  });

  it("keeps meaningful tertiary text AA-readable on every theme surface", () => {
    for (const declaration of [
      "--text-tertiary: #707075",
      "--text-tertiary: #a1a1a6",
      "--text-tertiary: #756750",
    ]) {
      expect(globals).toContain(declaration);
    }
    expect(globals).toContain("@media (prefers-contrast: more)");
  });

  it("does not keep the retired iOS token alias layer", () => {
    expect(globals).not.toContain("--ios-");
    expect(moduleCss).not.toContain("--ios-");
  });

  it("keeps ordinary reading dashboard styles free of liquid glass", () => {
    for (const selector of [
      ".readingGoalCard",
      ".featureBookCard",
      ".readingWeekCard",
    ]) {
      const start = moduleCss.indexOf(`${selector} {`);
      const end = moduleCss.indexOf("}", start);
      const rule = moduleCss.slice(start, end);
      expect(rule).not.toContain("liquid-glass");
      expect(rule).not.toContain("backdrop-filter");
    }
  });

  it("uses semantic tokens directly on ordinary content surfaces", () => {
    for (const selector of [
      ".app",
      ".settingsSectionTitle",
      ".settingsNativeList",
      ".collectionEntryRow",
      ".collectionList",
      ".collectionRow",
      ".readingDashboardSection",
      ".dashboardGoalRing",
      ".featureBookCard",
      ".weekBarTrack",
    ]) {
      expect(rule(selector), `${selector} should exist`).not.toBe("");
      expect(rule(selector), `${selector} should not use iOS aliases`).not.toContain(
        "--ios-"
      );
    }
  });

  it("removes unused legacy dashboard card styles", () => {
    for (const selector of [
      ".libraryOverviewPanel",
      ".continueHeroCard",
      ".recentShelf",
      ".shelfCoverFrame",
      ".libraryStats",
    ]) {
      expect(moduleCss).not.toContain(`${selector} {`);
    }
  });
});
