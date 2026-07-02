export type ReaderTheme = "system" | "light" | "sepia" | "dark";

export interface ReaderPreferences {
  theme: ReaderTheme;
  fontSizePx: number;
  lineHeight: number;
  contentWidth: number;
  fontFamily: "default" | "system" | "serif";
  boldText: boolean;
  customLayoutEnabled: boolean;
  letterSpacingPercent: number;
  wordSpacingPercent: number;
  pageMarginPx: number;
  justifyText: boolean;
}

export const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
  theme: "system",
  fontSizePx: 18,
  lineHeight: 1.75,
  contentWidth: 720,
  fontFamily: "default",
  boldText: false,
  customLayoutEnabled: true,
  letterSpacingPercent: 0,
  wordSpacingPercent: 0,
  pageMarginPx: 0,
  justifyText: false,
};

export function shouldObserveSystemReaderTheme(theme: ReaderTheme): boolean {
  return theme === "system";
}

export function updateReaderPreferenceDraft<
  K extends keyof ReaderPreferences,
>(
  current: ReaderPreferences,
  key: K,
  value: ReaderPreferences[K]
): ReaderPreferences {
  return { ...current, [key]: value };
}

export function readerPreferenceChangeNeedsMotion(
  previous: ReaderPreferences,
  next: ReaderPreferences
): boolean {
  return Object.values(getReaderPreferenceChanges(previous, next)).some(Boolean);
}

export function getReaderPreferenceChanges(
  previous: ReaderPreferences,
  next: ReaderPreferences
): Record<keyof ReaderPreferences, boolean> {
  return {
    theme: previous.theme !== next.theme,
    fontSizePx: previous.fontSizePx !== next.fontSizePx,
    lineHeight: previous.lineHeight !== next.lineHeight,
    contentWidth: previous.contentWidth !== next.contentWidth,
    fontFamily: previous.fontFamily !== next.fontFamily,
    boldText: previous.boldText !== next.boldText,
    customLayoutEnabled:
      previous.customLayoutEnabled !== next.customLayoutEnabled,
    letterSpacingPercent:
      previous.letterSpacingPercent !== next.letterSpacingPercent,
    wordSpacingPercent:
      previous.wordSpacingPercent !== next.wordSpacingPercent,
    pageMarginPx: previous.pageMarginPx !== next.pageMarginPx,
    justifyText: previous.justifyText !== next.justifyText,
  };
}

const VALID_THEMES: ReadonlySet<string> = new Set([
  "system",
  "light",
  "sepia",
  "dark",
]);
const VALID_FONT_FAMILIES: ReadonlySet<string> = new Set([
  "default",
  "system",
  "serif",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function sanitizeReaderPreferences(
  value: unknown
): ReaderPreferences {
  if (!isRecord(value)) return { ...DEFAULT_READER_PREFERENCES };

  const theme =
    typeof value.theme === "string" && VALID_THEMES.has(value.theme)
      ? (value.theme as ReaderTheme)
      : DEFAULT_READER_PREFERENCES.theme;

  const fontSizePx =
    typeof value.fontSizePx === "number" && Number.isFinite(value.fontSizePx)
      ? Math.round(clamp(value.fontSizePx, 14, 28))
      : DEFAULT_READER_PREFERENCES.fontSizePx;

  const lineHeight =
    typeof value.lineHeight === "number" && Number.isFinite(value.lineHeight)
      ? clamp(value.lineHeight, 1.3, 2.2)
      : DEFAULT_READER_PREFERENCES.lineHeight;

  const contentWidth =
    typeof value.contentWidth === "number" && Number.isFinite(value.contentWidth)
      ? Math.round(clamp(value.contentWidth, 320, 960))
      : DEFAULT_READER_PREFERENCES.contentWidth;

  const fontFamily =
    typeof value.fontFamily === "string" &&
    VALID_FONT_FAMILIES.has(value.fontFamily)
      ? (value.fontFamily as ReaderPreferences["fontFamily"])
      : DEFAULT_READER_PREFERENCES.fontFamily;

  const boldText =
    typeof value.boldText === "boolean"
      ? value.boldText
      : DEFAULT_READER_PREFERENCES.boldText;

  const customLayoutEnabled =
    typeof value.customLayoutEnabled === "boolean"
      ? value.customLayoutEnabled
      : DEFAULT_READER_PREFERENCES.customLayoutEnabled;

  const letterSpacingPercent =
    typeof value.letterSpacingPercent === "number" &&
    Number.isFinite(value.letterSpacingPercent)
      ? Math.round(clamp(value.letterSpacingPercent, 0, 12))
      : DEFAULT_READER_PREFERENCES.letterSpacingPercent;

  const wordSpacingPercent =
    typeof value.wordSpacingPercent === "number" &&
    Number.isFinite(value.wordSpacingPercent)
      ? Math.round(clamp(value.wordSpacingPercent, 0, 30))
      : DEFAULT_READER_PREFERENCES.wordSpacingPercent;

  const pageMarginPx =
    typeof value.pageMarginPx === "number" && Number.isFinite(value.pageMarginPx)
      ? Math.round(clamp(value.pageMarginPx, 0, 40))
      : DEFAULT_READER_PREFERENCES.pageMarginPx;

  const justifyText =
    typeof value.justifyText === "boolean"
      ? value.justifyText
      : DEFAULT_READER_PREFERENCES.justifyText;

  return {
    theme,
    fontSizePx,
    lineHeight,
    contentWidth,
    fontFamily,
    boldText,
    customLayoutEnabled,
    letterSpacingPercent,
    wordSpacingPercent,
    pageMarginPx,
    justifyText,
  };
}

const STORAGE_KEY = "ai-reader-preferences";

export function loadReaderPreferences(): ReaderPreferences {
  if (typeof window === "undefined") return { ...DEFAULT_READER_PREFERENCES };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_READER_PREFERENCES };
    const parsed = JSON.parse(raw);
    return sanitizeReaderPreferences(parsed);
  } catch {
    return { ...DEFAULT_READER_PREFERENCES };
  }
}

export function saveReaderPreferencesToStorage(
  preferences: ReaderPreferences
): void {
  if (typeof window === "undefined") return;
  try {
    const sanitized = sanitizeReaderPreferences(preferences);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  } catch {
    // localStorage unavailable or threw — no-op
  }
}

export function clearReaderPreferencesFromStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable or threw — no-op
  }
}
