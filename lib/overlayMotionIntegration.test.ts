import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const bottomSheetSource = readFileSync(
  new URL("../app/BottomSheet.tsx", import.meta.url),
  "utf8"
);
const librarySource = readFileSync(
  new URL("../app/LibrarySurface.tsx", import.meta.url),
  "utf8"
);
const aiSettingsUrl = new URL("../app/AiSettingsSurface.tsx", import.meta.url);
const aiSettingsSource = existsSync(aiSettingsUrl)
  ? readFileSync(aiSettingsUrl, "utf8")
  : "";
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

  it("removes standalone keyframes from library and AI nested views", () => {
    for (const source of [librarySource, aiSettingsSource]) {
      expect(source).not.toContain("subviewEnterForward");
      expect(source).not.toContain("subviewEnterBackward");
    }

    expect(css).not.toContain(".subviewEnterForward");
    expect(css).not.toContain(".subviewEnterBackward");
    expect(css).not.toContain("@keyframes subviewInForward");
    expect(css).not.toContain("@keyframes subviewInBackward");
  });

  it("keeps active motion on compositor-friendly properties", () => {
    for (const selector of [
      ".motionSheetEntering .bottomSheet {",
      ".motionSheetClosing .bottomSheet {",
    ]) {
      const start = css.indexOf(selector);
      const end = css.indexOf("}", start);
      const rule = css.slice(start, end);
      expect(rule).not.toMatch(/\b(?:top|left|width|height|margin):/);
    }
  });
});
