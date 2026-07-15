import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8"
);
const epubSource = readFileSync(
  new URL("../app/EpubReader.tsx", import.meta.url),
  "utf8"
);

describe("reader swipe timing ownership", () => {
  it("uses the shared duration helper in both reader implementations", () => {
    for (const source of [pageSource, epubSource]) {
      expect(source).toContain("getReaderSwipeSettleDuration");
      expect(source).not.toContain(
        'action === "none" ? 180 : 160'
      );
    }
  });
});
