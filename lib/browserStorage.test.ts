import { describe, expect, it } from "vitest";
import { hasIndexedDbSupport } from "./browserStorage";

describe("hasIndexedDbSupport", () => {
  it("returns false for missing browser scope", () => {
    expect(hasIndexedDbSupport(undefined)).toBe(false);
    expect(hasIndexedDbSupport(null)).toBe(false);
  });

  it("returns false when indexedDB is missing", () => {
    expect(hasIndexedDbSupport({})).toBe(false);
  });

  it("returns false when indexedDB is unavailable", () => {
    expect(hasIndexedDbSupport({ indexedDB: undefined })).toBe(false);
  });

  it("returns true when indexedDB exists", () => {
    expect(hasIndexedDbSupport({ indexedDB: {} })).toBe(true);
  });
});
