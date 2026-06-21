export type LibraryViewMode = "grid" | "list";

export type AppPreferences = {
  libraryView: LibraryViewMode;
  autoOpenLastBook: boolean;
  reduceMotion: boolean;
  keepScreenAwake: boolean;
  edgeTapToTurn: boolean;
  swipeToTurn: boolean;
};

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  libraryView: "list",
  autoOpenLastBook: false,
  reduceMotion: false,
  keepScreenAwake: false,
  edgeTapToTurn: true,
  swipeToTurn: true,
};

const STORAGE_KEY = "ai-reader-app-preferences";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

export function sanitizeAppPreferences(value: unknown): AppPreferences {
  if (!isRecord(value)) return DEFAULT_APP_PREFERENCES;

  return {
    libraryView:
      value.libraryView === "grid" || value.libraryView === "list"
        ? value.libraryView
        : DEFAULT_APP_PREFERENCES.libraryView,
    autoOpenLastBook:
      typeof value.autoOpenLastBook === "boolean"
        ? value.autoOpenLastBook
        : DEFAULT_APP_PREFERENCES.autoOpenLastBook,
    reduceMotion:
      typeof value.reduceMotion === "boolean"
        ? value.reduceMotion
        : DEFAULT_APP_PREFERENCES.reduceMotion,
    keepScreenAwake:
      typeof value.keepScreenAwake === "boolean"
        ? value.keepScreenAwake
        : DEFAULT_APP_PREFERENCES.keepScreenAwake,
    edgeTapToTurn:
      typeof value.edgeTapToTurn === "boolean"
        ? value.edgeTapToTurn
        : DEFAULT_APP_PREFERENCES.edgeTapToTurn,
    swipeToTurn:
      typeof value.swipeToTurn === "boolean"
        ? value.swipeToTurn
        : DEFAULT_APP_PREFERENCES.swipeToTurn,
  };
}

export function loadAppPreferences(): AppPreferences {
  if (typeof localStorage === "undefined") return DEFAULT_APP_PREFERENCES;

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_APP_PREFERENCES;

  try {
    return sanitizeAppPreferences(JSON.parse(raw));
  } catch {
    return DEFAULT_APP_PREFERENCES;
  }
}

export function saveAppPreferencesToStorage(preferences: AppPreferences): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeAppPreferences(preferences)));
}
