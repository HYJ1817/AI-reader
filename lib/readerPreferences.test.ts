import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  DEFAULT_READER_PREFERENCES,
  sanitizeReaderPreferences,
  loadReaderPreferences,
  saveReaderPreferencesToStorage,
  clearReaderPreferencesFromStorage,
  getReaderPreferenceChanges,
  readerPreferenceChangeNeedsMotion,
  shouldObserveSystemReaderTheme,
  updateReaderPreferenceDraft,
} from "./readerPreferences";

const STORAGE_KEY = "ai-reader-preferences";

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
vi.stubGlobal("window", {});

beforeEach(() => {
  store.clear();
});

describe("DEFAULT_READER_PREFERENCES", () => {
  it("has theme system", () => {
    expect(DEFAULT_READER_PREFERENCES.theme).toBe("system");
  });

  it("has fontSizePx 18", () => {
    expect(DEFAULT_READER_PREFERENCES.fontSizePx).toBe(18);
  });

  it("has lineHeight 1.75", () => {
    expect(DEFAULT_READER_PREFERENCES.lineHeight).toBe(1.75);
  });

  it("has contentWidth 720", () => {
    expect(DEFAULT_READER_PREFERENCES.contentWidth).toBe(720);
  });
});

describe("sanitizeReaderPreferences", () => {
  it("returns defaults for null input", () => {
    expect(sanitizeReaderPreferences(null)).toEqual(DEFAULT_READER_PREFERENCES);
  });

  it("returns defaults for undefined input", () => {
    expect(sanitizeReaderPreferences(undefined)).toEqual(
      DEFAULT_READER_PREFERENCES
    );
  });

  it("returns defaults for non-object input", () => {
    expect(sanitizeReaderPreferences("string")).toEqual(
      DEFAULT_READER_PREFERENCES
    );
    expect(sanitizeReaderPreferences(42)).toEqual(DEFAULT_READER_PREFERENCES);
  });

  it("returns defaults for empty object", () => {
    expect(sanitizeReaderPreferences({})).toEqual(DEFAULT_READER_PREFERENCES);
  });

  it("preserves valid theme values", () => {
    for (const theme of ["system", "light", "sepia", "dark"] as const) {
      expect(sanitizeReaderPreferences({ theme }).theme).toBe(theme);
    }
  });

  it("falls back to default theme for invalid value", () => {
    expect(sanitizeReaderPreferences({ theme: "blue" }).theme).toBe("system");
    expect(sanitizeReaderPreferences({ theme: "" }).theme).toBe("system");
    expect(sanitizeReaderPreferences({ theme: 123 }).theme).toBe("system");
  });

  it("preserves valid fontSizePx", () => {
    expect(sanitizeReaderPreferences({ fontSizePx: 20 }).fontSizePx).toBe(20);
  });

  it("clamps fontSizePx below minimum to 14", () => {
    expect(sanitizeReaderPreferences({ fontSizePx: 10 }).fontSizePx).toBe(14);
    expect(sanitizeReaderPreferences({ fontSizePx: 0 }).fontSizePx).toBe(14);
    expect(sanitizeReaderPreferences({ fontSizePx: -5 }).fontSizePx).toBe(14);
  });

  it("clamps fontSizePx above maximum to 28", () => {
    expect(sanitizeReaderPreferences({ fontSizePx: 30 }).fontSizePx).toBe(28);
    expect(sanitizeReaderPreferences({ fontSizePx: 100 }).fontSizePx).toBe(28);
  });

  it("rounds fontSizePx to nearest integer", () => {
    expect(sanitizeReaderPreferences({ fontSizePx: 18.3 }).fontSizePx).toBe(18);
    expect(sanitizeReaderPreferences({ fontSizePx: 18.7 }).fontSizePx).toBe(19);
    expect(sanitizeReaderPreferences({ fontSizePx: 14.5 }).fontSizePx).toBe(15);
  });

  it("falls back fontSizePx for non-number", () => {
    expect(sanitizeReaderPreferences({ fontSizePx: "big" }).fontSizePx).toBe(
      18
    );
    expect(sanitizeReaderPreferences({ fontSizePx: null }).fontSizePx).toBe(18);
  });

  it("preserves valid lineHeight", () => {
    expect(sanitizeReaderPreferences({ lineHeight: 1.5 }).lineHeight).toBe(1.5);
  });

  it("clamps lineHeight below minimum to 1.3", () => {
    expect(sanitizeReaderPreferences({ lineHeight: 1.0 }).lineHeight).toBe(1.3);
    expect(sanitizeReaderPreferences({ lineHeight: 0 }).lineHeight).toBe(1.3);
  });

  it("clamps lineHeight above maximum to 2.2", () => {
    expect(sanitizeReaderPreferences({ lineHeight: 3.0 }).lineHeight).toBe(2.2);
    expect(sanitizeReaderPreferences({ lineHeight: 100 }).lineHeight).toBe(
      2.2
    );
  });

  it("falls back lineHeight for non-number", () => {
    expect(sanitizeReaderPreferences({ lineHeight: "wide" }).lineHeight).toBe(
      1.75
    );
  });

  it("preserves valid contentWidth", () => {
    expect(sanitizeReaderPreferences({ contentWidth: 800 }).contentWidth).toBe(
      800
    );
  });

  it("clamps contentWidth below minimum to 320", () => {
    expect(sanitizeReaderPreferences({ contentWidth: 200 }).contentWidth).toBe(
      320
    );
    expect(sanitizeReaderPreferences({ contentWidth: 0 }).contentWidth).toBe(
      320
    );
  });

  it("clamps contentWidth above maximum to 960", () => {
    expect(
      sanitizeReaderPreferences({ contentWidth: 1000 }).contentWidth
    ).toBe(960);
    expect(
      sanitizeReaderPreferences({ contentWidth: 2000 }).contentWidth
    ).toBe(960);
  });

  it("rounds contentWidth to nearest integer", () => {
    expect(
      sanitizeReaderPreferences({ contentWidth: 720.4 }).contentWidth
    ).toBe(720);
    expect(
      sanitizeReaderPreferences({ contentWidth: 720.6 }).contentWidth
    ).toBe(721);
  });

  it("falls back contentWidth for non-number", () => {
    expect(
      sanitizeReaderPreferences({ contentWidth: "narrow" }).contentWidth
    ).toBe(720);
  });

  it("preserves a full valid object", () => {
    const input = {
      theme: "dark" as const,
      fontSizePx: 22,
      lineHeight: 2.0,
      contentWidth: 800,
    };
    expect(sanitizeReaderPreferences(input)).toEqual(input);
  });
});

