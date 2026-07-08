import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type WebManifestIcon = {
  src: string;
  sizes: string;
  type?: string;
  purpose?: string;
};

type WebManifest = {
  name?: string;
  short_name?: string;
  start_url?: string;
  display?: string;
  icons?: WebManifestIcon[];
};

const publicDir = join(__dirname, "..", "public");
const manifest = JSON.parse(
  readFileSync(join(publicDir, "manifest.webmanifest"), "utf8")
) as WebManifest;

describe("web app manifest", () => {
  it("keeps installable Android icon assets available as PNG files", () => {
    expect(manifest.name).toBe("AI Reader");
    expect(manifest.short_name).toBe("Reader");
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");

    for (const size of ["192x192", "512x512"]) {
      const icon = manifest.icons?.find(
        (candidate) =>
          candidate.sizes === size &&
          candidate.type === "image/png" &&
          candidate.purpose?.includes("any") &&
          candidate.purpose?.includes("maskable")
      );

      expect(icon?.src).toBe(`/icon-${size.split("x")[0]}.png`);
      expect(existsSync(join(publicDir, icon?.src.slice(1) ?? ""))).toBe(true);
    }
  });
});
