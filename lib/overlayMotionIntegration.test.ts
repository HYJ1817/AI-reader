import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const bottomSheetSource = readFileSync(
  new URL("../app/BottomSheet.tsx", import.meta.url),
  "utf8"
);
const librarySource = readFileSync(
  new URL("../app/LibrarySurface.tsx", import.meta.url),
  "utf8"
);
const aiSettingsSource = readFileSync(
  new URL("../app/AiSettingsSheet.tsx", import.meta.url),
  "utf8"
);
const css = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);

describe("overlay and nested view motion", () => {
  it("paints the sheet entering state before opening it", () => {
    const effectStart = bottomSheetSource.indexOf("useEffect(() => {");
    const effectEnd = bottomSheetSource.indexOf("}, []);", effectStart);
    const entranceEffect = bottomSheetSource.slice(effectStart, effectEnd);

    expect(entranceEffect.match(/requestAnimationFrame/g)?.length).toBe(2);
    expect(bottomSheetSource).toContain(
      "window.setTimeout(finishClose, 380)"
    );
  });

  it("animates library and AI nested views in both directions", () => {
    for (const source of [librarySource, aiSettingsSource]) {
      expect(source).toContain("subviewEnterForward");
      expect(source).toContain("subviewEnterBackward");
    }

    expect(css).toMatch(
      /\.subviewEnterForward\s*\{[^}]*animation:\s*subviewInForward\s+var\(--motion-navigation\)\s+var\(--ease-navigation\)/s
    );
    expect(css).toMatch(
      /\.subviewEnterBackward\s*\{[^}]*animation:\s*subviewInBackward\s+var\(--motion-navigation\)\s+var\(--ease-navigation\)/s
    );
    expect(css).toMatch(
      /@keyframes subviewInForward\s*\{[\s\S]*translate3d\(36px,\s*0,\s*0\)[\s\S]*translate3d\(0,\s*0,\s*0\)/s
    );
    expect(css).toMatch(
      /@keyframes subviewInBackward\s*\{[\s\S]*translate3d\(-36px,\s*0,\s*0\)[\s\S]*translate3d\(0,\s*0,\s*0\)/s
    );
  });

  it("keeps active motion on compositor-friendly properties", () => {
    for (const selector of [
      ".motionSheetEntering .bottomSheet {",
      ".motionSheetClosing .bottomSheet {",
      ".subviewEnterForward {",
      ".subviewEnterBackward {",
    ]) {
      const start = css.indexOf(selector);
      const end = css.indexOf("}", start);
      const rule = css.slice(start, end);
      expect(rule).not.toMatch(/\b(?:top|left|width|height|margin):/);
    }
  });
});
