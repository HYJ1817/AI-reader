import { describe, expect, it } from "vitest";
import {
  formatBookDate,
  formatBookSize,
} from "./libraryPresentation";

describe("library presentation", () => {
  it("formats bytes for compact book metadata", () => {
    expect(formatBookSize(1024)).toBe("1 KB");
    expect(formatBookSize(1572864)).toBe("1.5 MB");
  });

  it("uses stable labels for missing and invalid dates", () => {
    expect(formatBookDate()).toBe("从未");
    expect(formatBookDate("invalid")).toBe("未知");
  });
});
