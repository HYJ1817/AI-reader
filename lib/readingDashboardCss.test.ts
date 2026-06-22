import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);

function rule(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  const end = css.indexOf("}", start);
  return css.slice(start, end);
}

describe("reading dashboard composition", () => {
  it("uses unframed content sections", () => {
    for (const selector of [
      ".readingGoalCard",
      ".featureBookCard",
      ".readingWeekCard",
    ]) {
      expect(rule(selector)).not.toContain("linear-gradient");
      expect(rule(selector)).not.toContain("box-shadow");
      expect(rule(selector)).not.toContain("border-radius: 20px");
    }
  });

  it("keeps section separation through hairlines", () => {
    expect(css).toContain(".readingDashboardSection");
    expect(css).toContain("var(--ios-separator)");
  });
});
