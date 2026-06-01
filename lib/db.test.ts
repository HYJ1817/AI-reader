import { describe, it, expect, beforeEach } from "vitest";
import {
  saveBook,
  listBooks,
  getBook,
  deleteBook,
  saveReadingPosition,
  getReadingPosition,
  addAnnotation,
  listAnnotations,
  getDailyReadingStat,
  incrementDailyReadingSeconds,
  listDailyReadingStats,
  listBookGroups,
  saveBookGroup,
  deleteBookGroup,
  updateBookGroupName,
  updateBookGroupMembership,
  type BookRecord,
  type ReadingPosition,
  type AnnotationRecord,
  type BookGroup,
} from "./db";

function makeBook(overrides: Partial<BookRecord> = {}): BookRecord {
  return {
    id: crypto.randomUUID(),
    title: "Test Book",
    format: "epub",
    fileName: "test.epub",
    fileBlob: new Blob(["test"], { type: "application/epub+zip" }),
    size: 100,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makePosition(overrides: Partial<ReadingPosition> = {}): ReadingPosition {
  return {
    bookId: "book-1",
    locator: "chapter-1",
    progressPercent: 10,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeAnnotation(overrides: Partial<AnnotationRecord> = {}): AnnotationRecord {
  return {
    id: crypto.randomUUID(),
    bookId: "book-1",
    text: "highlighted text",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(async () => {
  const { clearAllReaderData: clearAll } = await import("./db");
  await clearAll();
});

describe("Book storage", () => {
  it("saves and retrieves a book by id", async () => {
    const book = makeBook({ id: "b1", title: "My Book" });
    await saveBook(book);
    const got = await getBook("b1");
    expect(got).toBeDefined();
    expect(got!.title).toBe("My Book");
  });

  it("returns undefined for missing book", async () => {
    const got = await getBook("nonexistent");
    expect(got).toBeUndefined();
  });

  it("lists books sorted by lastOpenedAt desc then createdAt desc", async () => {
    await saveBook(
      makeBook({
        id: "b1",
        title: "Oldest",
        createdAt: "2024-01-01T00:00:00Z",
      })
    );
    await saveBook(
      makeBook({
        id: "b2",
        title: "Middle",
        createdAt: "2024-06-01T00:00:00Z",
        lastOpenedAt: "2024-07-01T00:00:00Z",
      })
    );
    await saveBook(
      makeBook({
        id: "b3",
        title: "Newest opened",
        createdAt: "2024-03-01T00:00:00Z",
        lastOpenedAt: "2024-08-01T00:00:00Z",
      })
    );

    const books = await listBooks();
    expect(books.map((b) => b.id)).toEqual(["b3", "b2", "b1"]);
  });

  it("deletes a book and cascades to position and annotations", async () => {
    await saveBook(makeBook({ id: "b1" }));
    await saveReadingPosition(makePosition({ bookId: "b1" }));
    await addAnnotation(makeAnnotation({ id: "a1", bookId: "b1" }));
    await addAnnotation(makeAnnotation({ id: "a2", bookId: "b1" }));

    await deleteBook("b1");

    expect(await getBook("b1")).toBeUndefined();
    expect(await getReadingPosition("b1")).toBeUndefined();
    expect(await listAnnotations("b1")).toEqual([]);
  });
});

describe("Reading position", () => {
  it("saves and retrieves reading position", async () => {
    await saveBook(makeBook({ id: "b1" }));
    const pos = makePosition({ bookId: "b1", progressPercent: 42 });
    await saveReadingPosition(pos);

    const got = await getReadingPosition("b1");
    expect(got).toBeDefined();
    expect(got!.progressPercent).toBe(42);
  });

  it("returns undefined for book with no position", async () => {
    const got = await getReadingPosition("no-book");
    expect(got).toBeUndefined();
  });
});

describe("Annotations", () => {
  it("lists annotations sorted by createdAt ascending", async () => {
    await saveBook(makeBook({ id: "b1" }));
    await addAnnotation(
      makeAnnotation({ id: "a2", bookId: "b1", createdAt: "2024-03-01T00:00:00Z" })
    );
    await addAnnotation(
      makeAnnotation({ id: "a1", bookId: "b1", createdAt: "2024-01-01T00:00:00Z" })
    );
    await addAnnotation(
      makeAnnotation({ id: "a3", bookId: "b1", createdAt: "2024-06-01T00:00:00Z" })
    );

    const anns = await listAnnotations("b1");
    expect(anns.map((a) => a.id)).toEqual(["a1", "a2", "a3"]);
  });

  it("returns empty array for book with no annotations", async () => {
    expect(await listAnnotations("no-book")).toEqual([]);
  });
});

describe("Daily reading stats", () => {
  it("returns undefined for date with no stat", async () => {
    const stat = await getDailyReadingStat("2025-01-01");
    expect(stat).toBeUndefined();
  });

  it("increments seconds from zero", async () => {
    await incrementDailyReadingSeconds("2025-01-15", 60);
    const stat = await getDailyReadingStat("2025-01-15");
    expect(stat).toBeDefined();
    expect(stat!.date).toBe("2025-01-15");
    expect(stat!.secondsRead).toBe(60);
    expect(stat!.updatedAt).toBeTruthy();
  });

  it("accumulates seconds on repeated calls", async () => {
    await incrementDailyReadingSeconds("2025-01-15", 30);
    await incrementDailyReadingSeconds("2025-01-15", 45);
    await incrementDailyReadingSeconds("2025-01-15", 15);
    const stat = await getDailyReadingStat("2025-01-15");
    expect(stat!.secondsRead).toBe(90);
  });

  it("ignores zero seconds", async () => {
    await incrementDailyReadingSeconds("2025-01-15", 60);
    await incrementDailyReadingSeconds("2025-01-15", 0);
    const stat = await getDailyReadingStat("2025-01-15");
    expect(stat!.secondsRead).toBe(60);
  });

  it("ignores negative seconds", async () => {
    await incrementDailyReadingSeconds("2025-01-15", 60);
    await incrementDailyReadingSeconds("2025-01-15", -10);
    const stat = await getDailyReadingStat("2025-01-15");
    expect(stat!.secondsRead).toBe(60);
  });

  it("ignores NaN seconds", async () => {
    await incrementDailyReadingSeconds("2025-01-15", 60);
    await incrementDailyReadingSeconds("2025-01-15", NaN);
    const stat = await getDailyReadingStat("2025-01-15");
    expect(stat!.secondsRead).toBe(60);
  });

  it("lists all daily stats", async () => {
    await incrementDailyReadingSeconds("2025-01-14", 30);
    await incrementDailyReadingSeconds("2025-01-15", 60);
    await incrementDailyReadingSeconds("2025-01-16", 90);
    const stats = await listDailyReadingStats();
    expect(stats).toHaveLength(3);
    const dates = stats.map((s) => s.date);
    expect(dates).toContain("2025-01-14");
    expect(dates).toContain("2025-01-15");
    expect(dates).toContain("2025-01-16");
  });

  it("returns empty array when no stats exist", async () => {
    const stats = await listDailyReadingStats();
    expect(stats).toEqual([]);
  });
});

function makeGroup(overrides: Partial<BookGroup> = {}): BookGroup {
  return {
    id: crypto.randomUUID(),
    name: "Test Group",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Book groups", () => {
  it("lists empty groups initially", async () => {
    const groups = await listBookGroups();
    expect(groups).toEqual([]);
  });

  it("saves and lists a group", async () => {
    const group = makeGroup({ id: "g1", name: "Favorites" });
    await saveBookGroup(group);
    const groups = await listBookGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe("g1");
    expect(groups[0].name).toBe("Favorites");
  });

  it("lists groups sorted by createdAt ascending then name ascending", async () => {
    await saveBookGroup(makeGroup({ id: "g2", name: "Zebra", createdAt: "2024-06-01T00:00:00Z" }));
    await saveBookGroup(makeGroup({ id: "g1", name: "Alpha", createdAt: "2024-01-01T00:00:00Z" }));
    await saveBookGroup(makeGroup({ id: "g3", name: "Middle", createdAt: "2024-06-01T00:00:00Z" }));

    const groups = await listBookGroups();
    expect(groups.map((g) => g.id)).toEqual(["g1", "g3", "g2"]);
  });

  it("renames a group", async () => {
    await saveBookGroup(makeGroup({ id: "g1", name: "Old Name" }));
    await updateBookGroupName("g1", "New Name");

    const groups = await listBookGroups();
    expect(groups[0].name).toBe("New Name");
  });

  it("trims group name on rename", async () => {
    await saveBookGroup(makeGroup({ id: "g1", name: "Old" }));
    await updateBookGroupName("g1", "  Trimmed  ");

    const groups = await listBookGroups();
    expect(groups[0].name).toBe("Trimmed");
  });

  it("no-ops rename for empty name", async () => {
    await saveBookGroup(makeGroup({ id: "g1", name: "Keep Me" }));
    await updateBookGroupName("g1", "");

    const groups = await listBookGroups();
    expect(groups[0].name).toBe("Keep Me");
  });

  it("no-ops rename for whitespace-only name", async () => {
    await saveBookGroup(makeGroup({ id: "g1", name: "Keep Me" }));
    await updateBookGroupName("g1", "   ");

    const groups = await listBookGroups();
    expect(groups[0].name).toBe("Keep Me");
  });

  it("deletes a group", async () => {
    await saveBookGroup(makeGroup({ id: "g1", name: "Delete Me" }));
    await deleteBookGroup("g1");

    const groups = await listBookGroups();
    expect(groups).toEqual([]);
  });

  it("removes group id from books on group delete without deleting books", async () => {
    await saveBookGroup(makeGroup({ id: "g1" }));
    await saveBook(makeBook({ id: "b1", groupIds: ["g1"] }));
    await saveBook(makeBook({ id: "b2", groupIds: ["g1", "other"] }));

    await deleteBookGroup("g1");

    const b1 = await getBook("b1");
    const b2 = await getBook("b2");
    expect(b1).toBeDefined();
    expect(b1!.groupIds).toEqual([]);
    expect(b2).toBeDefined();
    expect(b2!.groupIds).toEqual(["other"]);
  });

  it("sets group membership on a book", async () => {
    await saveBook(makeBook({ id: "b1" }));
    await updateBookGroupMembership("b1", ["g1", "g2"]);

    const book = await getBook("b1");
    expect(book!.groupIds).toEqual(["g1", "g2"]);
  });

  it("de-dupes group ids on membership update", async () => {
    await saveBook(makeBook({ id: "b1" }));
    await updateBookGroupMembership("b1", ["g1", "g1", "g2", "g2"]);

    const book = await getBook("b1");
    expect(book!.groupIds).toEqual(["g1", "g2"]);
  });

  it("keeps other book fields unchanged on membership update", async () => {
    await saveBook(makeBook({ id: "b1", title: "My Book", format: "txt", size: 500 }));
    await updateBookGroupMembership("b1", ["g1"]);

    const book = await getBook("b1");
    expect(book!.title).toBe("My Book");
    expect(book!.format).toBe("txt");
    expect(book!.size).toBe(500);
    expect(book!.groupIds).toEqual(["g1"]);
  });

  it("clears book groups on clearAllReaderData", async () => {
    await saveBookGroup(makeGroup({ id: "g1" }));
    const { clearAllReaderData: clearAll } = await import("./db");
    await clearAll();

    const groups = await listBookGroups();
    expect(groups).toEqual([]);
  });
});
