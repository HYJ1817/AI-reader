import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const navigationSource = readFileSync(
  new URL("../app/NavigationStack.tsx", import.meta.url),
  "utf8"
);
const pageCss = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
).replace(/\r\n/g, "\n");

describe("push surface motion integration", () => {
  it("uses transform and a dedicated native-opacity depth layer", () => {
    expect(navigationSource).toContain("pushDepthOverlay");
    expect(navigationSource).toContain("edgePreviousOverlayOpacity");
    expect(navigationSource).not.toContain("edgePreviousBrightness");
    expect(navigationSource).not.toMatch(/\bfilter\s*:/);
    expect(pageCss).toMatch(
      /\.pushDepthOverlay\s*\{[\s\S]*?pointer-events:\s*none;[\s\S]*?background:/
    );
  });

  it("removes depth interpolation for reduced motion", () => {
    expect(navigationSource).toContain(
      "reduceMotion || pushDepth === 0 ? 0 : PUSH_DEPTH_OPACITY"
    );
    expect(pageCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.pushDepthOverlay\s*\{[\s\S]*?transition:\s*none/
    );
  });
});
