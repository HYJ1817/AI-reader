import { describe, expect, it } from "vitest";
import { getReaderTapAction } from "./readerTapZones";

describe("getReaderTapAction", () => {
  it("returns prev for taps in the left edge zone", () => {
    expect(getReaderTapAction({ clientX: 20, left: 0, width: 300 })).toBe("prev");
  });

  it("returns next for taps in the right edge zone", () => {
    expect(getReaderTapAction({ clientX: 284, left: 0, width: 300 })).toBe("next");
  });

  it("returns chrome for taps in the middle zone", () => {
    expect(getReaderTapAction({ clientX: 150, left: 0, width: 300 })).toBe("chrome");
  });

  it("uses the element left offset", () => {
    expect(getReaderTapAction({ clientX: 130, left: 100, width: 300 })).toBe("prev");
    expect(getReaderTapAction({ clientX: 370, left: 100, width: 300 })).toBe("next");
  });

  it("falls back to chrome for invalid dimensions", () => {
    expect(getReaderTapAction({ clientX: 10, left: 0, width: 0 })).toBe("chrome");
    expect(getReaderTapAction({ clientX: 10, left: 0, width: Number.NaN })).toBe("chrome");
  });
});
