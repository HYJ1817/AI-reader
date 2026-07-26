import { describe, expect, it } from "vitest";
import {
  formatReaderPageLabel,
  formatReaderPageSummary,
  getAnnotationPageNumber,
  getEpubBookPageInfo,
  normalizeReaderPageInfo,
} from "./readerPageInfo";

describe("reader page status labels", () => {
  it("does not present the EPUB placeholder as a real one-page book", () => {
    const calculating = {
      current: 1,
      total: 1,
      status: "calculating" as const,
    };

    expect(formatReaderPageLabel(calculating)).toBe("正在计算阅读位置…");
    expect(formatReaderPageSummary(calculating)).toBe("正在计算阅读位置…");
  });

  it("reports unavailable page information without false numbers", () => {
    const unavailable = {
      current: 1,
      total: 1,
      status: "unavailable" as const,
    };

    expect(formatReaderPageLabel(unavailable)).toBe("阅读位置未知");
    expect(formatReaderPageSummary(unavailable)).toBe("阅读位置未知");
  });
});

describe("reader page units", () => {
  it("labels generated EPUB indexes as locations instead of pages", () => {
    const location = { current: 288, total: 901, unit: "location" as const };

    expect(formatReaderPageLabel(location)).toBe("位置 288/901");
    expect(formatReaderPageSummary(location)).toBe("位置 288（共 901 个）");
  });

  it("preserves the location unit while normalizing its bounds", () => {
    expect(
      normalizeReaderPageInfo({
        current: 999,
        total: 20,
        unit: "location" as const,
      })
    ).toEqual({ current: 20, total: 20, unit: "location" });
  });

  it("only exposes real pages to annotation records", () => {
    expect(
      getAnnotationPageNumber({ current: 8, total: 20, unit: "page" })
    ).toBe(8);
    expect(
      getAnnotationPageNumber({ current: 8, total: 20, unit: "location" })
    ).toBeUndefined();
  });
});

describe("getEpubBookPageInfo", () => {
  it("uses the EPUB page-list as the whole-book page count when present", () => {
    expect(
      getEpubBookPageInfo(
        { start: { page: 135, location: 42 } },
        900,
        { firstPage: 1, lastPage: 480 }
      )
    ).toEqual({ current: 135, total: 480, unit: "page" });
  });

  it("rejects epub.js empty page-list defaults", () => {
    expect(
      getEpubBookPageInfo(
        { start: { page: -1, location: -1 } },
        0,
        { firstPage: 0, lastPage: 0 }
      )
    ).toBeNull();
  });

  it("converts the generated last CFI index into a whole-book location", () => {
    expect(
      getEpubBookPageInfo({ start: { location: 287 } }, 900)
    ).toEqual({ current: 288, total: 901, unit: "location" });
  });

  it("accepts a generated table whose only valid index is zero", () => {
    expect(
      getEpubBookPageInfo({ start: { location: 0 } }, 0)
    ).toEqual({ current: 1, total: 1, unit: "location" });
  });

  it("does not fall back to a chapter-local displayed page count", () => {
    expect(
      getEpubBookPageInfo({ start: { displayed: { page: 2, total: 2 } } }, 0)
    ).toBeNull();
    expect(getEpubBookPageInfo({ start: { location: -1 } }, 900)).toBeNull();
    expect(getEpubBookPageInfo(null, 900)).toBeNull();
  });
});
