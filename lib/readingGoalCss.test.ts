import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);
const source = readFileSync(
  new URL("../app/ReadingGoalSheet.tsx", import.meta.url),
  "utf8"
);

describe("reading goal fullscreen CSS", () => {
  it("uses the shared sheet layer and viewport-safe full screen layout", () => {
    expect(css).toMatch(
      /\.bottomSheet\.goalMotionSheet\s*\{[\s\S]*?height:\s*100dvh;[\s\S]*?max-height:\s*100dvh;/
    );
    expect(css).toMatch(
      /\.goalScreen\s*\{[\s\S]*?var\(--safe-top\)[\s\S]*?var\(--safe-bottom\)/
    );
    expect(css).toMatch(
      /\.goalCloseButton\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;[\s\S]*?border-radius:\s*50%;/
    );
  });

  it("uses the frameless React Bits wheel geometry", () => {
    expect(css).toMatch(
      /\.goalArcWrap\s*\{[\s\S]*?width:\s*min\(100%,\s*320px\);[\s\S]*?height:\s*205px;/
    );
    expect(css).toContain(".goalWheelRows");
    expect(css).toContain(".goalWheelRow");
    expect(css).not.toContain(".goalWheelBand");
    expect(css).not.toContain(".goalWheelRowSelected");
    expect(css).not.toContain(".goalWheelRowNeighbor");
    expect(css).not.toContain(".goalWheelRowEdge");
    expect(css).toMatch(
      /\.goalWheel\s*\{[\s\S]*?height:\s*220px;[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;[\s\S]*?touch-action:\s*none;/
    );
    expect(css).toMatch(
      /\.goalWheelRow\s*\{[\s\S]*?height:\s*2\.38rem;[\s\S]*?font-size:\s*1\.7rem;/
    );
  });

  it("keeps theme tokens and avoids a permanent animation layer", () => {
    const start = css.indexOf(".goalWheelRow {");
    const end = css.indexOf("}", start);
    const rule = css.slice(start, end);

    expect(rule).toContain("color: var(--text-secondary);");
    expect(rule).not.toContain("will-change");
    expect(rule).not.toMatch(/(?:#fff(?:fff)?|#000(?:000)?)/i);
  });

  it("adapts short screens and reduced motion", () => {
    expect(css).toContain("@media (max-height: 760px)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(source).toContain("<BottomSheet");
    expect(css).not.toContain("goalOverlayIn");
    expect(css).not.toContain("goalEditorIn");
  });

  it("keeps all five wheel rows visible on short screens", () => {
    const shortScreenRules =
      css.match(
        /@media \(max-height: 760px\)\s*\{([\s\S]*?)\n\}\n\n@media \(prefers-reduced-motion/
      )?.[1] ?? "";
    expect(shortScreenRules).toMatch(
      /\.goalWheel\s*\{\s*height:\s*190px;\s*\}/
    );
  });

  it("removes obsolete bottom-sheet goal styles", () => {
    expect(css).not.toContain(".goalSheet {");
    expect(css).not.toContain(".goalContinueButton");
    expect(css).not.toContain(".goalRangeInput");
  });

  it("uses theme tokens for the fullscreen surface", () => {
    const start = css.indexOf(".bottomSheet.goalMotionSheet {");
    const end = css.indexOf("}", start);
    const rule = css.slice(start, end);
    expect(rule).toContain("background: var(--app-bg);");
    expect(rule).not.toMatch(/background:\s*(?:#fff|#ffffff|white);/);
  });
});
