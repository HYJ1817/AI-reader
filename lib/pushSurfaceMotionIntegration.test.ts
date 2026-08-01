import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const navigationSource = readFileSync(
  new URL("../app/NavigationStack.tsx", import.meta.url),
  "utf8"
);
const appNavigationSource = readFileSync(
  new URL("../app/AppNavigation.tsx", import.meta.url),
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
    expect(navigationSource).toContain("const pushExitTarget =");
    expect(navigationSource).toMatch(
      /settlingTop\s*&&\s*settlingComplete\s*\?\s*\{\s*opacity:\s*1,\s*x:\s*settlingTarget\s*\}/s
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

  it("cancels edge back on pointer cancellation and lost capture", () => {
    expect(navigationSource).toContain(
      "onPointerCancel={handlePointerCancel}"
    );
    expect(navigationSource).toContain(
      "onLostPointerCapture={handlePointerCancel}"
    );
  });

  it("uses the dedicated root content transition", () => {
    expect(navigationSource).toContain("ROOT_TAB_CONTENT_TRANSITION");
    expect(navigationSource).toContain('data-motion-role="root-content"');
    expect(navigationSource).toContain("const rootTabTransition =");
    expect(navigationSource).toMatch(
      /pushDepth === 0[\s\S]*?active[\s\S]*?ROOT_TAB_CONTENT_TRANSITION[\s\S]*?: \{ duration: 0 \}/
    );
    expect(pageCss).toMatch(
      /\[data-motion-role="root-content"\][\s\S]*?--motion-role-duration:\s*var\(--motion-root\);/
    );
  });

  it("labels the shared root indicator with its motion role", () => {
    expect(appNavigationSource).toContain('data-motion-role="root-indicator"');
    expect(pageCss).toMatch(
      /\[data-motion-role="root-indicator"\][\s\S]*?--motion-role-duration:\s*var\(--motion-tab-indicator\);/
    );
  });

  it("uses role transitions for ordinary push entry and exit", () => {
    expect(navigationSource).toContain(
      'getPushTransition("enter", reduceMotion)'
    );
    expect(navigationSource).toContain(
      'transition: getPushTransition("exit", reduceMotion)'
    );
  });

  it("settles edge ownership without navigation on lifecycle changes", () => {
    expect(navigationSource).toContain("useAppMotionLifecycle");
    expect(navigationSource).toContain("edgeBackPointerRef.current = null");
    expect(navigationSource).toContain("edgeBackX.stop()");
    expect(navigationSource).toContain("edgeFinishHandledRef.current = true");
    expect(navigationSource).not.toMatch(/key=\{[^}]*epoch/);
  });
});
