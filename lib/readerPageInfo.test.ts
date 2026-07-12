import { describe, expect, it } from "vitest";
import { getEpubBookPageInfo } from "./readerPageInfo";

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

  it("uses generated whole-book CFI locations when the EPUB has no page-list", () => {
    expect(
      getEpubBookPageInfo({ start: { location: 287 } }, 900)
    ).toEqual({ current: 288, total: 900 });
  });

  it("does not fall back to a chapter-local displayed page count", () => {
    expect(
      getEpubBookPageInfo({ start: { displayed: { page: 2, total: 2 } } }, 0)
    ).toBeNull();
    expect(getEpubBookPageInfo({ start: { location: -1 } }, 900)).toBeNull();
    expect(getEpubBookPageInfo(null, 900)).toBeNull();
  });
});