describe("loadReaderPreferences", () => {
  it("returns defaults when localStorage is empty", () => {
    expect(loadReaderPreferences()).toEqual(DEFAULT_READER_PREFERENCES);
  });

  it("returns defaults for invalid JSON", () => {
    localStorage.setItem(STORAGE_KEY, "not-json");
    expect(loadReaderPreferences()).toEqual(DEFAULT_READER_PREFERENCES);
  });

  it("sanitizes stored values", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ theme: "dark", fontSizePx: 99 })
    );
    const result = loadReaderPreferences();
    expect(result.theme).toBe("dark");
    expect(result.fontSizePx).toBe(28);
  });

  it("loads a valid stored preferences object", () => {
    const prefs = {
      theme: "sepia",
      fontSizePx: 20,
      lineHeight: 1.8,
      contentWidth: 640,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    expect(loadReaderPreferences()).toEqual(prefs);
  });
});

describe("saveReaderPreferencesToStorage", () => {
  it("saves sanitized preferences to localStorage", () => {
    const prefs = {
      theme: "light" as const,
      fontSizePx: 16,
      lineHeight: 1.5,
      contentWidth: 600,
    };
    saveReaderPreferencesToStorage(prefs);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toEqual(prefs);
  });

  it("sanitizes before saving", () => {
    saveReaderPreferencesToStorage({
      theme: "dark" as const,
      fontSizePx: 99,
      lineHeight: 5,
      contentWidth: 2000,
    });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.fontSizePx).toBe(28);
    expect(stored.lineHeight).toBe(2.2);
    expect(stored.contentWidth).toBe(960);
  });
});

describe("save/load roundtrip", () => {
  it("persists preferences across save and load", () => {
    const prefs = {
      theme: "sepia" as const,
      fontSizePx: 22,
      lineHeight: 1.9,
      contentWidth: 800,
    };
    saveReaderPreferencesToStorage(prefs);
    expect(loadReaderPreferences()).toEqual(prefs);
  });
});

