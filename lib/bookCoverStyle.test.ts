import { describe, expect, it } from "vitest";
import {
  createFallbackCoverStyle,
  normalizeCoverTitle,
} from "./bookCoverStyle";

describe("fallback cover style", () => {
  it("returns a stable paper and spine combination", () => {
    const first = createFallbackCoverStyle("百年孤独", "epub");
    const second = createFallbackCoverStyle("百年孤独", "epub");
    expect(first).toEqual(second);
    expect(first.paper).toMatch(/^#[0-9a-f]{6}$/i);
    expect(first.spine).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("normalizes whitespace without losing the title", () => {
    expect(normalizeCoverTitle("  很长的   书名  ")).toBe("很长的 书名");
    expect(normalizeCoverTitle("")).toBe("未命名");
  });
});
