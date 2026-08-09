import { describe, expect, it } from "vitest";
import { getBookImportErrorMessage } from "./bookImportError";

describe("book import error copy", () => {
  it("classifies unavailable storage", () => {
    expect(
      getBookImportErrorMessage(new Error("indexeddb-unavailable"))
    ).toContain("本地存储");
  });

  it("classifies quota errors without exposing internals", () => {
    const error = new DOMException("secret path", "QuotaExceededError");
    const message = getBookImportErrorMessage(error);
    expect(message).toContain("空间不足");
    expect(message).not.toContain("secret path");
  });

  it("uses a safe parse fallback", () => {
    expect(getBookImportErrorMessage(new Error("zip stack trace"))).toContain(
      "EPUB 或 TXT"
    );
  });
});
