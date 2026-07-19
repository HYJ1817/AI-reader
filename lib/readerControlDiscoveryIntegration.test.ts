import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8"
);

describe("reader control discovery integration", () => {
  it("loads discovery once and records the first explicit toggle", () => {
    expect(source).toContain("shouldDiscoverReaderControls");
    expect(source).toContain("markReaderControlsDiscovered");
    expect(source).toContain('type: "require-discovery"');
    expect(source).toContain("readerChromeState.discoveryPending");
    expect(source).toContain("onReaderTap={toggleReaderChrome}");
  });
});
