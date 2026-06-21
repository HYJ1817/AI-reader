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
