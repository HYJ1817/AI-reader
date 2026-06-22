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

  it("uses one navigation timing and easing protocol", () => {
    expect(css).toContain("--motion-navigation: 210ms;");
    expect(css).toContain(
      "--ease-navigation: cubic-bezier(0.32, 0.72, 0, 1);"
    );
    expect(css).toMatch(
      /\.appSurface\s*\{[^}]*opacity\s+var\(--motion-navigation\)\s+var\(--ease-navigation\)[^}]*transform\s+var\(--motion-navigation\)\s+var\(--ease-navigation\)/s
    );
    expect(css).toMatch(
      /\.tabIndicator\s*\{[^}]*transition:\s*transform\s+var\(--motion-navigation\)\s+var\(--ease-navigation\)/s
    );
    expect(css).toMatch(
      /\.readerShell\s*\{[^}]*opacity\s+var\(--motion-navigation\)\s+var\(--ease-navigation\)[^}]*transform\s+var\(--motion-navigation\)\s+var\(--ease-navigation\)/s
    );
    for (const selector of [".appSurface {", ".tabIndicator {", ".readerShell {"]) {
      const start = css.indexOf(selector);
      const end = css.indexOf("}", start);
      expect(css.slice(start, end)).toContain(
        "will-change: transform, opacity"
      );
    }
  });

  it("uses a visible 36 pixel horizontal push for tabs and reader presentation", () => {
    expect(css).toMatch(
      /\.appSurfaceBefore\s*\{[^}]*translate3d\(-36px,\s*0,\s*0\)/s
    );
    expect(css).toMatch(
      /\.appSurfaceAfter\s*\{[^}]*translate3d\(36px,\s*0,\s*0\)/s
    );
    expect(css).toMatch(
      /\.readerSessionInactive\s*\{[^}]*transform:\s*translate3d\(36px,\s*0,\s*0\)/s
    );
    expect(css).toMatch(
      /\.readingDashboardReaderOpen\s*\{[^}]*transform:\s*translate3d\(-36px,\s*0,\s*0\)/s
    );
    expect(css).toMatch(
      /\.readingDashboardReaderOpen\s*\{[^}]*transition-delay:\s*0s,\s*0s,\s*var\(--motion-navigation\)/s
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
      ".readerOverlayBack {",
      ".readerFloatingTool {",
      ".readerCornerMenuButton {",
    ]) {
      const start = css.indexOf(selector);
      const end = css.indexOf("}", start);
      const rule = css.slice(start, end);
      expect(rule).not.toContain("backdrop-filter");
    }
  });

  it("keeps reader chrome travel within eight pixels", () => {
    const start = css.indexOf(".readerFloatingTool {");
    const end = css.indexOf("}", start);
    const rule = css.slice(start, end);
    expect(rule).toContain("translateY(8px)");

    const hiddenStart = css.indexOf(
      ".readerChromeControlsHidden .readerFloatingTools {"
    );
    const hiddenEnd = css.indexOf("}", hiddenStart);
    const hiddenRule = css.slice(hiddenStart, hiddenEnd);
    expect(hiddenRule).toContain("translateY(8px)");
  });

  it("staggers individual reader tools by 35 milliseconds", () => {
    expect(css).toContain("--reader-tool-delay: 35ms");
    expect(css).toContain("calc(var(--tool-order) * var(--reader-tool-delay))");
  });

  it("removes reader tool travel and stagger when motion is reduced", () => {
    expect(css).toMatch(
      /\[data-reduce-motion="true"\]\s+\.readerFloatingTool\s*\{[^}]*transition-delay:\s*0ms[^}]*transform:\s*none/s
    );
  });
});
