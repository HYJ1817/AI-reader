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
const sharedReaderPresentationUrl = new URL(
  "../app/SharedBookTransition.tsx",
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
    expect(epubSource).toContain("maxDistancePx: 32");
  });

  it("lets short TXT pointer drift still count as a reader chrome tap", () => {
    const pointerUpStart = pageSource.indexOf(
      "const handleReaderPointerUp = useCallback"
    );
    const pointerUpEnd = pageSource.indexOf(
      "const useCustomBackgroundImage",
      pointerUpStart
    );
    const pointerUpSource = pageSource.slice(pointerUpStart, pointerUpEnd);

    expect(pointerUpSource).toContain("const pointerIsTap = isTapGesture({");
    expect(pointerUpSource).toContain("maxDistancePx: 32");
    expect(pointerUpSource).toContain(
      'if (pointerDown.axis === "vertical" && !pointerIsTap) return;'
    );
    expect(pointerUpSource).toContain("if (!pointerIsTap) {");
  });

  it("captures EPUB frame taps before publisher content can stop propagation", () => {
    expect(epubSource).toContain(
      "const epubTouchListenerOptions = { passive: true, capture: true } as const;"
    );
    expect(epubSource).toContain(
      "const epubClickListenerOptions = { capture: true } as const;"
    );
    expect(epubSource).toMatch(
      /doc\.addEventListener\(\s*"touchstart"[\s\S]*epubTouchListenerOptions\s*\);/
    );
    expect(epubSource).toMatch(
      /doc\.addEventListener\(\s*"touchend"[\s\S]*epubTouchListenerOptions\s*\);/
    );
    expect(epubSource).toContain('}, epubClickListenerOptions);');
    expect(
      epubSource.match(/epubTouchListenerOptions/g)?.length ?? 0
    ).toBeGreaterThanOrEqual(5);
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

    expect(sessionSource).toContain("onTextSelect={(selection) => {");
    expect(sessionSource).toContain(
      "resolveEpubSelectionUpdate(selection?.text ?? \"\")"
    );
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
      "onTextSelectRef.current?.(null)"
    );
  });

  it("clears stale selection before toggling chrome for a real EPUB tap", () => {
    expect(epubSource).toContain("selection?.removeAllRanges()");
    expect(epubSource).toContain("onTextSelectRef.current?.(null)");
    expect(epubSource).toContain("shouldReportEpubSelectionChange");
  });

  it("does not let a stale EPUB selection block the click fallback tap", () => {
    const fallbackStart = epubSource.indexOf("const fireReaderTap =");
    const fallbackEnd = epubSource.indexOf("const settleSwipe", fallbackStart);
    const fallbackSource = epubSource.slice(fallbackStart, fallbackEnd);

    expect(fallbackSource).toContain("clearSelectionForTap(Date.now())");
    expect(fallbackSource).not.toContain("|| getSelectionText()");
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

  it("coordinates chrome through Motion without mutating the reader shell", () => {
    expect(controlsSource).toContain('from "motion/react"');
    expect(controlsSource).toContain("useAppReducedMotion");
    expect(controlsSource).toContain("m.button");
    expect(controlsSource).toContain("m.div");
    expect(readingSessionSource).not.toContain("styles.readerChromeHidden");
    expect(readingSessionSource).not.toContain(
      "styles.readerChromeControlsHidden"
    );
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

  it("presents the reader from navigation state independently of root tabs", () => {
    expect(existsSync(sharedReaderPresentationUrl)).toBe(true);
    if (!existsSync(sharedReaderPresentationUrl)) return;
    const presentationSource = readFileSync(
      sharedReaderPresentationUrl,
      "utf8"
    );

    expect(pageSource).toContain("const readerEntry = navigation.state.reader");
    expect(pageSource).toContain("const readerPresented = readerEntry !== null");
    expect(pageSource).toContain("<SharedBookTransition");
    expect(pageSource).not.toContain("styles.readingDashboardReaderOpen");
    expect(presentationSource).toContain("AnimatePresence");
    expect(presentationSource).toContain("readerEntry");
    expect(presentationSource).toContain("readerContent");
  });
});
