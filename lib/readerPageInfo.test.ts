import { describe, expect, it } from "vitest";
import { getEpubPageInfo } from "./readerPageInfo";

describe("getEpubPageInfo", () => {
  it("uses epub.js displayed pagination instead of a synthetic total", () => {
    expect(
      getEpubPageInfo({ start: { displayed: { page: 7, total: 19 } } })
    ).toEqual({ current: 7, total: 19 });
  });

  it("normalizes an out-of-range displayed page", () => {
    expect(
      getEpubPageInfo({ start: { displayed: { page: 32, total: 19 } } })
    ).toEqual({ current: 19, total: 19 });
  });

  it("returns null when epub.js does not expose rendered page data", () => {
    expect(getEpubPageInfo({ start: { displayed: { page: 1 } } })).toBeNull();
    expect(getEpubPageInfo({ start: {} })).toBeNull();
    expect(getEpubPageInfo(null)).toBeNull();
  });
});
