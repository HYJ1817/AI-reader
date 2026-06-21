import { describe, it, expect } from "vitest";
import {
  chunkParagraphs,
  getHorizontalPageInfo,
  parseTxtParagraphs,
  progressFromHorizontalScroll,
  progressFromScroll,
  scrollLeftFromProgress,
  scrollTopFromProgress,
} from "./txtReader";

describe("chunkParagraphs", () => {
  it("groups paragraphs into stable rendering chunks", () => {
    expect(chunkParagraphs(["a", "b", "c", "d", "e"], 2)).toEqual([
      ["a", "b"],
      ["c", "d"],
      ["e"],
    ]);
  });

  it("uses a safe chunk size for invalid input", () => {
    expect(chunkParagraphs(["a", "b"], 0)).toEqual([["a", "b"]]);
  });
});

describe("parseTxtParagraphs", () => {
  it("normalizes CRLF to LF and splits on blank lines", () => {
    const input = "Para one.\r\n\r\nPara two.\r\n\r\nPara three.";
    expect(parseTxtParagraphs(input)).toEqual([
      "Para one.",
      "Para two.",
      "Para three.",
    ]);
  });

  it("normalizes CR-only to LF and splits on blank lines", () => {
    const input = "Para one.\r\rPara two.";
    expect(parseTxtParagraphs(input)).toEqual(["Para one.", "Para two."]);
  });

  it("splits on multiple blank lines", () => {
    const input = "Para one.\n\n\n\nPara two.";
    expect(parseTxtParagraphs(input)).toEqual(["Para one.", "Para two."]);
  });

  it("trims whitespace from each paragraph", () => {
    const input = "  Para one.  \n\n  Para two.  ";
    expect(parseTxtParagraphs(input)).toEqual(["Para one.", "Para two."]);
  });

  it("removes empty paragraphs", () => {
    const input = "Para one.\n\n   \n\nPara two.";
    expect(parseTxtParagraphs(input)).toEqual(["Para one.", "Para two."]);
  });

  it("falls back to splitting by lines when no blank-line paragraphs exist", () => {
    const input = "Line one.\nLine two.\nLine three.";
    expect(parseTxtParagraphs(input)).toEqual([
      "Line one.",
      "Line two.",
      "Line three.",
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(parseTxtParagraphs("")).toEqual([]);
  });

  it("returns empty array for whitespace-only input", () => {
    expect(parseTxtParagraphs("   \n\n   ")).toEqual([]);
  });

  it("filters out empty lines in line-fallback mode", () => {
    const input = "Line one.\n\nLine two.\n";
    // Has blank line, so blank-line mode applies
    expect(parseTxtParagraphs(input)).toEqual(["Line one.", "Line two."]);
  });

  it("handles single paragraph with no blank lines", () => {
    const input = "Just one line.";
    expect(parseTxtParagraphs(input)).toEqual(["Just one line."]);
  });
});

describe("progressFromScroll", () => {
  it("returns 0 when not scrollable (scrollHeight <= clientHeight)", () => {
    expect(progressFromScroll(0, 500, 500)).toBe(0);
    expect(progressFromScroll(0, 400, 500)).toBe(0);
  });

  it("returns integer percent 0..100", () => {
    expect(progressFromScroll(0, 1000, 500)).toBe(0);
    expect(progressFromScroll(250, 1000, 500)).toBe(50);
    expect(progressFromScroll(500, 1000, 500)).toBe(100);
  });

  it("clamps values below 0", () => {
    expect(progressFromScroll(-100, 1000, 500)).toBe(0);
  });

  it("clamps values above 100", () => {
    expect(progressFromScroll(600, 1000, 500)).toBe(100);
  });

  it("returns integer (floors)", () => {
    expect(progressFromScroll(123, 1000, 500)).toBe(24);
  });
});

describe("scrollTopFromProgress", () => {
  it("returns correct scroll position", () => {
    expect(scrollTopFromProgress(0, 1000, 500)).toBe(0);
    expect(scrollTopFromProgress(50, 1000, 500)).toBe(250);
    expect(scrollTopFromProgress(100, 1000, 500)).toBe(500);
  });

  it("clamps progress below 0", () => {
    expect(scrollTopFromProgress(-10, 1000, 500)).toBe(0);
  });

  it("clamps progress above 100", () => {
    expect(scrollTopFromProgress(150, 1000, 500)).toBe(500);
  });

  it("returns 0 when not scrollable", () => {
    expect(scrollTopFromProgress(50, 500, 500)).toBe(0);
    expect(scrollTopFromProgress(50, 400, 500)).toBe(0);
  });
});

describe("horizontal pagination", () => {
  it("maps horizontal scrolling to normalized progress", () => {
    expect(progressFromHorizontalScroll(0, 1350, 450)).toBe(0);
    expect(progressFromHorizontalScroll(450, 1350, 450)).toBe(50);
    expect(progressFromHorizontalScroll(900, 1350, 450)).toBe(100);
  });

  it("maps normalized progress back to horizontal scrolling", () => {
    expect(scrollLeftFromProgress(0, 1350, 450)).toBe(0);
    expect(scrollLeftFromProgress(50, 1350, 450)).toBe(450);
    expect(scrollLeftFromProgress(100, 1350, 450)).toBe(900);
  });

  it("reports current and total horizontal pages", () => {
    expect(getHorizontalPageInfo(450, 1350, 450)).toEqual({
      current: 2,
      total: 3,
    });
    expect(getHorizontalPageInfo(0, 300, 450)).toEqual({
      current: 1,
      total: 1,
    });
  });

  it("handles invalid and clamped horizontal values", () => {
    expect(progressFromHorizontalScroll(-50, 1350, 450)).toBe(0);
    expect(progressFromHorizontalScroll(1200, 1350, 450)).toBe(100);
    expect(scrollLeftFromProgress(150, 1350, 450)).toBe(900);
    expect(getHorizontalPageInfo(0, 1350, 0)).toEqual({
      current: 1,
      total: 1,
    });
  });
});
