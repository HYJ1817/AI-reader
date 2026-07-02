import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_APP_PREFERENCES,
  loadAppPreferences,
  sanitizeAppPreferences,
  saveAppPreferencesToStorage,
} from "./appPreferences";

const store = new Map<string, string>();

const localStorageMock: Storage = {
  get length() {
    return store.size;
  },
  clear() {
    store.clear();
  },
  getItem(key: string) {
    return store.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    store.set(key, value);
  },
  removeItem(key: string) {
    store.delete(key);
  },
  key(index: number) {
    return [...store.keys()][index] ?? null;
  },
};

vi.stubGlobal("localStorage", localStorageMock);

describe("sanitizeAppPreferences", () => {
  it("keeps valid app preferences", () => {
    expect(
      sanitizeAppPreferences({
        libraryView: "list",
        autoOpenLastBook: true,
        reduceMotion: true,
        keepScreenAwake: true,
        edgeTapToTurn: false,
        swipeToTurn: false,
        backgroundMode: "custom",
        customBackgroundOpacity: 0.65,
      })
    ).toEqual({
      libraryView: "list",
      autoOpenLastBook: true,
      reduceMotion: true,
      keepScreenAwake: true,
      edgeTapToTurn: false,
      swipeToTurn: false,
      backgroundMode: "custom",
      customBackgroundOpacity: 0.65,
    });
  });

  it("falls back to defaults for invalid values", () => {
    expect(
      sanitizeAppPreferences({
        libraryView: "cards",
        autoOpenLastBook: "yes",
        reduceMotion: 1,
        keepScreenAwake: null,
        edgeTapToTurn: "no",
        swipeToTurn: 0,
        backgroundMode: "photo",
        customBackgroundOpacity: 2,
      })
    ).toEqual(DEFAULT_APP_PREFERENCES);
  });

  it("defaults reading gesture preferences on old saved values", () => {
    expect(
      sanitizeAppPreferences({
        libraryView: "list",
        autoOpenLastBook: true,
        reduceMotion: true,
        keepScreenAwake: true,
      })
    ).toEqual({
      libraryView: "list",
      autoOpenLastBook: true,
      reduceMotion: true,
      keepScreenAwake: true,
      edgeTapToTurn: true,
      swipeToTurn: true,
      backgroundMode: "auto",
      customBackgroundOpacity: 1,
    });
  });
});

describe("app preferences storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loads defaults when storage is empty", () => {
    expect(loadAppPreferences()).toEqual(DEFAULT_APP_PREFERENCES);
  });

  it("saves sanitized preferences to localStorage", () => {
    saveAppPreferencesToStorage({
      libraryView: "list",
      autoOpenLastBook: true,
      reduceMotion: true,
      keepScreenAwake: true,
      edgeTapToTurn: false,
      swipeToTurn: false,
      backgroundMode: "custom",
      customBackgroundOpacity: 0.5,
    });

    expect(loadAppPreferences()).toEqual({
      libraryView: "list",
      autoOpenLastBook: true,
      reduceMotion: true,
      keepScreenAwake: true,
      edgeTapToTurn: false,
      swipeToTurn: false,
      backgroundMode: "custom",
      customBackgroundOpacity: 0.5,
    });
  });

  it("recovers from malformed JSON", () => {
    localStorage.setItem("ai-reader-app-preferences", "{broken");

    expect(loadAppPreferences()).toEqual(DEFAULT_APP_PREFERENCES);
  });
});
