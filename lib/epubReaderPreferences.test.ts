import { describe, expect, it, vi } from "vitest";
import {
  applyEpubReaderPreferences,
  EMPTY_EPUB_PREFERENCE_STATE,
  type EpubThemeController,
} from "./epubReaderPreferences";
import { DEFAULT_READER_PREFERENCES } from "./readerPreferences";

function createController(): EpubThemeController {
  return {
    register: vi.fn(),
    select: vi.fn(),
    override: vi.fn(),
  };
}

describe("applyEpubReaderPreferences", () => {
  it("installs the theme and typography on first application", () => {
    const controller = createController();

    const state = applyEpubReaderPreferences(
      controller,
      DEFAULT_READER_PREFERENCES,
      { foreground: "#111111", background: "#ffffff" },
      EMPTY_EPUB_PREFERENCE_STATE
    );

    expect(controller.register).toHaveBeenCalledTimes(1);
    expect(controller.select).toHaveBeenCalledWith("reader-prefs");
    expect(controller.override).toHaveBeenCalledWith("font-size", "18px");
    expect(controller.override).toHaveBeenCalledWith("line-height", "1.75");
    expect(state.preferences).toEqual(DEFAULT_READER_PREFERENCES);
  });

  it("registers a transparent iframe canvas while preserving forced foreground colors", () => {
    const controller = createController();

    applyEpubReaderPreferences(
      controller,
      DEFAULT_READER_PREFERENCES,
      { foreground: "#111111", background: "#ffffff" },
      EMPTY_EPUB_PREFERENCE_STATE
    );

    const rules = vi.mocked(controller.register).mock.calls[0]?.[1];

    expect(rules?.["html, body"]).toContain(
      "background: transparent !important;"
    );
    expect(rules?.["html, body"]).toContain("touch-action: pan-y pinch-zoom;");
    expect(rules?.body).toContain("color: #111111 !important;");
    expect(rules?.body).toContain("background: transparent !important;");
    expect(rules?.body).not.toContain("background: #ffffff");
    expect(rules?.body).not.toContain("background-color");
    expect(rules?.body).toContain(
      "transition: color 180ms cubic-bezier(0.25, 1, 0.5, 1);"
    );
    expect(rules?.["p, div, span, li, h1, h2, h3, h4, h5, h6"]).toBe(
      "color: #111111 !important; transition: color 180ms cubic-bezier(0.25, 1, 0.5, 1);"
    );
  });

  it("reinstalls the transparent theme when only the background signature changes", () => {
    const controller = createController();
    const initialState = applyEpubReaderPreferences(
      controller,
      DEFAULT_READER_PREFERENCES,
      { foreground: "#111111", background: "#ffffff" },
      EMPTY_EPUB_PREFERENCE_STATE
    );
    vi.clearAllMocks();

    const state = applyEpubReaderPreferences(
      controller,
      DEFAULT_READER_PREFERENCES,
      { foreground: "#111111", background: "#f5f5f5" },
      initialState
    );

    expect(controller.register).toHaveBeenCalledTimes(1);
    expect(controller.select).toHaveBeenCalledWith("reader-prefs");
    expect(controller.override).not.toHaveBeenCalled();
    expect(state.themeSignature).toBe("#111111|#f5f5f5");
  });

  it("updates only font size when only font size changed", () => {
    const controller = createController();
    const initialState = applyEpubReaderPreferences(
      controller,
      DEFAULT_READER_PREFERENCES,
      { foreground: "#111111", background: "#ffffff" },
      EMPTY_EPUB_PREFERENCE_STATE
    );
    vi.clearAllMocks();

    applyEpubReaderPreferences(
      controller,
      { ...DEFAULT_READER_PREFERENCES, fontSizePx: 21 },
      { foreground: "#111111", background: "#ffffff" },
      initialState
    );

    expect(controller.register).not.toHaveBeenCalled();
    expect(controller.select).not.toHaveBeenCalled();
    expect(controller.override).toHaveBeenCalledTimes(1);
    expect(controller.override).toHaveBeenCalledWith("font-size", "21px");
  });

  it("does not touch epub themes when only content width changed", () => {
    const controller = createController();
    const initialState = applyEpubReaderPreferences(
      controller,
      DEFAULT_READER_PREFERENCES,
      { foreground: "#111111", background: "#ffffff" },
      EMPTY_EPUB_PREFERENCE_STATE
    );
    vi.clearAllMocks();

    applyEpubReaderPreferences(
      controller,
      { ...DEFAULT_READER_PREFERENCES, contentWidth: 800 },
      { foreground: "#111111", background: "#ffffff" },
      initialState
    );

    expect(controller.register).not.toHaveBeenCalled();
    expect(controller.select).not.toHaveBeenCalled();
    expect(controller.override).not.toHaveBeenCalled();
  });

  it("reinstalls colors without reapplying typography when theme colors changed", () => {
    const controller = createController();
    const initialState = applyEpubReaderPreferences(
      controller,
      DEFAULT_READER_PREFERENCES,
      { foreground: "#111111", background: "#ffffff" },
      EMPTY_EPUB_PREFERENCE_STATE
    );
    vi.clearAllMocks();

    applyEpubReaderPreferences(
      controller,
      { ...DEFAULT_READER_PREFERENCES, theme: "dark" },
      { foreground: "#f4f4f4", background: "#111111" },
      initialState
    );

    expect(controller.register).toHaveBeenCalledTimes(1);
    expect(controller.select).toHaveBeenCalledWith("reader-prefs");
    expect(controller.override).not.toHaveBeenCalled();
  });
});
