import { describe, expect, it } from "vitest";
import {
  pruneSelectedBookIds,
  selectAllBookIds,
  toggleBookSelection,
} from "./librarySelection";

describe("toggleBookSelection", () => {
  it("selects an unselected book id", () => {
    expect(toggleBookSelection(["b1"], "b2")).toEqual(["b1", "b2"]);
  });

  it("removes an already selected book id", () => {
    expect(toggleBookSelection(["b1", "b2"], "b1")).toEqual(["b2"]);
  });

  it("does not duplicate ids", () => {
    expect(toggleBookSelection(["b1", "b1"], "b2")).toEqual(["b1", "b2"]);
  });
});

describe("pruneSelectedBookIds", () => {
  it("keeps selection order while removing ids missing from the visible book list", () => {
    expect(pruneSelectedBookIds(["b3", "b1", "missing"], ["b1", "b2", "b3"])).toEqual([
      "b3",
      "b1",
    ]);
  });
});

describe("selectAllBookIds", () => {
  it("returns all visible ids in order", () => {
    expect(selectAllBookIds(["b1", "b2"], ["b3", "b4"])).toEqual([
      "b1",
      "b2",
      "b3",
      "b4",
    ]);
  });

  it("deduplicates ids", () => {
    expect(selectAllBookIds(["b1", "b2"], ["b2", "b3"])).toEqual([
      "b1",
      "b2",
      "b3",
    ]);
  });
});
