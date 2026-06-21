import { describe, expect, it } from "vitest";
import { getEpubRenditionOptions } from "./epubReaderMode";

describe("getEpubRenditionOptions", () => {
  it("uses continuous scrolling for scroll mode", () => {
    expect(getEpubRenditionOptions("scroll")).toEqual({
      width: "100%",
      height: "100%",
      spread: "none",
      flow: "scrolled",
      manager: "continuous",
      overflow: "auto",
    });
  });

  it("uses single-page pagination for paged mode", () => {
    expect(getEpubRenditionOptions("paged")).toEqual({
      width: "100%",
      height: "100%",
      spread: "none",
      flow: "paginated",
      manager: "default",
      overflow: "hidden",
    });
  });
});
