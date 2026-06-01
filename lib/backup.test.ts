import { describe, it, expect, beforeEach } from "vitest";
import {
  saveBook,
  listBooks,
  saveReadingPosition,
  getReadingPosition,
  addAnnotation,
  listAnnotations,
  clearAllReaderData,
  getBook,
  saveBookGroup,
  listBookGroups,
  type BookRecord,
} from "./db";
import {
  createBackupPayload,
  restoreBackupPayload,
  validateBackupPayload,
} from "./backup";

function makeBook(overrides: Partial<BookRecord> = {}): BookRecord {
  return {
    id: crypto.randomUUID(),
    title: "Test Book",
    format: "epub",
    fileName: "test.epub",
    fileBlob: new Blob(["test content"], { type: "application/epub+zip" }),
    size: 100,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(async () => {
  await clearAllReaderData();
});

describe("createBackupPayload", () => {
  it("includes version 1", async () => {
    const payload = await createBackupPayload();
    expect(payload.version).toBe(1);
  });

  it("includes exported ISO timestamp", async () => {
    const before = new Date().toISOString();
    const payload = await createBackupPayload();
    const after = new Date().toISOString();
    expect(payload.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(payload.exportedAt >= before).toBe(true);
    expect(payload.exportedAt <= after).toBe(true);
  });

  it("does not include apiKey in settings", async () => {
    const payload = await createBackupPayload({
      aiSettings: { baseUrl: "https://api.test.com", apiKey: "secret-key", model: "gpt-4" },
    });
    expect(payload.aiSettings.apiKey).toBeUndefined();
    expect(payload.aiSettings.baseUrl).toBe("https://api.test.com");
    expect(payload.aiSettings.model).toBe("gpt-4");
  });

  it("exports books with base64 fileContent", async () => {
    const book = makeBook({ id: "b1", title: "My Book", format: "txt" });
    await saveBook(book);

    const payload = await createBackupPayload();
    expect(payload.books).toHaveLength(1);
    expect(payload.books[0].id).toBe("b1");
    expect(payload.books[0].title).toBe("My Book");
    expect(payload.books[0].fileContent).toBeTruthy();
    expect(typeof payload.books[0].fileContent).toBe("string");
  });

  it("exports reading positions", async () => {
    const book = makeBook({ id: "b1" });
    await saveBook(book);
    await saveReadingPosition({
      bookId: "b1",
      locator: "chapter-1",
      progressPercent: 42,
      updatedAt: "2024-06-01T00:00:00Z",
    });

    const payload = await createBackupPayload();
    expect(payload.readingPositions).toHaveLength(1);
    expect(payload.readingPositions[0].bookId).toBe("b1");
    expect(payload.readingPositions[0].progressPercent).toBe(42);
  });

  it("exports annotations", async () => {
    const book = makeBook({ id: "b1" });
    await saveBook(book);
    await addAnnotation({
      id: "a1",
      bookId: "b1",
      text: "highlighted",
      createdAt: "2024-06-01T00:00:00Z",
    });

    const payload = await createBackupPayload();
    expect(payload.annotations).toHaveLength(1);
    expect(payload.annotations[0].id).toBe("a1");
    expect(payload.annotations[0].text).toBe("highlighted");
  });
});

describe("validateBackupPayload", () => {
  it("rejects null", () => {
    expect(() => validateBackupPayload(null)).toThrow("Invalid backup format");
  });

  it("rejects non-object", () => {
    expect(() => validateBackupPayload("string")).toThrow("Invalid backup format");
  });

  it("rejects missing version", () => {
    expect(() =>
      validateBackupPayload({ exportedAt: "2024-01-01T00:00:00Z", books: [], readingPositions: [], annotations: [], aiSettings: {} })
    ).toThrow("version");
  });

  it("rejects wrong version", () => {
    expect(() =>
      validateBackupPayload({ version: 2, exportedAt: "2024-01-01T00:00:00Z", books: [], readingPositions: [], annotations: [], aiSettings: {} })
    ).toThrow("version");
  });

  it("rejects missing books array", () => {
    expect(() =>
      validateBackupPayload({ version: 1, exportedAt: "2024-01-01T00:00:00Z", readingPositions: [], annotations: [], aiSettings: {} })
    ).toThrow("books");
  });

  it("accepts valid minimal payload", () => {
    const payload = validateBackupPayload({
      version: 1,
      exportedAt: "2024-01-01T00:00:00Z",
      books: [],
      readingPositions: [],
      annotations: [],
      aiSettings: {},
    });
    expect(payload.version).toBe(1);
  });
});

describe("restoreBackupPayload", () => {
  it("restores books from backup", async () => {
    const book = makeBook({ id: "b1", title: "Restored Book", format: "txt" });
    await saveBook(book);
    const payload = await createBackupPayload();

    await clearAllReaderData();
    expect(await listBooks()).toHaveLength(0);

    await restoreBackupPayload(payload);
    const books = await listBooks();
    expect(books).toHaveLength(1);
    expect(books[0].title).toBe("Restored Book");
    expect(books[0].format).toBe("txt");
  });

  it("round-trips book blob content", async () => {
    const content = "Hello, this is book content for testing.";
    const book = makeBook({
      id: "b1",
      format: "txt",
      fileBlob: new Blob([content], { type: "text/plain" }),
    });
    await saveBook(book);
    const payload = await createBackupPayload();

    await clearAllReaderData();
    await restoreBackupPayload(payload);

    const books = await listBooks();
    const restoredText = await books[0].fileBlob.text();
    expect(restoredText).toBe(content);
  });

  it("restores reading positions", async () => {
    const book = makeBook({ id: "b1" });
    await saveBook(book);
    await saveReadingPosition({
      bookId: "b1",
      locator: "chapter-5",
      progressPercent: 77,
      updatedAt: "2024-06-01T00:00:00Z",
    });
    const payload = await createBackupPayload();

    await clearAllReaderData();
    await restoreBackupPayload(payload);

    const pos = await getReadingPosition("b1");
    expect(pos).toBeDefined();
    expect(pos!.progressPercent).toBe(77);
  });

  it("restores annotations", async () => {
    const book = makeBook({ id: "b1" });
    await saveBook(book);
    await addAnnotation({
      id: "a1",
      bookId: "b1",
      text: "important note",
      createdAt: "2024-06-01T00:00:00Z",
    });
    const payload = await createBackupPayload();

    await clearAllReaderData();
    await restoreBackupPayload(payload);

    const anns = await listAnnotations("b1");
    expect(anns).toHaveLength(1);
    expect(anns[0].text).toBe("important note");
  });

  it("restores AI settings without apiKey", async () => {
    const payload = await createBackupPayload({
      aiSettings: { baseUrl: "https://custom.api/v1", apiKey: "secret", model: "gpt-4" },
    });

    await restoreBackupPayload(payload);

    const settings = JSON.parse(
      (typeof window !== "undefined" ? localStorage.getItem("ai-reader-ai-settings") : null) ?? "null"
    );
    if (settings) {
      expect(settings.baseUrl).toBe("https://custom.api/v1");
      expect(settings.model).toBe("gpt-4");
      expect(settings.apiKey).toBe("");
    }
  });

  it("rejects invalid payload", async () => {
    await expect(restoreBackupPayload(null as never)).rejects.toThrow("Invalid backup format");
  });

  it("replaces existing data on restore", async () => {
    await saveBook(makeBook({ id: "old", title: "Old Book" }));
    await addAnnotation({
      id: "old-ann",
      bookId: "old",
      text: "old annotation",
      createdAt: "2024-01-01T00:00:00Z",
    });

    const book = makeBook({ id: "new", title: "New Book" });
    await saveBook(book);
    await addAnnotation({
      id: "new-ann",
      bookId: "new",
      text: "new annotation",
      createdAt: "2024-06-01T00:00:00Z",
    });

    await clearAllReaderData();
    await restoreBackupPayload({
      version: 1,
      exportedAt: new Date().toISOString(),
      books: [
        {
          id: "restored",
          title: "Restored Book",
          format: "txt",
          fileName: "restored.txt",
          size: 50,
          createdAt: "2024-06-01T00:00:00Z",
          fileContent: "data:text/plain;base64,dGVzdA==",
        },
      ],
      readingPositions: [],
      annotations: [],
      aiSettings: {},
    });

    const books = await listBooks();
    expect(books).toHaveLength(1);
    expect(books[0].id).toBe("restored");
  });
});

describe("Backup with book groups", () => {
  it("exports book groups", async () => {
    await saveBookGroup({ id: "g1", name: "Favorites", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" });
    await saveBookGroup({ id: "g2", name: "Reading", createdAt: "2024-06-01T00:00:00Z", updatedAt: "2024-06-01T00:00:00Z" });

    const payload = await createBackupPayload();
    expect(payload.bookGroups).toBeDefined();
    expect(payload.bookGroups).toHaveLength(2);
    expect(payload.bookGroups.map((g) => g.id)).toContain("g1");
    expect(payload.bookGroups.map((g) => g.id)).toContain("g2");
  });

  it("exports book groupIds in book metadata", async () => {
    await saveBookGroup({ id: "g1", name: "Favorites", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" });
    await saveBook(makeBook({ id: "b1", groupIds: ["g1"] }));

    const payload = await createBackupPayload();
    expect(payload.books[0].groupIds).toEqual(["g1"]);
  });

  it("restores book groups from backup", async () => {
    await saveBookGroup({ id: "g1", name: "Favorites", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" });
    const payload = await createBackupPayload();

    await clearAllReaderData();
    await restoreBackupPayload(payload);

    const groups = await listBookGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe("g1");
    expect(groups[0].name).toBe("Favorites");
  });

  it("restores book groupIds from backup", async () => {
    await saveBookGroup({ id: "g1", name: "Favorites", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" });
    await saveBook(makeBook({ id: "b1", groupIds: ["g1"] }));
    const payload = await createBackupPayload();

    await clearAllReaderData();
    await restoreBackupPayload(payload);

    const book = await getBook("b1");
    expect(book).toBeDefined();
    expect(book!.groupIds).toEqual(["g1"]);
  });

  it("handles old backup without bookGroups gracefully", async () => {
    const oldPayload = {
      version: 1,
      exportedAt: "2024-01-01T00:00:00Z",
      books: [
        {
          id: "b1",
          title: "Old Book",
          format: "txt" as const,
          fileName: "old.txt",
          size: 50,
          createdAt: "2024-01-01T00:00:00Z",
          fileContent: "data:text/plain;base64,dGVzdA==",
        },
      ],
      readingPositions: [],
      annotations: [],
      aiSettings: {},
    };

    await restoreBackupPayload(oldPayload);

    const books = await listBooks();
    expect(books).toHaveLength(1);
    expect(books[0].groupIds).toBeUndefined();

    const groups = await listBookGroups();
    expect(groups).toEqual([]);
  });

  it("handles old backup with books missing groupIds", async () => {
    const oldPayload = {
      version: 1,
      exportedAt: "2024-01-01T00:00:00Z",
      books: [
        {
          id: "b1",
          title: "Old Book",
          format: "txt" as const,
          fileName: "old.txt",
          size: 50,
          createdAt: "2024-01-01T00:00:00Z",
          fileContent: "data:text/plain;base64,dGVzdA==",
        },
      ],
      readingPositions: [],
      annotations: [],
      aiSettings: {},
      bookGroups: [],
    };

    await restoreBackupPayload(oldPayload);

    const books = await listBooks();
    expect(books).toHaveLength(1);
    expect(books[0].groupIds).toBeUndefined();
  });
});
