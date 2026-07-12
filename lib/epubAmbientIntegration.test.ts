import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const epubSource = readFileSync(
  new URL("../app/EpubReader.tsx", import.meta.url),
  "utf8"
);
const readingSessionSource = readFileSync(
  new URL("../app/ReadingSession.tsx", import.meta.url),
  "utf8"
);
const moduleCss = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);

function cssRule(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  const end = css.indexOf("}", start);
  return start < 0 || end < 0 ? "" : css.slice(start, end);
}

describe("EPUB ambient background integration", () => {
  it("applies reader preferences after rendition events and before first display", () => {
    const initializationStart = epubSource.indexOf(
      "const rendition = book.renderTo"
    );
    const initializationEnd = epubSource.indexOf(
      "const renderedContents",
      initializationStart
    );
    const initializationSource = epubSource.slice(
      initializationStart,
      initializationEnd
    );
    const renderedEventIndex = initializationSource.indexOf(
      'rendition.on("rendered"'
    );
    const applyIndex = initializationSource.indexOf(
      "applyPreferences(rendition as Rendition, preferencesRef.current)"
    );
    const displayIndex = initializationSource.indexOf(
      "await rendition.display"
    );

    expect(initializationStart).toBeGreaterThanOrEqual(0);
    expect(initializationEnd).toBeGreaterThan(initializationStart);
    expect(renderedEventIndex).toBeGreaterThanOrEqual(0);
    expect(applyIndex).toBeGreaterThan(renderedEventIndex);
    expect(displayIndex).toBeGreaterThan(applyIndex);
    expect(
      initializationSource.match(
        /applyPreferences\(rendition as Rendition, preferencesRef\.current\)/g
      )
    ).toHaveLength(1);
  });

  it("keeps the viewport and epub.js outer canvas transparent", () => {
    expect(moduleCss).toMatch(
      /\.epubReaderViewport,\s*\.epubReaderViewport :global\(\.epub-container\),\s*\.epubReaderViewport :global\(\.epub-view\),\s*\.epubReaderViewport :global\(iframe\)\s*\{[^}]*background:\s*transparent !important;/s
    );
  });

  it("hides the scroll track on epub.js's outer continuous-scroll container", () => {
    expect(moduleCss).toMatch(
      /\.epubReaderViewport :global\(\.epub-container\)\s*\{[^}]*scrollbar-width:\s*none !important;[^}]*-ms-overflow-style:\s*none !important;/s
    );
    expect(moduleCss).toMatch(
      /\.epubReaderViewport :global\(\.epub-container::\-webkit-scrollbar\)\s*\{[^}]*display:\s*none !important;[^}]*width:\s*0 !important;[^}]*height:\s*0 !important;/s
    );
    expect(moduleCss).toMatch(
      /\.epubReaderViewport :global\(\.epub-container::\-webkit-scrollbar-track\),\s*\.epubReaderViewport :global\(\.epub-container::\-webkit-scrollbar-thumb\)\s*\{[^}]*background:\s*transparent !important;/s
    );
  });

  it("lets EPUB inherit the active reader theme without covering the ambient background", () => {
    expect(readingSessionSource).not.toContain("styles.readerEpubLightCanvas");
    expect(readingSessionSource).toContain('book?.format === "epub"');
    expect(moduleCss).not.toContain(".readerEpubLightCanvas");
    expect(cssRule(moduleCss, ".readerShell")).toContain("background: transparent;");
    expect(cssRule(moduleCss, ".readerStage")).toContain(
      "background: transparent;"
    );
  });

  it("applies the inline ambient canvas override before attaching tap handlers", () => {
    const handlerStart = epubSource.indexOf(
      "const handleRenderedContents = useCallback"
    );
    const handlerEnd = epubSource.indexOf(
      "useEffect(() => {",
      handlerStart
    );
    const handlerSource = epubSource.slice(handlerStart, handlerEnd);
    const ambientIndex = handlerSource.indexOf(
      "applyEpubAmbientCanvas(contents)"
    );
    const tapIndex = handlerSource.indexOf("attachTapHandlers(contents)");

    expect(epubSource).toContain("applyEpubAmbientCanvas,");
    expect(epubSource).toContain("applyEpubViewTransparency,");
    expect(epubSource).toContain('from "@/lib/epubAmbientCanvas";');
    expect(handlerStart).toBeGreaterThanOrEqual(0);
    expect(ambientIndex).toBeGreaterThanOrEqual(0);
    expect(tapIndex).toBeGreaterThanOrEqual(0);
    expect(ambientIndex).toBeLessThan(tapIndex);
  });

  it("forces the epub.js view and iframe transparent before handling contents", () => {
    const renderedHandler = epubSource.slice(
      epubSource.indexOf('rendition.on("rendered"'),
      epubSource.indexOf("if (preferencesRef.current)")
    );

    expect(renderedHandler).toContain("applyEpubViewTransparency(view)");
    expect(renderedHandler.indexOf("applyEpubViewTransparency(view)")).toBeLessThan(
      renderedHandler.indexOf("handleRenderedContents(contents)")
    );
  });

  it("removes publisher backgrounds while preserving media elements", () => {
    expect(epubSource).toContain("applyEpubAmbientCanvas(contents)");
    expect(
      readFileSync(
        new URL("./epubReaderPreferences.ts", import.meta.url),
        "utf8"
      )
    ).toContain(
      "body *:not(img):not(svg):not(video):not(canvas):not(picture)"
    );
  });

  it("reapplies the transparent iframe canvas when reader preferences change", () => {
    const preferencesEffectStart = epubSource.indexOf(
      "if (!renditionRef.current || !preferences) return"
    );
    const preferencesEffectEnd = epubSource.indexOf(
      "}, [",
      preferencesEffectStart
    );
    const preferencesEffect = epubSource.slice(
      preferencesEffectStart,
      preferencesEffectEnd
    );

    expect(preferencesEffect).toContain("applyPreferences");
    expect(preferencesEffect).toContain("applyRenderedCanvas");
  });

  it("uses the shared rendered-content handler for events and post-display contents", () => {
    const initializationStart = epubSource.indexOf(
      "const rendition = book.renderTo"
    );
    const initializationEnd = epubSource.indexOf(
      "if (!cancelled) {",
      epubSource.indexOf("const renderedContents", initializationStart)
    );
    const initializationSource = epubSource.slice(
      initializationStart,
      initializationEnd
    );
    const displayIndex = initializationSource.indexOf(
      "await rendition.display"
    );
    const getContentsIndex = initializationSource.indexOf(
      "const renderedContents"
    );

    expect(initializationSource).toContain(
      "handleRenderedContents(contents)"
    );
    expect(initializationSource).toContain(
      "renderedContents.forEach(handleRenderedContents)"
    );
    expect(initializationSource).toContain(
      "handleRenderedContents(renderedContents)"
    );
    expect(getContentsIndex).toBeGreaterThan(displayIndex);
  });

  it("falls back to the default EPUB location when a saved locator cannot be displayed", () => {
    const initializationStart = epubSource.indexOf(
      "const savedPosition = await getReadingPosition(bookId)"
    );
    const initializationEnd = epubSource.indexOf(
      "const renderedContents",
      initializationStart
    );
    const initializationSource = epubSource.slice(
      initializationStart,
      initializationEnd
    );

    expect(initializationStart).toBeGreaterThanOrEqual(0);
    expect(initializationSource).toContain("try {");
    expect(initializationSource).toContain("await rendition.display(resumeLocator)");
    expect(initializationSource).toContain("catch");
    expect(initializationSource).toContain("latestLocatorRef.current = null");
    expect(initializationSource).toContain("await rendition.display()");
  });
});
