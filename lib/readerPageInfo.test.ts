import { describe, expect, it } from "vitest";
import {
  formatReaderPageLabel,
  formatReaderPageSummary,
  getEpubBookPageInfo,
} from "./readerPageInfo";

describe("reader page status labels", () => {
  it("does not present the EPUB placeholder as a real one-page book", () => {
    const calculating = {
      current: 1,
      total: 1,
      status: "calculating" as const,
    };

    expect(formatReaderPageLabel(calculating)).toBe("正在计算页数…");
    expect(formatReaderPageSummary(calculating)).toBe("正在计算页数…");
  });

  it("reports unavailable page information without false numbers", () => {
    const unavailable = {
      current: 1,
      total: 1,
      status: "unavailable" as const,
    };

    expect(formatReaderPageLabel(unavailable)).toBe("页数未知");
    expect(formatReaderPageSummary(unavailable)).toBe("页数未知");
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
    ).toEqual({ current: 135, total: 480 });
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

  it("converts the generated last CFI location index into a page count", () => {
    expect(
      getEpubBookPageInfo({ start: { location: 287 } }, 900)
    ).toEqual({ current: 288, total: 901 });
  });

  it("accepts a generated table whose only valid index is zero", () => {
    expect(
      getEpubBookPageInfo({ start: { location: 0 } }, 0)
    ).toEqual({ current: 1, total: 1 });
  });

  it("does not fall back to a chapter-local displayed page count", () => {
    expect(
      getEpubBookPageInfo({ start: { displayed: { page: 2, total: 2 } } }, 0)
    ).toBeNull();
    expect(getEpubBookPageInfo({ start: { location: -1 } }, 900)).toBeNull();
    expect(getEpubBookPageInfo(null, 900)).toBeNull();
  });
});
