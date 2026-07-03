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
const readerSettingsSource = readFileSync(
  new URL("../app/ReaderSettingsPanel.tsx", import.meta.url),
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
const globalsSource = readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8"
);
const epubPreferencesSource = readFileSync(
  new URL("../lib/epubReaderPreferences.ts", import.meta.url),
  "utf8"
);

describe("reader chrome event integration", () => {
  it("keeps imported books in the library instead of opening them immediately", () => {
    const importStart = pageSource.indexOf("async function handleImport");
    const importEnd = pageSource.indexOf(
      "const groupFilteredBooks",
      importStart
    );
    const importSource = pageSource.slice(importStart, importEnd);

    expect(importSource).toContain("setBooks(await listBooks())");
    expect(importSource).not.toContain("openBookForReading(record)");
  });

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

  it("hides TXT chrome only for explicit movement or wheel intent", () => {
    const scrollStart = pageSource.indexOf(
      "const handleReaderScroll = useCallback"
    );
    const scrollEnd = pageSource.indexOf(
      "const handleEpubProgressChange",
      scrollStart
    );
    const scrollSource = pageSource.slice(scrollStart, scrollEnd);
    const pointerMoveStart = pageSource.indexOf(
      "const handleReaderPointerMove = useCallback"
    );
    const pointerMoveEnd = pageSource.indexOf(
      "const handleReaderPointerUp",
      pointerMoveStart
    );
    const pointerMoveSource = pageSource.slice(
      pointerMoveStart,
      pointerMoveEnd
    );

    expect(scrollSource).not.toContain('type: "scroll"');
    expect(pointerMoveSource).toContain('type: "scroll"');
    expect(pointerMoveSource).not.toContain(
      "!appPrefs.swipeToTurn) return"
    );
    expect(readingSessionSource).toContain(
      "onWheel={onReaderScrollStart}"
    );
  });

  it("prevents an EPUB scroll gesture from also completing as a tap", () => {
    expect(epubSource).toContain("scrollIntentFired,");
    expect(epubSource).toContain("if (touchEnd.fireTap)");
    expect(epubSource).toContain("isTapGesture({");
  });

  it("routes EPUB touch selection and synthetic click arbitration through the tested helper", () => {
    expect(epubSource).toContain("normalizeEpubSelectionText");
    expect(epubSource).toContain("resolveEpubTouchEnd");
    expect(epubSource).toContain("consumeEpubSyntheticClick");
    expect(epubSource).toContain("cancelEpubSyntheticClickToken");
    expect(epubSource).not.toContain("lastTouchTapAt");
  });

  it("clears stale EPUB selection and only shows chrome for non-empty text", () => {
    const sessionStart = pageSource.indexOf("<ReadingSession");
    const sessionEnd = pageSource.indexOf("</main>", sessionStart);
    const sessionSource = pageSource.slice(sessionStart, sessionEnd);

    expect(sessionSource).toContain("onTextSelect={(text) => {");
    expect(sessionSource).toContain("resolveEpubSelectionUpdate(text)");
    expect(sessionSource).toContain("setSelectedText(selectionUpdate.selectedText)");
    expect(sessionSource).toContain(
      "if (selectionUpdate.shouldShowChrome)"
    );
  });

  it("reports selection changes from the EPUB document, including clears", () => {
    expect(epubSource).toContain(
      'doc.addEventListener("selectionchange", reportSelectionChange)'
    );
    expect(epubSource).toContain("const selectionText = getSelectionText()");
    expect(epubSource).toContain(
      "onTextSelectRef.current?.(selectionText)"
    );
  });

  it("clears stale selection before toggling chrome for a real EPUB tap", () => {
    expect(epubSource).toContain("selection?.removeAllRanges()");
    expect(epubSource).toContain('onTextSelectRef.current?.("")');
    expect(epubSource).toContain("shouldReportEpubSelectionChange");
  });

  it("uses the bottom reader action menu instead of the old top and bottom chrome", () => {
    expect(controlsSource).toContain("readerActionMenu");
    expect(controlsSource).toContain("readerPagePill");
    expect(controlsSource).toContain("readerOverlayBack");
    expect(controlsSource).not.toContain("readerFloatingTools");
    expect(controlsSource).not.toContain("readerCornerMenuButton");
    expect(controlsSource).not.toContain("menuOpen");
    expect(controlsSource).not.toContain("readerTopHint");
    expect(controlsSource).not.toContain("readerPageBadge");
    expect(controlsSource).not.toContain("readerGoalMini");
    expect(controlsSource).not.toContain("readerActionPanel");
    expect(controlsSource).not.toContain("onOpenGoal");
    expect(controlsSource).not.toContain("UI_TEXT.READING_GOAL");
  });

  it("suppresses Safari tap highlights in the app and EPUB document", () => {
    expect(globalsSource).toContain("-webkit-tap-highlight-color: transparent");
    expect(epubPreferencesSource).toContain(
      '"-webkit-tap-highlight-color": "transparent"'
    );
  });

  it("exposes both scroll and paged reading modes", () => {
    expect(readerSettingsSource).toContain(
      "const READER_MODE_MENU_OPTIONS"
    );
    expect(readerSettingsSource).toContain('value: "scroll"');
    expect(readerSettingsSource).toContain('value: "paged"');
    expect(readerSettingsSource).toContain("onModeChange(item.value)");
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
