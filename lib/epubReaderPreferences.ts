import {
  DEFAULT_READER_PREFERENCES,
  getReaderPreferenceChanges,
  type ReaderPreferences,
} from "./readerPreferences";

export type EpubThemeController = {
  register: (name: string, rules: EpubThemeRules) => void;
  select: (name: string) => void;
  override: (property: string, value: string) => void;
};

export type EpubThemeRule =
  | Record<string, string>
  | Array<Record<string, string>>;

export type EpubThemeRules = Record<string, EpubThemeRule>;

export type EpubThemeColors = {
  foreground: string;
  background: string;
};

export type EpubPreferenceState = {
  preferences: ReaderPreferences | null;
  themeSignature: string;
};

export const EMPTY_EPUB_PREFERENCE_STATE: EpubPreferenceState = {
  preferences: null,
  themeSignature: "",
};

const FONT_FAMILY_CSS: Record<ReaderPreferences["fontFamily"], string> = {
  default: "inherit",
  system:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
  serif: '"Songti SC", "STSong", "Noto Serif CJK SC", serif',
};

export function applyEpubReaderPreferences(
  controller: EpubThemeController,
  preferences: ReaderPreferences,
  colors: EpubThemeColors,
  previousState: EpubPreferenceState
): EpubPreferenceState {
  const changes = previousState.preferences
    ? getReaderPreferenceChanges(previousState.preferences, preferences)
    : {
        theme: true,
        fontSizePx: true,
        lineHeight: true,
        contentWidth: true,
        fontFamily: true,
        boldText: true,
        customLayoutEnabled: true,
        letterSpacingPercent: true,
        wordSpacingPercent: true,
        pageMarginPx: true,
        justifyText: true,
    };
  const themeSignature = `${colors.foreground}|${colors.background}`;
  const contentForeground = colors.foreground;

  if (
    changes.theme ||
    previousState.themeSignature !== themeSignature
  ) {
    controller.register("reader-prefs", {
      "html, body": {
        background: "transparent !important",
        "background-color": "transparent !important",
        "color-scheme": "normal",
        "touch-action": "pan-y pinch-zoom",
        "overscroll-behavior-inline": "contain",
        "-webkit-tap-highlight-color": "transparent",
      },
      body: {
        color: `${contentForeground} !important`,
        background: "transparent !important",
        "background-color": "transparent !important",
        transition: "color 180ms cubic-bezier(0.25, 1, 0.5, 1)",
      },
      "body *:not(img):not(svg):not(video):not(canvas):not(picture)": {
        background: "transparent !important",
        "background-color": "transparent !important",
      },
      "body *::before, body *::after": {
        background: "transparent !important",
        "background-color": "transparent !important",
      },
      "p, div, span, li, a, em, strong, b, i, u, small, blockquote, figcaption, dt, dd, td, th, font, h1, h2, h3, h4, h5, h6": {
        color: `${contentForeground} !important`,
        transition: "color 180ms cubic-bezier(0.25, 1, 0.5, 1)",
      },
    });
    controller.select("reader-prefs");
  }

  if (changes.fontSizePx) {
    controller.override("font-size", `${preferences.fontSizePx}px`);
  }
  if (changes.lineHeight || changes.customLayoutEnabled) {
    controller.override(
      "line-height",
      String(
        preferences.customLayoutEnabled
          ? preferences.lineHeight
          : DEFAULT_READER_PREFERENCES.lineHeight
      )
    );
  }
  if (changes.fontFamily && previousState.preferences) {
    controller.override("font-family", FONT_FAMILY_CSS[preferences.fontFamily]);
  }
  if (changes.boldText && (previousState.preferences || preferences.boldText)) {
    controller.override("font-weight", preferences.boldText ? "700" : "400");
  }
  if (
    (changes.letterSpacingPercent || changes.customLayoutEnabled) &&
    (previousState.preferences || preferences.letterSpacingPercent > 0)
  ) {
    controller.override(
      "letter-spacing",
      `${preferences.customLayoutEnabled ? preferences.letterSpacingPercent / 100 : 0}em`
    );
  }
  if (
    (changes.wordSpacingPercent || changes.customLayoutEnabled) &&
    (previousState.preferences || preferences.wordSpacingPercent > 0)
  ) {
    controller.override(
      "word-spacing",
      `${preferences.customLayoutEnabled ? preferences.wordSpacingPercent / 100 : 0}em`
    );
  }
  if (
    (changes.pageMarginPx || changes.customLayoutEnabled) &&
    (previousState.preferences || preferences.pageMarginPx > 0)
  ) {
    const pageMarginPx = preferences.customLayoutEnabled
      ? preferences.pageMarginPx
      : 0;
    controller.override("padding-left", `${pageMarginPx}px`);
    controller.override("padding-right", `${pageMarginPx}px`);
  }
  if (
    (changes.justifyText || changes.customLayoutEnabled) &&
    (previousState.preferences || preferences.justifyText)
  ) {
    controller.override(
      "text-align",
      preferences.customLayoutEnabled && preferences.justifyText
        ? "justify"
        : "start"
    );
  }

  return {
    preferences: { ...preferences },
    themeSignature,
  };
}
