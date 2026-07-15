import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../app/SharedBookTransition.tsx", import.meta.url),
  "utf8"
);

describe("shared reader transition timing", () => {
  it("uses explicit entrance and exit timing without an exit delay", () => {
    expect(source).toContain("getReaderTransitionTiming");
    expect(source).toContain("transition: timing.contentExit");
    expect(source).toContain("opacity: timing.coverExitOpacity");
    expect(source).not.toMatch(/exit[\s\S]{0,240}readerEnter \* 0\.24/);
  });
});
