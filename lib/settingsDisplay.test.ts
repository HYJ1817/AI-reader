import { describe, expect, it } from "vitest";
import {
  SETTINGS_APP_VERSION,
  formatAiStatus,
  formatSettingsBookCount,
  formatSettingsReadingMinutes,
} from "./settingsDisplay";

describe("SETTINGS_APP_VERSION", () => {
  it("is a non-empty string", () => {
    expect(typeof SETTINGS_APP_VERSION).toBe("string");
    expect(SETTINGS_APP_VERSION.length).toBeGreaterThan(0);
  });
});

describe("formatAiStatus", () => {
  it("returns configured text when true", () => {
    expect(formatAiStatus(true)).toBe("\u5df2\u914d\u7f6e");
  });

  it("returns unconfigured text when false", () => {
    expect(formatAiStatus(false)).toBe("\u672a\u914d\u7f6e");
  });
});

describe("formatSettingsBookCount", () => {
  it("formats a normal count", () => {
    expect(formatSettingsBookCount(5)).toBe("5 \u672c\u56fe\u4e66");
    expect(formatSettingsBookCount(0)).toBe("0 \u672c\u56fe\u4e66");
    expect(formatSettingsBookCount(100)).toBe("100 \u672c\u56fe\u4e66");
    expect(formatSettingsBookCount(5.8)).toBe("5 \u672c\u56fe\u4e66");
  });

  it("handles invalid values", () => {
    expect(formatSettingsBookCount(-1)).toBe("0 \u672c\u56fe\u4e66");
    expect(formatSettingsBookCount(Number.NaN)).toBe("0 \u672c\u56fe\u4e66");
    expect(formatSettingsBookCount(Number.POSITIVE_INFINITY)).toBe("0 \u672c\u56fe\u4e66");
  });
});

describe("formatSettingsReadingMinutes", () => {
  it("formats a normal value", () => {
    expect(formatSettingsReadingMinutes(30)).toBe("30 \u5206\u949f");
    expect(formatSettingsReadingMinutes(0)).toBe("0 \u5206\u949f");
    expect(formatSettingsReadingMinutes(30.9)).toBe("30 \u5206\u949f");
  });

  it("handles invalid values", () => {
    expect(formatSettingsReadingMinutes(-5)).toBe("0 \u5206\u949f");
    expect(formatSettingsReadingMinutes(Number.NaN)).toBe("0 \u5206\u949f");
  });
});
