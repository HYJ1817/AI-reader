import {
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
      };
  const themeSignature = `${colors.foreground}|${colors.background}`;

  if (
    changes.theme ||
    previousState.themeSignature !== themeSignature
  ) {
    controller.register("reader-prefs", {
      "html, body": {
        background: `${colors.background} !important`,
        "touch-action": "pan-y pinch-zoom",
        "overscroll-behavior-inline": "contain",
        "-webkit-tap-highlight-color": "transparent",
      },
      body: {
        color: `${colors.foreground} !important`,
        background: `${colors.background} !important`,
        transition: "color 180ms cubic-bezier(0.25, 1, 0.5, 1)",
      },
      // Only clear common top-level publisher canvases, leaving nested callouts and code blocks intact.
      "body > div, body > main, body > section, body > article": {
        background: "transparent !important",
      },
      "p, div, span, li, h1, h2, h3, h4, h5, h6": {
        color: `${colors.foreground} !important`,
        transition: "color 180ms cubic-bezier(0.25, 1, 0.5, 1)",
      },
    });
    controller.select("reader-prefs");
  }

  if (changes.fontSizePx) {
    controller.override("font-size", `${preferences.fontSizePx}px`);
  }
  if (changes.lineHeight) {
    controller.override("line-height", String(preferences.lineHeight));
  }

  return {
    preferences: { ...preferences },
    themeSignature,
  };
}
