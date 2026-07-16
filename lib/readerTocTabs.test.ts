import { describe, expect, it } from "vitest";
import {
  READER_TOC_TABS,
  getNearestReaderTocTabIndex,
  getReaderTocTabScrollLeft,
} from "./readerTocTabs";

describe("reader contents tabs", () => {
  it("keeps a stable chapter, bookmark, and highlight order", () => {
    expect(READER_TOC_TABS).toEqual(["chapters", "bookmarks", "highlights"]);
  });

  it("maps clamped tab indexes to viewport offsets", () => {
    expect(getReaderTocTabScrollLeft(2, 390)).toBe(780);
    expect(getReaderTocTabScrollLeft(8, 390)).toBe(780);
    expect(getReaderTocTabScrollLeft(-2, 390)).toBe(0);
    expect(getReaderTocTabScrollLeft(1, -100)).toBe(0);
  });

  it("selects the nearest page from a native scroll offset", () => {
    expect(getNearestReaderTocTabIndex(210, 390)).toBe(1);
    expect(getNearestReaderTocTabIndex(760, 390)).toBe(2);
    expect(getNearestReaderTocTabIndex(100, 0)).toBe(0);
  });
});
