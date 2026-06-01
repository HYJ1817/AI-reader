import { describe, it, expect } from "vitest";
import { normalizeProgressPercent } from "./readerProgress";

describe("normalizeProgressPercent", () => {
  it("returns 0 for null", () => {
    expect(normalizeProgressPercent(null)).toBe(0);
  });

  it("returns 0 for undefined", () => {
    expect(normalizeProgressPercent(undefined)).toBe(0);
  });

  it("returns 0 for string", () => {
    expect(normalizeProgressPercent("50")).toBe(0);
  });

  it("returns 0 for boolean", () => {
    expect(normalizeProgressPercent(true)).toBe(0);
  });

  it("returns 0 for object", () => {
    expect(normalizeProgressPercent({})).toBe(0);
  });

  it("returns 0 for NaN", () => {
    expect(normalizeProgressPercent(NaN)).toBe(0);
  });

  it("returns 0 for Infinity", () => {
    expect(normalizeProgressPercent(Infinity)).toBe(0);
  });

  it("returns 0 for -Infinity", () => {
    expect(normalizeProgressPercent(-Infinity)).toBe(0);
  });

  it("clamps negative to 0", () => {
    expect(normalizeProgressPercent(-10)).toBe(0);
  });

  it("clamps over 100 to 100", () => {
    expect(normalizeProgressPercent(150)).toBe(100);
  });

  it("rounds decimal to nearest integer", () => {
    expect(normalizeProgressPercent(45.6)).toBe(46);
    expect(normalizeProgressPercent(45.4)).toBe(45);
    expect(normalizeProgressPercent(45.5)).toBe(46);
  });

  it("handles 0 correctly", () => {
    expect(normalizeProgressPercent(0)).toBe(0);
  });

  it("handles 100 correctly", () => {
    expect(normalizeProgressPercent(100)).toBe(100);
  });

  it("handles valid integer in range", () => {
    expect(normalizeProgressPercent(50)).toBe(50);
  });
});
