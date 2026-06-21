import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  DEFAULT_READING_TARGET_MINUTES,
  loadReadingGoal,
  saveReadingGoalToStorage,
  getLocalDateKey,
  formatReadingMinutes,
  shouldPublishReadingSeconds,
} from "./readingGoal";

const storage = new Map<string, string>();

vi.stubGlobal("localStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, String(value)); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => { storage.clear(); },
});
vi.stubGlobal("window", {});

beforeEach(() => {
  storage.clear();
});

describe("DEFAULT_READING_TARGET_MINUTES", () => {
  it("is 120", () => {
    expect(DEFAULT_READING_TARGET_MINUTES).toBe(120);
  });
});

describe("getLocalDateKey", () => {
  it("returns YYYY-MM-DD in local time for a given date", () => {
    const d = new Date(2025, 0, 15, 10, 30, 0);
    expect(getLocalDateKey(d)).toBe("2025-01-15");
  });

  it("returns today's date when called with no argument", () => {
    const result = getLocalDateKey();
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(result).toBe(expected);
  });

  it("handles end of month correctly", () => {
    const d = new Date(2025, 1, 28, 23, 59, 59);
    expect(getLocalDateKey(d)).toBe("2025-02-28");
  });

  it("handles start of year correctly", () => {
    const d = new Date(2025, 0, 1, 0, 0, 0);
    expect(getLocalDateKey(d)).toBe("2025-01-01");
  });
});

describe("formatReadingMinutes", () => {
  it("returns 0 for 0 seconds", () => {
    expect(formatReadingMinutes(0)).toBe(0);
  });

  it("returns floor of seconds/60", () => {
    expect(formatReadingMinutes(120)).toBe(2);
  });

  it("floors partial minutes", () => {
    expect(formatReadingMinutes(89)).toBe(1);
  });

  it("returns 0 for negative input", () => {
    expect(formatReadingMinutes(-10)).toBe(0);
  });

  it("returns 0 for NaN", () => {
    expect(formatReadingMinutes(NaN)).toBe(0);
  });

  it("handles large values", () => {
    expect(formatReadingMinutes(3600)).toBe(60);
  });
});

describe("shouldPublishReadingSeconds", () => {
  it("publishes only when the displayed minute changes", () => {
    expect(shouldPublishReadingSeconds(60, 61)).toBe(false);
    expect(shouldPublishReadingSeconds(60, 119)).toBe(false);
    expect(shouldPublishReadingSeconds(119, 120)).toBe(true);
  });

  it("publishes a reset or correction that changes the displayed minute", () => {
    expect(shouldPublishReadingSeconds(3600, 0)).toBe(true);
  });
});

describe("saveReadingGoalToStorage", () => {
  it("saves valid goal", () => {
    saveReadingGoalToStorage({ targetMinutes: 60 });
    const goal = loadReadingGoal();
    expect(goal.targetMinutes).toBe(60);
  });

  it("clamps targetMinutes to minimum 1", () => {
    saveReadingGoalToStorage({ targetMinutes: 0 });
    const goal = loadReadingGoal();
    expect(goal.targetMinutes).toBe(1);
  });

  it("clamps targetMinutes to maximum 1440", () => {
    saveReadingGoalToStorage({ targetMinutes: 2000 });
    const goal = loadReadingGoal();
    expect(goal.targetMinutes).toBe(1440);
  });

  it("converts float to integer", () => {
    saveReadingGoalToStorage({ targetMinutes: 90.7 });
    const goal = loadReadingGoal();
    expect(goal.targetMinutes).toBe(90);
  });

  it("falls back to 120 for NaN", () => {
    saveReadingGoalToStorage({ targetMinutes: NaN });
    const goal = loadReadingGoal();
    expect(goal.targetMinutes).toBe(120);
  });

  it("falls back to 1 for negative", () => {
    saveReadingGoalToStorage({ targetMinutes: -5 });
    const goal = loadReadingGoal();
    expect(goal.targetMinutes).toBe(1);
  });
});

describe("loadReadingGoal", () => {
  it("returns default 120 when nothing stored", () => {
    const goal = loadReadingGoal();
    expect(goal.targetMinutes).toBe(120);
  });

  it("returns stored goal", () => {
    saveReadingGoalToStorage({ targetMinutes: 90 });
    const goal = loadReadingGoal();
    expect(goal.targetMinutes).toBe(90);
  });

  it("returns default for invalid stored JSON", () => {
    storage.set("ai-reader-reading-goal", "not-json");
    const goal = loadReadingGoal();
    expect(goal.targetMinutes).toBe(120);
  });

  it("returns default for invalid targetMinutes in storage", () => {
    storage.set(
      "ai-reader-reading-goal",
      JSON.stringify({ targetMinutes: "bad" })
    );
    const goal = loadReadingGoal();
    expect(goal.targetMinutes).toBe(120);
  });
});
