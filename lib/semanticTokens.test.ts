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
  "--separator",
  "--tint",
  "--control-fill",
  "--overlay-fill",
  "--sheet-fill",
];

describe("semantic visual tokens", () => {
  it("defines the full token set for root and reader themes", () => {
    for (const token of semanticTokens) {
      expect(
        globals.match(new RegExp(`${token}:`, "g"))?.length
      ).toBeGreaterThanOrEqual(4);
    }
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
});
