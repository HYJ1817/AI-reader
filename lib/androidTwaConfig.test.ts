import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(__dirname, "..");
const productionHost = "881817.xyz";
const productionOrigin = `https://${productionHost}`;

describe("Android TWA configuration", () => {
  it("targets the production domain instead of the temporary preview tunnel", () => {
    const twaManifest = JSON.parse(
      readFileSync(join(repoRoot, "android-twa", "twa-manifest.json"), "utf8")
    ) as {
      appVersion?: string;
      appVersionCode?: number;
      appVersionName?: string;
      host?: string;
      iconUrl?: string;
      maskableIconUrl?: string;
      webManifestUrl?: string;
      fullScopeUrl?: string;
    };
    const buildGradle = readFileSync(
      join(repoRoot, "android-twa", "app", "build.gradle"),
      "utf8"
    );
    const androidStrings = readFileSync(
      join(repoRoot, "android-twa", "app", "src", "main", "res", "values", "strings.xml"),
      "utf8"
    );

    expect(twaManifest.host).toBe(productionHost);
    expect(twaManifest.iconUrl).toBe(`${productionOrigin}/icon-512.png`);
    expect(twaManifest.maskableIconUrl).toBe(`${productionOrigin}/icon-512.png`);
    expect(twaManifest.webManifestUrl).toBe(`${productionOrigin}/manifest.webmanifest`);
    expect(twaManifest.fullScopeUrl).toBe(`${productionOrigin}/`);
    expect(twaManifest.appVersion).toBe("2");
    expect(twaManifest.appVersionCode).toBe(2);
    expect(twaManifest.appVersionName).toBe("2");
    expect(buildGradle).toContain(`hostName: '${productionHost}'`);
    expect(buildGradle).toContain("versionCode 2");
    expect(buildGradle).toContain('versionName "2"');
    expect(buildGradle).toContain(`${productionOrigin}/manifest.webmanifest`);
    expect(androidStrings).toContain(`\\"site\\": \\"${productionOrigin}\\"`);

    for (const content of [JSON.stringify(twaManifest), buildGradle, androidStrings]) {
      expect(content).not.toContain("trycloudflare.com");
    }
  });
});
