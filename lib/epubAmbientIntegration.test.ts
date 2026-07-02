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

  it("renders EPUB sessions on the same light canvas variables as light mode", () => {
    expect(readingSessionSource).toContain("styles.readerEpubLightCanvas");
    expect(readingSessionSource).toContain('book?.format === "epub"');
    expect(moduleCss).toContain(".readerEpubLightCanvas");
    expect(moduleCss).toContain("--background: #ffffff;");
    expect(moduleCss).toContain("--foreground: #1a1a1a;");
    expect(moduleCss).toContain("--app-bg: #f5f5f7;");
    expect(moduleCss).toContain("background: var(--app-bg);");
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

    expect(epubSource).toContain(
      'import { applyEpubAmbientCanvas } from "@/lib/epubAmbientCanvas";'
    );
    expect(handlerStart).toBeGreaterThanOrEqual(0);
    expect(ambientIndex).toBeGreaterThanOrEqual(0);
    expect(tapIndex).toBeGreaterThanOrEqual(0);
    expect(ambientIndex).toBeLessThan(tapIndex);
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
});
