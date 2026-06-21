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

describe("reader chrome event integration", () => {
  it("reserves a stationary TXT tap for chrome instead of edge page turns", () => {
    expect(pageSource).not.toContain("getReaderTapAction");
    expect(pageSource).not.toContain("appPrefs.edgeTapToTurn &&");
  });

  it("does not expose a conflicting edge-tap setting", () => {
    expect(pageSource).not.toContain("UI_TEXT.EDGE_TAP_TO_TURN");
  });

  it("uses the shared chrome event reducer for TXT and EPUB", () => {
    expect(pageSource).toContain("reduceReaderChromeState");
    expect(pageSource).toContain('dispatchReaderChrome({ type: "tap"');
    expect(pageSource).toContain('dispatchReaderChrome({ type: "scroll"');
    expect(pageSource).toContain(
      'onReaderTap={() => dispatchReaderChrome({ type: "tap"'
    );
  });

  it("prevents an EPUB scroll gesture from also completing as a tap", () => {
    expect(epubSource).toContain("if (scrollIntentFired) return;");
    expect(epubSource).toContain("isTapGesture({");
  });
});
