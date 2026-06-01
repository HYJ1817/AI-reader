import { describe, expect, it } from "vitest";
import { buildCollectionListItems } from "./collectionList";

describe("buildCollectionListItems", () => {
  const books = [
    { groupIds: ["g1"] },
    { groupIds: ["g1", "g2"] },
    { groupIds: [] },
    {},
  ];
  const groups = [
    { id: "g1", name: "科幻" },
    { id: "g2", name: "历史" },
  ];

  it("returns all + ungrouped + custom groups in order", () => {
    const items = buildCollectionListItems(books, groups);
    expect(items.map((i) => i.id)).toEqual(["__all", "__ungrouped", "g1", "g2"]);
  });

  it("sets correct filters", () => {
    const items = buildCollectionListItems(books, groups);
    expect(items[0].filter).toBeNull();
    expect(items[1].filter).toBe("__ungrouped");
    expect(items[2].filter).toBe("g1");
    expect(items[3].filter).toBe("g2");
  });

  it("counts all books for the all item", () => {
    const items = buildCollectionListItems(books, groups);
    expect(items[0].count).toBe(4);
  });

  it("counts ungrouped books (empty or missing groupIds)", () => {
    const items = buildCollectionListItems(books, groups);
    expect(items[1].count).toBe(2);
  });

  it("counts books per group", () => {
    const items = buildCollectionListItems(books, groups);
    expect(items[2].count).toBe(2);
    expect(items[3].count).toBe(1);
  });

  it("assigns icon variants", () => {
    const items = buildCollectionListItems(books, groups);
    expect(items[0].icon).toBe("stack");
    expect(items[1].icon).toBe("doc");
    expect(items[2].icon).toBe("folder");
    expect(items[3].icon).toBe("folder");
  });

  it("uses custom labels when provided", () => {
    const items = buildCollectionListItems(books, groups, "全部图书", "未整理");
    expect(items[0].name).toBe("全部图书");
    expect(items[1].name).toBe("未整理");
  });

  it("uses default Chinese labels", () => {
    const items = buildCollectionListItems(books, groups);
    expect(items[0].name).toBe("全部");
    expect(items[1].name).toBe("未分组");
  });

  it("handles empty books", () => {
    const items = buildCollectionListItems([], groups);
    expect(items[0].count).toBe(0);
    expect(items[1].count).toBe(0);
    expect(items[2].count).toBe(0);
  });

  it("handles empty groups", () => {
    const items = buildCollectionListItems(books, []);
    expect(items.map((i) => i.id)).toEqual(["__all", "__ungrouped"]);
  });

  it("handles books with undefined groupIds as ungrouped", () => {
    const items = buildCollectionListItems([{}, { groupIds: undefined }], []);
    expect(items[1].count).toBe(2);
  });
});
