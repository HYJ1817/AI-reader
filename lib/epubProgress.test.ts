import { describe, it, expect } from "vitest";
import { progressPercentFromEpubLocation } from "./epubProgress";

describe("progressPercentFromEpubLocation", () => {
  it("extracts percentage from nested location.start.percentage", () => {
    const location = { start: { percentage: 0.42 } };
    expect(progressPercentFromEpubLocation(location)).toBe(42);
  });

  it("extracts percentage from top-level location.percentage", () => {
    const location = { percentage: 0.75 };
    expect(progressPercentFromEpubLocation(location)).toBe(75);
  });

  it("returns 0 for null", () => {
    expect(progressPercentFromEpubLocation(null)).toBe(0);
  });

  it("returns 0 for undefined", () => {
    expect(progressPercentFromEpubLocation(undefined)).toBe(0);
  });

  it("returns 0 for empty object", () => {
    expect(progressPercentFromEpubLocation({})).toBe(0);
  });

  it("returns 0 for non-object input", () => {
    expect(progressPercentFromEpubLocation("string")).toBe(0);
    expect(progressPercentFromEpubLocation(42)).toBe(0);
  });

  it("clamps negative percentage to 0", () => {
    const location = { start: { percentage: -0.1 } };
    expect(progressPercentFromEpubLocation(location)).toBe(0);
  });

  it("clamps percentage over 100 to 100", () => {
    const location = { start: { percentage: 1.5 } };
    expect(progressPercentFromEpubLocation(location)).toBe(100);
  });

  it("returns 0 for NaN percentage", () => {
    const location = { start: { percentage: NaN } };
    expect(progressPercentFromEpubLocation(location)).toBe(0);
  });

  it("returns 0 for Infinity percentage", () => {
    const location = { start: { percentage: Infinity } };
    expect(progressPercentFromEpubLocation(location)).toBe(0);
  });

  it("returns 0 when percentage is a string", () => {
    const location = { start: { percentage: "0.5" } };
    expect(progressPercentFromEpubLocation(location)).toBe(0);
  });

  it("handles 0% correctly", () => {
    const location = { start: { percentage: 0 } };
    expect(progressPercentFromEpubLocation(location)).toBe(0);
  });

  it("handles 100% correctly", () => {
    const location = { start: { percentage: 1 } };
    expect(progressPercentFromEpubLocation(location)).toBe(100);
  });

  it("prefers nested start.percentage over top-level percentage", () => {
    const location = { percentage: 0.1, start: { percentage: 0.9 } };
    expect(progressPercentFromEpubLocation(location)).toBe(90);
  });

  it("falls back to spine index and displayed page when percentage is absent", () => {
    const location = {
      start: {
        index: 4,
        displayed: { page: 2, total: 4 },
      },
    };
    expect(progressPercentFromEpubLocation(location, 10)).toBe(42);
  });

  it("honors explicit start and end locations in the fallback path", () => {
    expect(
      progressPercentFromEpubLocation(
        { atStart: true, start: { index: 3 } },
        10
      )
    ).toBe(0);
    expect(
      progressPercentFromEpubLocation(
        { atEnd: true, start: { index: 8 } },
        10
      )
    ).toBe(100);
  });

  it("does not invent fallback progress without a valid spine length", () => {
    expect(
      progressPercentFromEpubLocation(
        { start: { index: 4, displayed: { page: 2, total: 4 } } },
        0
      )
    ).toBe(0);
  });
});
