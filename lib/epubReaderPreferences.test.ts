import { describe, expect, it, vi } from "vitest";
import {
  applyEpubReaderPreferences,
  EMPTY_EPUB_PREFERENCE_STATE,
  type EpubThemeController,
  type EpubThemeRules,
} from "./epubReaderPreferences";
import { DEFAULT_READER_PREFERENCES } from "./readerPreferences";

function createController(): EpubThemeController {
  return {
    register: vi.fn(),
    select: vi.fn(),
    override: vi.fn(),
  };
}

function serializeRulesLikeEpubJs(rules: EpubThemeRules): string[] {
  return Object.entries(rules).flatMap(([selector, definition]) => {
    const definitions = Array.isArray(definition)
      ? definition
      : [definition];

    return definitions.map((item) => {
      const properties = Object.keys(item)
        .map((property) => `${property}:${item[property]}`)
        .join(";");
      return `${selector}{${properties}}`;
    });
  });
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

  it("registers a transparent reading canvas while preserving forced foreground colors", () => {
    const controller = createController();

    applyEpubReaderPreferences(
      controller,
      DEFAULT_READER_PREFERENCES,
      { foreground: "#111111", background: "#ffffff" },
      EMPTY_EPUB_PREFERENCE_STATE
    );

    const rules = vi.mocked(controller.register).mock.calls[0]?.[1] as
      | EpubThemeRules
      | undefined;

    expect(rules?.["html, body"]).toEqual({
      "background-color": "transparent !important",
      "touch-action": "pan-y pinch-zoom",
      "overscroll-behavior-inline": "contain",
      "-webkit-tap-highlight-color": "transparent",
    });
    expect(rules?.body).toEqual({
      color: "#111111 !important",
      "background-color": "transparent !important",
      transition: "color 180ms cubic-bezier(0.25, 1, 0.5, 1)",
    });
    expect(
      rules?.["body div, body main, body section, body article"]
    ).toEqual({
      "background-color": "transparent !important",
    });
    expect(
      rules?.[
        "p, div, span, li, a, em, strong, b, i, u, small, blockquote, figcaption, dt, dd, td, th, font, h1, h2, h3, h4, h5, h6"
      ]
    ).toEqual({
      color: "#111111 !important",
      transition: "color 180ms cubic-bezier(0.25, 1, 0.5, 1)",
    });
  });

  it("serializes theme rules through the epub.js property-object contract", () => {
    const controller = createController();

    applyEpubReaderPreferences(
      controller,
      DEFAULT_READER_PREFERENCES,
      { foreground: "#111111", background: "#ffffff" },
      EMPTY_EPUB_PREFERENCE_STATE
    );

    const rules = vi.mocked(controller.register).mock.calls[0]?.[1] as
      | EpubThemeRules
      | undefined;
    expect(rules).toBeDefined();
    if (!rules) return;

    const serialized = serializeRulesLikeEpubJs(rules);

    expect(serialized).toContain(
      "html, body{background-color:transparent !important;touch-action:pan-y pinch-zoom;overscroll-behavior-inline:contain;-webkit-tap-highlight-color:transparent}"
    );
    expect(serialized).toContain(
      "body div, body main, body section, body article{background-color:transparent !important}"
    );
    expect(serialized.join("\n")).not.toMatch(/\{0:/);
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

  it("applies custom typography overrides after custom settings change", () => {
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
      {
        ...DEFAULT_READER_PREFERENCES,
        fontFamily: "serif",
        boldText: true,
        letterSpacingPercent: 6,
        wordSpacingPercent: 18,
        pageMarginPx: 20,
        justifyText: true,
      },
      { foreground: "#111111", background: "#ffffff" },
      initialState
    );

    expect(controller.register).not.toHaveBeenCalled();
    expect(controller.select).not.toHaveBeenCalled();
    expect(controller.override).toHaveBeenCalledWith(
      "font-family",
      '"Songti SC", "STSong", "Noto Serif CJK SC", serif'
    );
    expect(controller.override).toHaveBeenCalledWith("font-weight", "700");
    expect(controller.override).toHaveBeenCalledWith("letter-spacing", "0.06em");
    expect(controller.override).toHaveBeenCalledWith("word-spacing", "0.18em");
    expect(controller.override).toHaveBeenCalledWith("padding-left", "20px");
    expect(controller.override).toHaveBeenCalledWith("padding-right", "20px");
    expect(controller.override).toHaveBeenCalledWith("text-align", "justify");
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
    const rules = vi.mocked(controller.register).mock.calls[0]?.[1];
    expect(rules?.["html, body"]).toMatchObject({
      "background-color": "transparent !important",
    });
    expect(rules?.body).toMatchObject({
      color: "#f4f4f4 !important",
      "background-color": "transparent !important",
    });
  });

  it("uses the active dark theme foreground throughout EPUB text", () => {
    const controller = createController();

    applyEpubReaderPreferences(
      controller,
      { ...DEFAULT_READER_PREFERENCES, theme: "dark" },
      { foreground: "#f3f4f6", background: "#171717" },
      EMPTY_EPUB_PREFERENCE_STATE
    );

    const rules = vi.mocked(controller.register).mock.calls[0]?.[1];
    expect(rules?.body).toMatchObject({
      color: "#f3f4f6 !important",
      "background-color": "transparent !important",
    });
    expect(
      rules?.[
        "p, div, span, li, a, em, strong, b, i, u, small, blockquote, figcaption, dt, dd, td, th, font, h1, h2, h3, h4, h5, h6"
      ]
    ).toMatchObject({ color: "#f3f4f6 !important" });
  });
});
