import { describe, expect, it } from "vitest";
import {
  bookCoverLayoutId,
  getBookTransitionMode,
} from "./sharedBookTransition";

describe("shared book transition", () => {
  it("uses shared motion only for a visible matching source", () => {
    expect(getBookTransitionMode(true, "book-1", "book-1")).toBe("shared");
    expect(getBookTransitionMode(false, "book-1", "book-1")).toBe("fallback");
    expect(getBookTransitionMode(true, "book-1", "book-2")).toBe("fallback");
  });

  it("falls back when there is no registered source", () => {
    expect(getBookTransitionMode(true, null, "book-1")).toBe("fallback");
  });

  it("keeps layout identities stable per rendered origin", () => {
    expect(bookCoverLayoutId("library-grid-book-1")).toBe(
      "book-cover-library-grid-book-1"
    );
  });
});
