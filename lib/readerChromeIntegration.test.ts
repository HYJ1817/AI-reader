import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8"
);
const epubSource = readFileSync(
  new URL("../app/EpubReader.tsx", import.meta.url),
  "utf8"
);
const controlsSource = readFileSync(
  new URL("../app/ReaderControls.tsx", import.meta.url),
  "utf8"
);
const readingSessionSource = readFileSync(
  new URL("../app/ReadingSession.tsx", import.meta.url),
  "utf8"
);
const readerPresentationUrl = new URL(
  "../app/useReaderPresentation.ts",
  import.meta.url
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
    expect(readingSessionSource).toContain("onReaderTap={onReaderTap}");
    expect(readingSessionSource).toContain(
      "onReaderScrollStart={onReaderScrollStart}"
    );
  });

  it("prevents an EPUB scroll gesture from also completing as a tap", () => {
    expect(epubSource).toContain("if (scrollIntentFired) return;");
    expect(epubSource).toContain("isTapGesture({");
  });

  it("uses unframed floating tools instead of the old top and bottom chrome", () => {
    expect(controlsSource).toContain("readerFloatingTools");
    expect(controlsSource).toContain("readerOverlayBack");
    expect(controlsSource).not.toContain("readerTopHint");
    expect(controlsSource).not.toContain("readerPageBadge");
    expect(controlsSource).not.toContain("readerGoalMini");
    expect(controlsSource).not.toContain("readerActionPanel");
  });

  it("exposes both scroll and paged reading modes", () => {
    expect(controlsSource).toContain('handleReaderModeChange("scroll")');
    expect(controlsSource).toContain('handleReaderModeChange("paged")');
  });

  it("presents the reader independently from the active reading tab", () => {
    expect(existsSync(readerPresentationUrl)).toBe(true);
    if (!existsSync(readerPresentationUrl)) return;
    const presentationSource = readFileSync(readerPresentationUrl, "utf8");

    expect(pageSource).toContain("useReaderPresentation(setActiveTab)");
    expect(pageSource).toContain(
      'active={readerPresented && activeTab === "reading"}'
    );
    expect(pageSource).toContain("styles.readingDashboardReaderOpen");
    expect(presentationSource).toContain(
      "const [readerPresented, setReaderPresented] = useState(false)"
    );
    expect(presentationSource).toContain("setReaderPresented(true)");
    expect(presentationSource).toContain("setReaderPresented(false)");
    expect(presentationSource.match(/requestAnimationFrame/g)?.length).toBe(2);
  });
});
