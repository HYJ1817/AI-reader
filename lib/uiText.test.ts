import { describe, it, expect } from "vitest";
import { UI_TEXT } from "./uiText";

const MOJIBAKE_FRAGMENTS = [
  "瀵",
  "璁",
  "涔",
  "鍔",
  "鏇",
  "閫",
  "鐩",
  "涓",
  "绋",
  "鍏",
  "瀹",
  "娴",
  "绫",
  "娣",
  "杩",
  "�",
];

describe("UI_TEXT", () => {
  it("contains Chinese characters for LIBRARY", () => {
    expect(UI_TEXT.LIBRARY).toBe("\u4e66\u5e93");
  });

  it("contains Chinese characters for READING", () => {
    expect(UI_TEXT.READING).toBe("\u9605\u8bfb");
  });

  it("contains Chinese characters for SETTINGS", () => {
    expect(UI_TEXT.SETTINGS).toBe("\u8bbe\u7f6e");
  });

  it("contains Chinese characters for IMPORT", () => {
    expect(UI_TEXT.IMPORT).toBe("\u5bfc\u5165");
  });

  it("contains Chinese characters for NO_BOOKS", () => {
    expect(UI_TEXT.NO_BOOKS).toBe("\u8fd8\u6ca1\u6709\u4e66");
  });

  it("contains Chinese characters for ASK_AI", () => {
    expect(UI_TEXT.ASK_AI).toBe("\u95ee AI");
  });

  it("contains Chinese characters for SAVE", () => {
    expect(UI_TEXT.SAVE).toBe("\u4fdd\u5b58");
  });

  it("contains Chinese characters for BACKUP", () => {
    expect(UI_TEXT.BACKUP).toBe("\u5907\u4efd");
  });

  it("contains Chinese characters for SELECTED_TEXT", () => {
    expect(UI_TEXT.SELECTED_TEXT).toBe("\u5df2\u9009\u6587\u672c");
  });

  it("contains Chinese characters for NO_BOOK_OPEN", () => {
    expect(UI_TEXT.NO_BOOK_OPEN).toBe("\u672a\u6253\u5f00\u4e66\u7c4d");
  });

  it("contains Chinese characters for READER_APPEARANCE", () => {
    expect(UI_TEXT.READER_APPEARANCE).toBe("\u9605\u8bfb\u5916\u89c2");
  });

  it("has no mojibake fragments in any value", () => {
    for (const key of Object.keys(UI_TEXT) as Array<keyof typeof UI_TEXT>) {
      const value = UI_TEXT[key];
      for (const fragment of MOJIBAKE_FRAGMENTS) {
        expect(value, `UI_TEXT.${key} contains mojibake fragment`).not.toContain(fragment);
      }
    }
  });
});
