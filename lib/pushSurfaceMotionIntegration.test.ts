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
    expect(navigationSource).toMatch(
      /reduceMotion\s*\|\|\s*pushDepth\s*===\s*0\s*\?\s*0\s*:\s*compactCovered\s*\?\s*0\s*:\s*PUSH_DEPTH_OPACITY/
    );
    expect(pageCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.pushDepthOverlay\s*\{[\s\S]*?transition:\s*none/
    );
  });

  it("uses the compact profile only for provider configuration pushes", () => {
    expect(navigationSource).toContain("getPushMotionProfile");
    expect(navigationSource).toContain("COMPACT_PUSH_OFFSETS.incoming");
    expect(navigationSource).toContain("COMPACT_PUSH_OFFSETS.covered");
    expect(navigationSource).toContain(
      "data-push-motion={motionProfile}"
    );
    expect(navigationSource).toContain("MOTION_SPRING.navigation");
    expect(navigationSource).toMatch(
      /compactCovered\s*\?\s*0\s*:\s*PUSH_DEPTH_OPACITY/
    );
    expect(pageCss).toMatch(
      /\.pushSurface\[data-push-motion="compact"\]\s*\{[^}]*box-shadow:\s*none;/s
    );
    expect(pageCss).not.toMatch(
      /\.pushSurface\s*\{[^}]*box-shadow:\s*none;/s
    );
  });
});
