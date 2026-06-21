import { describe, expect, it } from "vitest";
import { sanitizeReaderMode } from "./readerMode";

describe("sanitizeReaderMode", () => {
  it("accepts supported modes", () => {
    expect(sanitizeReaderMode("scroll")).toBe("scroll");
    expect(sanitizeReaderMode("paged")).toBe("paged");
  });

  it("defaults missing or invalid values to scroll", () => {
    expect(sanitizeReaderMode(undefined)).toBe("scroll");
    expect(sanitizeReaderMode("invalid")).toBe("scroll");
    expect(sanitizeReaderMode(null)).toBe("scroll");
  });
});
