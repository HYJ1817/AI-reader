import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const config = readFileSync(
  new URL("../eslint.config.mjs", import.meta.url),
  "utf8"
);

describe("ESLint generated-artifact boundaries", () => {
  it("ignores Wrangler temporary bundles", () => {
    expect(config).toContain('".wrangler/**"');
  });
});
