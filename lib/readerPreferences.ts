export type ReaderTheme = "system" | "light" | "sepia" | "dark";

export interface ReaderPreferences {
  theme: ReaderTheme;
  fontSizePx: number;
  lineHeight: number;
  contentWidth: number;
}

export const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
  theme: "system",
  fontSizePx: 18,
  lineHeight: 1.75,
  contentWidth: 720,
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
  };
}

const VALID_THEMES: ReadonlySet<string> = new Set([
  "system",
  "light",
  "sepia",
  "dark",
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

  return { theme, fontSizePx, lineHeight, contentWidth };
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
