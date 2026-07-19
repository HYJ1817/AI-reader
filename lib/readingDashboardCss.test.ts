import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);
const globals = readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8"
);
const source = readFileSync(
  new URL("../app/ReadingDashboard.tsx", import.meta.url),
  "utf8"
);
const animatedNumberUrl = new URL(
  "../app/AnimatedNumber.tsx",
  import.meta.url
);
const animatedNumberSource = existsSync(animatedNumberUrl)
  ? readFileSync(animatedNumberUrl, "utf8")
  : "";

function rule(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  const end = css.indexOf("}", start);
  return css.slice(start, end);
}

describe("reading dashboard composition", () => {
  it("puts the state-aware reading action before optional progress surfaces", () => {
    expect(source).toContain(
      "buildReadingDashboardPresentation"
    );
    expect(source).toContain(
      "data-reading-dashboard-state={presentation.state}"
    );
    expect(source).toContain('data-reading-primary="true"');
    expect(source).toContain('data-reading-goal="true"');
    expect(source).toContain('data-reading-week="true"');
    expect(source).toContain("presentation.showGoal &&");
    expect(source).toContain("presentation.showWeek &&");
    expect(source).toContain("presentation.showProgress ?");

    const primaryIndex = source.indexOf('data-reading-primary="true"');
    const goalIndex = source.indexOf('data-reading-goal="true"');
    const weekIndex = source.indexOf('data-reading-week="true"');
    expect(primaryIndex).toBeGreaterThan(0);
    expect(goalIndex).toBeGreaterThan(primaryIndex);
    expect(weekIndex).toBeGreaterThan(goalIndex);
    expect(source).not.toContain("formatBookSize");
  });

  it("keeps the secondary goal row compact and the empty state open", () => {
    const ringRule = rule(".dashboardGoalRing");
    const emptyRule = rule(".readingEmptyState");

    expect(ringRule).toContain("width: 64px");
    expect(ringRule).toContain("height: 64px");
    expect(emptyRule).toContain("text-align: center");
    expect(emptyRule).not.toContain("box-shadow");
    expect(emptyRule).not.toContain("border:");
  });

  it("renders a theme-aware U-shaped reading goal ring", () => {
    expect(source).toContain('className={styles.dashboardGoalRingSvg}');
    expect(source).toContain('className={styles.dashboardGoalArcBase}');
    expect(source).toContain('className={styles.dashboardGoalArcProgress}');
    expect(source).toContain('pathLength="100"');
    expect(source).toContain("goalPercent");
    expect(source).not.toContain("goalRingBackground");

    for (const token of [
      "--goal-ring-surface",
      "--goal-ring-border",
      "--goal-ring-arc",
      "--goal-ring-progress",
      "--goal-ring-target",
    ]) {
      expect(globals).toContain(token);
    }
    expect(globals).toMatch(
      /\[data-reader-theme="dark"\][^{]*\{[^}]*--goal-ring-surface:\s*#1c1c1e/s
    );

    const ringRule = rule(".dashboardGoalRing");
    expect(ringRule).toContain("width: 64px");
    expect(ringRule).toContain("height: 64px");
    expect(ringRule).toContain("var(--goal-ring-surface)");
    expect(rule(".dashboardGoalArcBase")).toContain("stroke-linecap: round");
    expect(rule(".dashboardGoalArcProgress")).toContain(
      "stroke-dasharray"
    );
  });

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

  it("animates reading values and bars only when their data changes", () => {
    expect(source).toContain('import AnimatedNumber from "@/app/AnimatedNumber"');
    expect(source).toContain("<AnimatedNumber value={todayMinutes}");
    expect(source).toContain("<AnimatedNumber value={totalMinutes}");
    expect(animatedNumberSource).toContain("key={value}");
    expect(animatedNumberSource).toContain('fontVariantNumeric: "tabular-nums"');
    expect(source).toContain('key={`${day.date}:${day.minutes}`}');
    expect(source).toContain("scaleY:");

    const dayRule = rule(".weekBars > div");
    expect(dayRule).toContain("transform: translate3d(0, 0, 0)");
    expect(dayRule).toMatch(/transition:[^}]*transform/s);

    const fillRule = rule(".weekBarTrack span");
    expect(fillRule).toContain("transform-origin: bottom");
    expect(fillRule).not.toContain("animation:");
    expect(css).not.toContain("@keyframes weekBarIn");

    const todayTrackRule = rule(".weekBarToday .weekBarTrack");
    expect(todayTrackRule).toMatch(/transition:[^}]*box-shadow[^}]*transform/s);
    expect(todayTrackRule).toContain("translate3d(0, -2px, 0)");

    const todayLabelRule = rule(".weekBarToday small");
    expect(todayLabelRule).toMatch(/transition:[^}]*color[^}]*transform/s);
    expect(todayLabelRule).toContain("translate3d(0, -1px, 0)");

    expect(source).toContain("useAppReducedMotion");
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

  it("gives the continue reading card layered press affordances", () => {
    const progressFillRule = rule(".libraryProgressTrack span");
    expect(progressFillRule).toContain("transform: translate3d(0, 0, 0) scaleX(1)");
    expect(progressFillRule).toContain("transform-origin: left center");
    expect(progressFillRule).toMatch(/transition:[^}]*width[^}]*transform/s);

    expect(css).toMatch(
      /\.featureBookCard \.bookCover\s*\{[\s\S]*?transform:\s*translate3d\(0, 0, 0\) scale\(1\);[\s\S]*?transition:[\s\S]*?transform var\(--motion-fast\)/s
    );
    expect(css).toMatch(
      /\.featureBookCard:active \.bookCover\s*\{[\s\S]*?transform:\s*translate3d\(0, 1px, 0\) scale\(0\.97\);/s
    );
    expect(css).toMatch(
      /\.featureBookCard:active \.continueChevron\s*\{[\s\S]*?transform:\s*translate3d\(2px, 1px, 0\);/s
    );
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.featureBookCard \.bookCover,[\s\S]*?\.featureBookCard:active \.bookCover,[\s\S]*?\.libraryProgressTrack span,[\s\S]*?\.featureBookCard:active \.continueChevron\s*\{[\s\S]*?transition:\s*none;[\s\S]*?transform:\s*none;/s
    );
  });
});
