import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function optionalSource(path: string): string {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const registrySource = optionalSource("../app/AppPushSurfaces.tsx");
const stackSource = optionalSource("../app/NavigationStack.tsx");
const pageSource = optionalSource("../app/page.tsx");
const stylesSource = optionalSource("../app/page.module.css");

describe("pushed application surfaces", () => {
  it.each([
    ["collections", "LibraryCollectionsSurface"],
    ["ai-providers", "AiSettingsSurface"],
    ["ai-provider-configure", "AiSettingsSurface"],
    ["custom-background", "CustomBackgroundSettingsSurface"],
  ])("maps %s to %s", (route, component) => {
    expect(registrySource).toContain(`case "${route}"`);
    expect(registrySource).toContain(`<${component}`);
  });

  it("renders push entries with interruptible Motion presence", () => {
    expect(stackSource).toContain("AnimatePresence");
    expect(stackSource).toContain('x: "100%"');
    expect(stackSource).toContain('"-30%"');
    expect(stackSource).toContain("brightness(0.94)");
    expect(stackSource).toContain("useAppReducedMotion");
    expect(stackSource).toContain("styles.rootParallaxLayer");
  });

  it("drives all subviews from typed navigation commands", () => {
    for (const route of [
      "collections",
      "ai-providers",
      "ai-provider-configure",
      "custom-background",
    ]) {
      expect(pageSource).toContain(`navigation.push("${route}"`);
    }
    expect(pageSource).not.toContain("libraryScreen");
    expect(pageSource).not.toContain("aiSettingsSheetOpen");
  });

  it("keeps compact provider navigation and long metadata inside the viewport", () => {
    expect(stylesSource).toMatch(
      /\.providerNavButton\s*\{[^}]*white-space:\s*nowrap;/s
    );
    expect(stylesSource).toMatch(
      /\.providerChoiceText small\s*\{[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/s
    );
  });
});
