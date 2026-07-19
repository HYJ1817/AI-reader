import { expect, it } from "vitest";
import {
  findBookmarkAtSnapshot,
  partitionAnnotations,
  upsertHighlightRecord,
} from "./readerAnnotations";
import type { AnnotationRecord } from "./db";

const records: AnnotationRecord[] = [
  {
    id: "b1",
    bookId: "book",
    kind: "bookmark",
    locator: "cfi-1",
    text: "one",
    createdAt: "1",
  },
  {
    id: "h1",
    bookId: "book",
    kind: "highlight",
    locator: "range-1",
    text: "two",
    color: "yellow",
    createdAt: "2",
  },
];

it("partitions annotation kinds", () => {
  expect(partitionAnnotations(records)).toEqual({
    bookmarks: [records[0]],
    highlights: [records[1]],
  });
});

it("finds the bookmark at the current locator", () => {
  expect(
    findBookmarkAtSnapshot(records, {
      locator: "cfi-1",
      text: "",
      progressPercent: 0,
    })
  ).toBe(records[0]);
});

it("recolors the same range without duplicating it", () => {
  const result = upsertHighlightRecord(records, {
    ...records[1],
    id: "new",
    color: "blue",
    createdAt: "3",
  });
  expect(result).toHaveLength(2);
  expect(result[1]).toEqual(
    expect.objectContaining({ id: "h1", color: "blue", createdAt: "2" })
  );
});
