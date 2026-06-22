import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);

describe("responsive application layout", () => {
  it("keeps the constrained desktop content column visible", () => {
    const mediaStart = css.indexOf("@media (min-width: 640px)");
    const contentStart = css.indexOf(".content {", mediaStart);
    const contentEnd = css.indexOf("}", contentStart);
    const contentRule = css.slice(contentStart, contentEnd);

    expect(contentRule).toContain("width: 100%");
    expect(contentRule).toContain("max-width: 600px");
  });
});
