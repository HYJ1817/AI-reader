import { createLocalId } from "./localId";

export type LibraryViewMode = "grid" | "list";
export type BackgroundMode = "auto" | "custom";

export type AppPreferences = {
  autoAiMetadata: boolean;
  libraryView: LibraryViewMode;
  autoOpenLastBook: boolean;
  reduceMotion: boolean;
  keepScreenAwake: boolean;
  edgeTapToTurn: boolean;
  swipeToTurn: boolean;
  backgroundMode: BackgroundMode;
  customBackgroundOpacity: number;
};

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  autoAiMetadata: false,
  libraryView: "list",
  autoOpenLastBook: false,
  reduceMotion: false,
  keepScreenAwake: false,
  edgeTapToTurn: true,
  swipeToTurn: true,
  backgroundMode: "auto",
  customBackgroundOpacity: 1,
};

const STORAGE_KEY = "ai-reader-app-preferences";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

export function sanitizeAppPreferences(value: unknown): AppPreferences {
  if (!isRecord(value)) return DEFAULT_APP_PREFERENCES;

  return {
    autoAiMetadata: value.autoAiMetadata === true,
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
    backgroundMode:
      value.backgroundMode === "auto" || value.backgroundMode === "custom"
        ? value.backgroundMode
        : DEFAULT_APP_PREFERENCES.backgroundMode,
    customBackgroundOpacity:
      typeof value.customBackgroundOpacity === "number" &&
      Number.isFinite(value.customBackgroundOpacity) &&
      value.customBackgroundOpacity >= 0 &&
      value.customBackgroundOpacity <= 1
        ? value.customBackgroundOpacity
        : DEFAULT_APP_PREFERENCES.customBackgroundOpacity,
  };
}

export function loadAppPreferences(): AppPreferences {
  if (typeof localStorage === "undefined") return DEFAULT_APP_PREFERENCES;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APP_PREFERENCES;
    return sanitizeAppPreferences(JSON.parse(raw));
  } catch {
    return DEFAULT_APP_PREFERENCES;
  }
}

export function saveAppPreferencesToStorage(preferences: AppPreferences): void {
  if (typeof localStorage === "undefined") return;
  try {
    const previous = readAutoAiMetadataAuthorization();
    const revision = previous.allowed === preferences.autoAiMetadata
      ? previous.revision : createLocalId();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...sanitizeAppPreferences(preferences), autoAiMetadataRevision: revision })
    );
  } catch {
    // Storage can be unavailable in private browsing or when its quota is full.
  }
}

function readAutoAiMetadataAuthorization() {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return { allowed: isRecord(raw) && raw.autoAiMetadata === true,
      revision: isRecord(raw) && typeof raw.autoAiMetadataRevision === "string" ? raw.autoAiMetadataRevision : "legacy" };
  } catch { return { allowed: false, revision: "unavailable" }; }
}

// An off/on cycle grants future work permission, never revives a revoked task.
export function captureAutoAiMetadataAuthorization(): () => boolean {
  const initial = readAutoAiMetadataAuthorization();
  return () => {
    const current = readAutoAiMetadataAuthorization();
    return initial.allowed && current.allowed && current.revision === initial.revision;
  };
}
