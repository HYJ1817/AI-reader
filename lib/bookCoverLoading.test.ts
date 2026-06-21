import { describe, expect, it } from "vitest";
import { shouldLoadBookCover } from "./bookCoverLoading";

describe("shouldLoadBookCover", () => {
  it("does not request a cover when the book has no cover blob", () => {
    expect(
      shouldLoadBookCover({
        hasCoverBlob: false,
        observerSupported: true,
        nearViewport: true,
      })
    ).toBe(false);
  });

  it("defers cover work until an observed book is near the viewport", () => {
    expect(
      shouldLoadBookCover({
        hasCoverBlob: true,
        observerSupported: true,
        nearViewport: false,
      })
    ).toBe(false);
    expect(
      shouldLoadBookCover({
        hasCoverBlob: true,
        observerSupported: true,
        nearViewport: true,
      })
    ).toBe(true);
  });

  it("loads immediately when IntersectionObserver is unavailable", () => {
    expect(
      shouldLoadBookCover({
        hasCoverBlob: true,
        observerSupported: false,
        nearViewport: false,
      })
    ).toBe(true);
  });
});
