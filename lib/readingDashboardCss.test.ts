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
    expect(rule(".readingDashboardSection")).toContain("var(--separator)");
  });

  it("gives week bars a calm data-state motion hierarchy", () => {
    const dayRule = rule(".weekBars > div");
    expect(dayRule).toContain("transform: translate3d(0, 0, 0)");
    expect(dayRule).toMatch(/transition:[^}]*transform/s);

    const fillRule = rule(".weekBarTrack span");
    expect(fillRule).toContain("transform-origin: bottom");
    expect(fillRule).toMatch(/animation:\s*weekBarIn\s+var\(--motion-standard\)/);

    expect(css).toMatch(
      /@keyframes\s+weekBarIn\s*\{[\s\S]*?from\s*\{[\s\S]*?opacity:\s*0;[\s\S]*?scaleY\(0\.7\)[\s\S]*?to\s*\{[\s\S]*?opacity:\s*1;[\s\S]*?scaleY\(1\)/s
    );

    const todayTrackRule = rule(".weekBarToday .weekBarTrack");
    expect(todayTrackRule).toMatch(/transition:[^}]*box-shadow[^}]*transform/s);
    expect(todayTrackRule).toContain("translate3d(0, -2px, 0)");

    const todayLabelRule = rule(".weekBarToday small");
    expect(todayLabelRule).toMatch(/transition:[^}]*color[^}]*transform/s);
    expect(todayLabelRule).toContain("translate3d(0, -1px, 0)");

    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.weekBars > div,[\s\S]*?\.weekBarTrack span,[\s\S]*?\.weekBarToday \.weekBarTrack,[\s\S]*?\.weekBarToday small\s*\{[\s\S]*?animation:\s*none;[\s\S]*?transition:\s*none;[\s\S]*?transform:\s*none;/s
    );
  });

  it("gives the reading goal card layered press affordances", () => {
    const ringRule = rule(".dashboardGoalRing");
    expect(ringRule).toContain("transform: translate3d(0, 0, 0) scale(1)");
    expect(ringRule).toMatch(/transition:[^}]*transform/s);

    const chevronRule = rule(".continueChevron");
    expect(chevronRule).toContain("transform: translate3d(0, 0, 0)");
    expect(chevronRule).toMatch(/transition:[^}]*color[^}]*transform/s);

    expect(css).toMatch(
      /\.readingGoalCard:active \.dashboardGoalRing\s*\{[\s\S]*?transform:\s*translate3d\(0, 1px, 0\) scale\(0\.96\);/s
    );
    expect(css).toMatch(
      /\.readingGoalCard:active \.continueChevron\s*\{[\s\S]*?transform:\s*translate3d\(2px, 1px, 0\);/s
    );
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.dashboardGoalRing,[\s\S]*?\.continueChevron,[\s\S]*?\.readingGoalCard:active \.dashboardGoalRing,[\s\S]*?\.readingGoalCard:active \.continueChevron\s*\{[\s\S]*?transition:\s*none;[\s\S]*?transform:\s*none;/s
    );
  });
});
