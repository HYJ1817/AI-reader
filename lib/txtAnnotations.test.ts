import { expect, it, vi } from "vitest";
import type { AnnotationRecord } from "./db";
import {
  buildTxtHighlightRuns,
  navigateToTxtLocator,
  parseTxtLocator,
  serializeTxtLocator,
} from "./txtAnnotations";

it("round trips a versioned range locator", () => {
  const locator = {
    version: 1 as const,
    type: "range" as const,
    startParagraph: 2,
    startOffset: 3,
    endParagraph: 3,
    endOffset: 4,
  };
  expect(parseTxtLocator(serializeTxtLocator(locator))).toEqual(locator);
});

it("rejects malformed and negative locators", () => {
  expect(parseTxtLocator("txt:v1:{bad json")).toBeNull();
  expect(
    parseTxtLocator(
      'txt:v1:{"version":1,"type":"point","paragraph":-1,"offset":0}'
    )
  ).toBeNull();
});

it("splits marked and unmarked text runs", () => {
  const locator = serializeTxtLocator({
    version: 1,
    type: "range",
    startParagraph: 2,
    startOffset: 2,
    endParagraph: 2,
    endOffset: 5,
  });
  const highlight: AnnotationRecord = {
    id: "h1",
    bookId: "book",
    kind: "highlight",
    locator,
    text: "cde",
    color: "green",
    createdAt: "1",
  };
  expect(buildTxtHighlightRuns(2, "abcdefgh", [highlight])).toEqual([
    { text: "ab" },
    { text: "cde", annotationId: "h1", color: "green" },
    { text: "fgh" },
  ]);
});

it("marks every paragraph covered by a multi-paragraph selection", () => {
  const locator = serializeTxtLocator({
    version: 1,
    type: "range",
    startParagraph: 1,
    startOffset: 2,
    endParagraph: 3,
    endOffset: 3,
  });
  const highlight: AnnotationRecord = {
    id: "h1",
    bookId: "book",
    kind: "highlight",
    locator,
    text: "selection",
    color: "blue",
    createdAt: "1",
  };
  expect(buildTxtHighlightRuns(2, "middle", [highlight])).toEqual([
    { text: "middle", annotationId: "h1", color: "blue" },
  ]);
});

it("navigates to a paragraph in paged mode", () => {
  const scrollTo = vi.fn();
  const target = {
    getBoundingClientRect: () => ({ left: 320, top: 0 }),
  };
  const reader = {
    scrollLeft: 100,
    scrollTop: 0,
    scrollWidth: 1000,
    scrollHeight: 1000,
    clientWidth: 300,
    clientHeight: 500,
    getBoundingClientRect: () => ({ left: 20, top: 0 }),
    querySelector: () => target,
    scrollTo,
  } as unknown as HTMLElement;

  expect(
    navigateToTxtLocator(
      reader,
      serializeTxtLocator({ version: 1, type: "point", paragraph: 2, offset: 0 }),
      "paged",
      0,
      true
    )
  ).toBe(true);
  expect(scrollTo).toHaveBeenCalledWith({ left: 400, behavior: "auto" });
});
