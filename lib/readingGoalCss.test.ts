import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);

describe("reading goal fullscreen CSS", () => {
  it("uses the modal layer and viewport-safe full screen layout", () => {
    expect(css).toMatch(
      /\.goalOverlay\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?inset:\s*0;[\s\S]*?z-index:\s*100;/
    );
    expect(css).toMatch(
      /\.goalScreen\s*\{[\s\S]*?var\(--safe-top\)[\s\S]*?var\(--safe-bottom\)/
    );
    expect(css).toMatch(
      /\.goalCloseButton\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;[\s\S]*?border-radius:\s*50%;/
    );
  });

  it("defines stable arc and wheel geometry", () => {
    expect(css).toMatch(
      /\.goalArcWrap\s*\{[\s\S]*?width:\s*min\(100%,\s*320px\);[\s\S]*?height:\s*205px;/
    );
    expect(css).toContain(".goalWheelBand");
    expect(css).toContain(".goalWheelRows");
    expect(css).toContain(".goalWheelRowSelected");
    expect(css).toContain(".goalWheelRowNeighbor");
    expect(css).toContain(".goalWheelRowEdge");
    expect(css).toMatch(/\.goalWheel\s*\{[\s\S]*?touch-action:\s*none;/);
  });

  it("adapts short screens and reduced motion", () => {
    expect(css).toContain("@media (max-height: 760px)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.goalOverlay[\s\S]*?animation:\s*none;/
    );
  });

  it("keeps all five wheel rows visible on short screens", () => {
    const shortScreenRules =
      css.match(
        /@media \(max-height: 760px\)\s*\{([\s\S]*?)\n\}\n\n@media \(prefers-reduced-motion/
      )?.[1] ?? "";
    expect(shortScreenRules).not.toContain("height: 150px");
  });

  it("removes obsolete bottom-sheet goal styles", () => {
    expect(css).not.toContain(".goalSheet {");
    expect(css).not.toContain(".goalContinueButton");
    expect(css).not.toContain(".goalRangeInput");
  });

  it("uses theme tokens for the fullscreen surface", () => {
    expect(css).toMatch(
      /\.goalOverlay\s*\{[\s\S]*?background:\s*var\(--app-bg\);/
    );
    expect(css).not.toMatch(
      /\.goalOverlay\s*\{[\s\S]*?background:\s*(?:#fff|#ffffff|white);/
    );
  });
});
