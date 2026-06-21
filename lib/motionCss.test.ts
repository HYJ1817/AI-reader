import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);

describe("motion CSS", () => {
  it("uses an explicit project easing curve for timed transitions", () => {
    const declarations = css.match(/transition:\s*[^;]+;/g) ?? [];
    const uncurved = declarations.filter((declaration) => {
      if (declaration.includes("none")) return false;
      if (!/(?:\d+ms|0?\.\d+s)/.test(declaration)) return false;
      return !declaration.includes("var(--ease-");
    });

    expect(uncurved).toEqual([]);
  });

  it("does not use bounce, elastic, or positive-duration linear motion", () => {
    expect(css).not.toMatch(/cubic-bezier\([^)]*(?:-\d|1\.\d)/);
    const motionDeclarations =
      css.match(/(?:transition|animation):\s*[^;]+;/g) ?? [];
    const positiveLinear = motionDeclarations.filter((declaration) =>
      declaration.replaceAll("0s linear", "").match(/\blinear\b/)
    );
    expect(positiveLinear).toEqual([]);
  });

  it("uses a restrained horizontal push for the persistent reader session", () => {
    expect(css).toMatch(
      /\.readerSessionInactive\s*\{[^}]*transform:\s*translate3d\(18px,\s*0,\s*0\)/s
    );
    expect(css).toMatch(
      /\.readerShell\s*\{[^}]*transition:[^}]*transform\s+220ms\s+var\(--ease-emphasized\)/s
    );
  });

  it("keeps the moving sheet shadow within a restrained paint budget", () => {
    expect(css).toContain("--shadow-sheet: 0 -8px 18px rgba(0, 0, 0, 0.16);");
  });

  it("uses persistent tab surfaces instead of display switching or mount fades", () => {
    expect(css).not.toContain(".tabPageInactive");
    expect(css).not.toContain("@keyframes pageFadeIn");
    expect(css).toMatch(
      /\.appSurface\s*\{[^}]*transition:[^}]*opacity[^}]*transform/s
    );
    expect(css).toMatch(
      /\.appSurfaceBefore\s*\{[^}]*translate3d\(-8px,\s*0,\s*0\)/s
    );
    expect(css).toMatch(
      /\.appSurfaceAfter\s*\{[^}]*translate3d\(8px,\s*0,\s*0\)/s
    );
  });

  it("moves one shared tab indicator with a compositor transform", () => {
    expect(css).toMatch(
      /\.tabIndicator\s*\{[^}]*transform:\s*translate3d\(calc\(var\(--tab-index\)\s*\*\s*100%\),\s*0,\s*0\)/s
    );
    const activeStart = css.indexOf(".activeTab {");
    const activeEnd = css.indexOf("}", activeStart);
    const activeRule = css.slice(activeStart, activeEnd);
    expect(activeRule).not.toContain("background:");
    expect(activeRule).not.toContain("box-shadow:");
  });

  it("keeps the library import action free of moving blur and shadow", () => {
    const start = css.indexOf(".libraryActionButton {");
    const end = css.indexOf("}", start);
    const rule = css.slice(start, end);
    expect(rule).not.toContain("backdrop-filter");
    expect(rule).not.toContain("box-shadow");
  });

  it("keeps a dismissing sheet available for an interrupting drag", () => {
    const start = css.indexOf(".motionSheetClosing {");
    const end = css.indexOf("}", start);
    const rule = css.slice(start, end);
    expect(rule).not.toContain("pointer-events: none");
  });

  it("does not move multiple live backdrop-filter layers with reader chrome", () => {
    for (const selector of [
      ".readerOverlayClose {",
      ".readerTopHint {",
      ".readerPageBadge {",
      ".readerCornerMenuButton {",
    ]) {
      const start = css.indexOf(selector);
      const end = css.indexOf("}", start);
      const rule = css.slice(start, end);
      expect(rule).not.toContain("backdrop-filter");
    }
  });

  it("keeps reader chrome travel within eight pixels", () => {
    const start = css.indexOf(".readerActionPanel {");
    const end = css.indexOf("}", start);
    const rule = css.slice(start, end);
    expect(rule).toContain("translateY(8px)");

    const hiddenStart = css.indexOf(
      ".readerChromeControlsHidden .readerActionPanel {"
    );
    const hiddenEnd = css.indexOf("}", hiddenStart);
    const hiddenRule = css.slice(hiddenStart, hiddenEnd);
    expect(hiddenRule).toContain("translateY(8px)");
  });
});