describe("clearReaderPreferencesFromStorage", () => {
  it("removes stored preferences", () => {
    saveReaderPreferencesToStorage(DEFAULT_READER_PREFERENCES);
    clearReaderPreferencesFromStorage();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("is a no-op when nothing is stored", () => {
    clearReaderPreferencesFromStorage();
    expect(loadReaderPreferences()).toEqual(DEFAULT_READER_PREFERENCES);
  });
});

describe("readerPreferenceChangeNeedsMotion", () => {
  it("returns true when typography or theme changes", () => {
    expect(
      readerPreferenceChangeNeedsMotion(DEFAULT_READER_PREFERENCES, {
        ...DEFAULT_READER_PREFERENCES,
        fontSizePx: 20,
      })
    ).toBe(true);
    expect(
      readerPreferenceChangeNeedsMotion(DEFAULT_READER_PREFERENCES, {
        ...DEFAULT_READER_PREFERENCES,
        theme: "sepia",
      })
    ).toBe(true);
  });

  it("returns false when values are unchanged", () => {
    expect(
      readerPreferenceChangeNeedsMotion(
        DEFAULT_READER_PREFERENCES,
        { ...DEFAULT_READER_PREFERENCES }
      )
    ).toBe(false);
  });
});

describe("getReaderPreferenceChanges", () => {
  it("reports only the fields that actually changed", () => {
    expect(
      getReaderPreferenceChanges(DEFAULT_READER_PREFERENCES, {
        ...DEFAULT_READER_PREFERENCES,
        fontSizePx: 21,
        lineHeight: 1.9,
      })
    ).toEqual({
      theme: false,
      fontSizePx: true,
      lineHeight: true,
      contentWidth: false,
    });
  });

  it("reports no changes for equivalent values", () => {
    expect(
      getReaderPreferenceChanges(
        DEFAULT_READER_PREFERENCES,
        { ...DEFAULT_READER_PREFERENCES }
      )
    ).toEqual({
      theme: false,
      fontSizePx: false,
      lineHeight: false,
      contentWidth: false,
    });
  });
});

describe("shouldObserveSystemReaderTheme", () => {
  it("observes system appearance only for the system theme", () => {
    expect(shouldObserveSystemReaderTheme("system")).toBe(true);
    expect(shouldObserveSystemReaderTheme("light")).toBe(false);
    expect(shouldObserveSystemReaderTheme("sepia")).toBe(false);
    expect(shouldObserveSystemReaderTheme("dark")).toBe(false);
  });
});

describe("updateReaderPreferenceDraft", () => {
  it("creates an updated draft without mutating the current preferences", () => {
    const current = { ...DEFAULT_READER_PREFERENCES };
    const next = updateReaderPreferenceDraft(current, "fontSizePx", 22);

    expect(next).toEqual({ ...DEFAULT_READER_PREFERENCES, fontSizePx: 22 });
    expect(current).toEqual(DEFAULT_READER_PREFERENCES);
  });
});

describe("localStorage unavailable (no window)", () => {
  const origWindow = globalThis.window;

  afterEach(() => {
    if (origWindow === undefined) {
      // @ts-expect-error restoring
      delete globalThis.window;
    } else {
      globalThis.window = origWindow;
    }
  });

  it("loadReaderPreferences returns defaults when window is undefined", () => {
    // @ts-expect-error testing missing window
    delete globalThis.window;
    expect(loadReaderPreferences()).toEqual(DEFAULT_READER_PREFERENCES);
  });

  it("saveReaderPreferencesToStorage does not throw when window is undefined", () => {
    // @ts-expect-error testing missing window
    delete globalThis.window;
    expect(() =>
      saveReaderPreferencesToStorage(DEFAULT_READER_PREFERENCES)
    ).not.toThrow();
  });

  it("clearReaderPreferencesFromStorage does not throw when window is undefined", () => {
    // @ts-expect-error testing missing window
    delete globalThis.window;
    expect(() => clearReaderPreferencesFromStorage()).not.toThrow();
  });
});

describe("localStorage methods throw", () => {
  const origGetItem = localStorage.getItem;
  const origSetItem = localStorage.setItem;
  const origRemoveItem = localStorage.removeItem;

  afterEach(() => {
    localStorage.getItem = origGetItem;
    localStorage.setItem = origSetItem;
    localStorage.removeItem = origRemoveItem;
  });

  it("loadReaderPreferences returns defaults if getItem throws", () => {
    localStorage.getItem = () => {
      throw new Error("blocked");
    };
    expect(loadReaderPreferences()).toEqual(DEFAULT_READER_PREFERENCES);
  });

  it("saveReaderPreferencesToStorage does not throw if setItem throws", () => {
    localStorage.setItem = () => {
      throw new Error("blocked");
    };
    expect(() =>
      saveReaderPreferencesToStorage(DEFAULT_READER_PREFERENCES)
    ).not.toThrow();
  });

  it("clearReaderPreferencesFromStorage does not throw if removeItem throws", () => {
    localStorage.removeItem = () => {
      throw new Error("blocked");
    };
    expect(() => clearReaderPreferencesFromStorage()).not.toThrow();
  });
});
