import { describe, it, expect, beforeEach, vi } from "vitest";
import Dexie from "dexie";
import {
  saveBook,
  saveBookCover,
  loadMissingBookCover,
  listBooks,
  listBookMetadata,
  getBookFile,
  getBook,
  deleteBook,
  saveReadingPosition,
  getReadingPosition,
  addAnnotation,
  deleteAnnotation,
  listAnnotations,
  getDailyReadingStat,
  incrementDailyReadingSeconds,
  listDailyReadingStats,
  listBookGroups,
  saveBookGroup,
  deleteBookGroup,
  updateBookGroupName,
  updateBookGroupMembership,
  updateBookLastOpenedAt,
  renameBook,
  saveCustomBackgroundImage,
  getCustomBackgroundImage,
  deleteCustomBackgroundImage,
  ensureDefaultBookWorkspace,
  getReadingWorkspace,
  listWorkspaceBooks,
  attachBookToWorkspace,
  createWorkspaceSession,
  listWorkspaceSessions,
  putWorkspaceSession,
  putWorkspaceMessage,
  putWorkspaceMessagePair,
  listWorkspaceMessages,
  putWorkspaceArtifact,
  listWorkspaceArtifacts,
  deleteWorkspaceArtifact,
  putWorkspaceMemory,
  listWorkspaceMemories,
  listAllReadingWorkspaces,
  listAllWorkspaceBooks,
  listAllWorkspaceSessions,
  listAllWorkspaceMessages,
  listAllWorkspaceArtifacts,
  listAllWorkspaceMemories,
  type BookRecord,
  type ReadingPosition,
  type AnnotationRecord,
  type BookGroup,
  type DefaultBookWorkspace,
} from "./db";
import type {
  WorkspaceArtifactRecord,
  WorkspaceMemoryRecord,
  WorkspaceMessageRecord,
} from "./readingWorkspace";

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
    kind: "highlight",
    text: "highlighted text",
    color: "yellow",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeWorkspaceMessage(
  owner: DefaultBookWorkspace,
  index: number,
  overrides: Partial<WorkspaceMessageRecord> = {}
): WorkspaceMessageRecord {
  const timestamp = new Date(
    Date.UTC(2026, 6, 28, 0, 0, 0, index)
  ).toISOString();
  return {
    id: `message-${index.toString().padStart(3, "0")}`,
    workspaceId: owner.workspace.id,
    sessionId: owner.session.id,
    role: index % 2 === 0 ? "user" : "assistant",
    content: `message-${index}`,
    state: "complete",
    createdAt: timestamp,
    updatedAt: timestamp,
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

  it("stores book bytes as ArrayBuffer outside the metadata record", async () => {
    await saveBook(
      makeBook({
        id: "binary-book",
        fileBlob: new Blob(["persistent bytes"], { type: "text/plain" }),
      })
    );
    const inspectionDb = new Dexie("AiReader");
    await inspectionDb.open();
    try {
      const metadata = await inspectionDb.table("books").get("binary-book");
      const file = await inspectionDb.table("bookFiles").get("binary-book");
      expect(metadata.fileBlob).toBeUndefined();
      expect(file.fileData).toBeInstanceOf(ArrayBuffer);
      expect(new TextDecoder().decode(file.fileData)).toBe("persistent bytes");
    } finally {
      inspectionDb.close();
    }
  });

  it("lists metadata when the source file record is absent", async () => {
    const inspectionDb = new Dexie("AiReader");
    await inspectionDb.open();
    try {
      await inspectionDb.table("books").put({
        id: "metadata-only",
        title: "Metadata Only",
        format: "epub",
        fileName: "metadata-only.epub",
        size: 50_000_000,
        createdAt: "2026-01-01T00:00:00.000Z",
      });
      await inspectionDb.table("bookFiles").delete("metadata-only");
    } finally {
      inspectionDb.close();
    }

    const books = await listBookMetadata();
    expect(books).toEqual([
      expect.objectContaining({ id: "metadata-only", title: "Metadata Only" }),
    ]);
    expect(books[0]).not.toHaveProperty("fileBlob");
  });

  it("loads only the requested source file", async () => {
    await saveBook(makeBook({ id: "first", fileBlob: new Blob(["first"]) }));
    await saveBook(makeBook({ id: "second", fileBlob: new Blob(["second"]) }));

    const inspectionDb = new Dexie("AiReader");
    await inspectionDb.open();
    try {
      await inspectionDb.table("bookFiles").delete("second");
    } finally {
      inspectionDb.close();
    }

    expect(await (await getBookFile("first"))?.text()).toBe("first");
    expect(await getBookFile("second")).toBeUndefined();
    expect((await listBookMetadata()).map((book) => book.id).sort()).toEqual([
      "first",
      "second",
    ]);
  });

  it("keeps healthy books usable when one source record is missing", async () => {
    await saveBook(
      makeBook({ id: "first", fileBlob: new Blob(["first"]) })
    );
    await saveBook(
      makeBook({ id: "broken", fileBlob: new Blob(["broken"]) })
    );
    await saveBook(
      makeBook({ id: "second", fileBlob: new Blob(["second"]) })
    );

    const inspectionDb = new Dexie("AiReader");
    await inspectionDb.open();
    try {
      await inspectionDb.table("bookFiles").delete("broken");
    } finally {
      inspectionDb.close();
    }

    expect((await listBookMetadata()).map((book) => book.id).sort()).toEqual([
      "broken",
      "first",
      "second",
    ]);
    expect(await getBook("broken")).toBeUndefined();
    expect(await (await getBook("first"))?.fileBlob.text()).toBe("first");
    expect(await (await getBook("second"))?.fileBlob.text()).toBe("second");
  });

  it("updates last-opened metadata without rewriting source bytes", async () => {
    await saveBook(
      makeBook({
        id: "last-opened",
        fileBlob: new Blob(["unchanged source"], { type: "text/plain" }),
      })
    );

    await updateBookLastOpenedAt(
      "last-opened",
      "2026-07-22T12:00:00.000Z"
    );

    const metadata = (await listBookMetadata()).find(
      (book) => book.id === "last-opened"
    );
    expect(metadata?.lastOpenedAt).toBe("2026-07-22T12:00:00.000Z");
    expect(await (await getBookFile("last-opened"))?.text()).toBe(
      "unchanged source"
    );
  });

  it("renames only the display title", async () => {
    await saveBook(
      makeBook({
        id: "rename-me",
        title: "Old title",
        fileName: "original.epub",
        groupIds: ["group-1"],
      })
    );

    await renameBook("rename-me", "  New title  ");

    const metadata = (await listBookMetadata()).find(
      (book) => book.id === "rename-me"
    );
    expect(metadata).toMatchObject({
      title: "New title",
      fileName: "original.epub",
      groupIds: ["group-1"],
    });
    expect(await (await getBookFile("rename-me"))?.text()).toBe("test");
  });

  it("rejects a blank display title", async () => {
    await saveBook(makeBook({ id: "rename-me", title: "Keep title" }));
    await expect(renameBook("rename-me", "   ")).rejects.toThrow(
      "Book title is required."
    );
    expect((await listBookMetadata())[0].title).toBe("Keep title");
  });

  it("stores covers outside source-file records", async () => {
    await saveBook(
      makeBook({
        id: "covered",
        coverImageBlob: new Blob(["cover"], { type: "image/png" }),
      })
    );
    const inspectionDb = new Dexie("AiReader");
    await inspectionDb.open();
    try {
      const file = await inspectionDb.table("bookFiles").get("covered");
      const cover = await inspectionDb.table("bookCovers").get("covered");
      expect(file.coverImageData).toBeUndefined();
      expect(cover.coverImageData).toBeInstanceOf(ArrayBuffer);
    } finally {
      inspectionDb.close();
    }
  });

  it("migrates one embedded legacy cover when that book is opened", async () => {
    const inspectionDb = new Dexie("AiReader");
    await inspectionDb.open();
    try {
      await inspectionDb.table("books").put({
        id: "legacy-cover",
        title: "Legacy Cover",
        format: "epub",
        fileName: "legacy-cover.epub",
        size: 4,
        createdAt: "2026-01-01T00:00:00.000Z",
      });
      await inspectionDb.table("bookFiles").put({
        bookId: "legacy-cover",
        fileData: new TextEncoder().encode("book").buffer,
        fileType: "application/epub+zip",
        coverImageData: new TextEncoder().encode("legacy image").buffer,
        coverImageType: "image/png",
      });
    } finally {
      inspectionDb.close();
    }

    const opened = await getBook("legacy-cover");
    expect(await opened?.coverImageBlob?.text()).toBe("legacy image");

    const verifyDb = new Dexie("AiReader");
    await verifyDb.open();
    try {
      const migratedCover = await verifyDb
        .table("bookCovers")
        .get("legacy-cover");
      expect(new TextDecoder().decode(migratedCover.coverImageData)).toBe(
        "legacy image"
      );
    } finally {
      verifyDb.close();
    }
  });

  it("migrates embedded legacy cover bytes without extracting the EPUB", async () => {
    const inspectionDb = new Dexie("AiReader");
    await inspectionDb.open();
    try {
      await inspectionDb.table("books").put({
        id: "background-legacy-cover",
        title: "Background Legacy Cover",
        format: "epub",
        fileName: "background-legacy-cover.epub",
        size: 4,
        createdAt: "2026-01-01T00:00:00.000Z",
      });
      await inspectionDb.table("bookFiles").put({
        bookId: "background-legacy-cover",
        fileData: new TextEncoder().encode("book").buffer,
        fileType: "application/epub+zip",
        coverImageData: new TextEncoder().encode("legacy image").buffer,
        coverImageType: "image/png",
      });
    } finally {
      inspectionDb.close();
    }
    const extractCover = vi.fn();

    const result = await loadMissingBookCover(
      "background-legacy-cover",
      extractCover
    );

    expect(result?.source).toBe("legacy");
    expect(await result?.blob.text()).toBe("legacy image");
    expect(extractCover).not.toHaveBeenCalled();
    expect(
      await (await listBookMetadata())[0].coverImageBlob?.text()
    ).toBe("legacy image");
  });

  it("saves an extracted cover without rewriting the source record", async () => {
    await saveBook(
      makeBook({
        id: "background-extracted-cover",
        fileBlob: new Blob(["unchanged epub bytes"], {
          type: "application/epub+zip",
        }),
      })
    );
    const inspectionDb = new Dexie("AiReader");
    await inspectionDb.open();
    const beforeFile = await inspectionDb
      .table("bookFiles")
      .get("background-extracted-cover");
    inspectionDb.close();
    const extractCover = vi.fn().mockResolvedValue(
      new Blob(["extracted image"], { type: "image/jpeg" })
    );

    const result = await loadMissingBookCover(
      "background-extracted-cover",
      extractCover
    );

    expect(result?.source).toBe("extracted");
    expect(await result?.blob.text()).toBe("extracted image");
    expect(extractCover).toHaveBeenCalledTimes(1);
    expect(await extractCover.mock.calls[0][0].text()).toBe(
      "unchanged epub bytes"
    );
    const verifyDb = new Dexie("AiReader");
    await verifyDb.open();
    try {
      const afterFile = await verifyDb
        .table("bookFiles")
        .get("background-extracted-cover");
      expect(new Uint8Array(afterFile.fileData)).toEqual(
        new Uint8Array(beforeFile.fileData)
      );
      expect(await verifyDb.table("bookCovers").get("background-extracted-cover"))
        .toEqual(expect.objectContaining({ coverImageType: "image/jpeg" }));
    } finally {
      verifyDb.close();
    }
  });

  it("preserves a cover saved while EPUB extraction is still running", async () => {
    await saveBook(
      makeBook({
        id: "concurrent-cover",
        fileBlob: new Blob(["epub bytes"], {
          type: "application/epub+zip",
        }),
      })
    );
    let finishExtraction!: (cover: Blob) => void;
    let extractionStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      extractionStarted = resolve;
    });
    const extractCover = vi.fn().mockImplementation(async () => {
      extractionStarted();
      return new Promise<Blob>((resolve) => {
        finishExtraction = resolve;
      });
    });

    const pending = loadMissingBookCover("concurrent-cover", extractCover);
    await started;
    await saveBookCover(
      "concurrent-cover",
      new Blob(["newer cover"], { type: "image/png" })
    );
    finishExtraction(new Blob(["stale extracted cover"], { type: "image/jpeg" }));

    const result = await pending;
    expect(result?.source).toBe("existing");
    expect(result?.blob.type).toBe("image/png");
    expect(await result?.blob.text()).toBe("newer cover");
    expect(
      await (await listBookMetadata())[0].coverImageBlob?.text()
    ).toBe("newer cover");
  });

  it("writes a cover without changing book metadata or source bytes", async () => {
    await saveBook(
      makeBook({
        id: "cover-only-write",
        title: "Keep metadata",
        fileBlob: new Blob(["keep source"]),
      })
    );

    await saveBookCover(
      "cover-only-write",
      new Blob(["cover only"], { type: "image/webp" })
    );

    const book = await getBook("cover-only-write");
    expect(book?.title).toBe("Keep metadata");
    expect(await book?.fileBlob.text()).toBe("keep source");
    expect(book?.coverImageBlob?.type).toBe("image/webp");
    expect(await book?.coverImageBlob?.text()).toBe("cover only");
  });

  it("migrates legacy Blob records when they are first read", async () => {
    const inspectionDb = new Dexie("AiReader");
    await inspectionDb.open();
    try {
      await inspectionDb.table("books").put(
        makeBook({
          id: "legacy-book",
          fileBlob: new Blob(["legacy bytes"], { type: "text/plain" }),
        })
      );
      await inspectionDb.table("bookFiles").delete("legacy-book");
    } finally {
      inspectionDb.close();
    }

    const migrated = await getBook("legacy-book");
    expect(await migrated?.fileBlob.text()).toBe("legacy bytes");

    const verifyDb = new Dexie("AiReader");
    await verifyDb.open();
    try {
      const metadata = await verifyDb.table("books").get("legacy-book");
      const file = await verifyDb.table("bookFiles").get("legacy-book");
      expect(metadata.fileBlob).toBeUndefined();
      expect(file.fileData).toBeInstanceOf(ArrayBuffer);
    } finally {
      verifyDb.close();
    }
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
    await saveBook(
      makeBook({
        id: "b1",
        coverImageBlob: new Blob(["cover"], { type: "image/png" }),
      })
    );
    await saveReadingPosition(makePosition({ bookId: "b1" }));
    await addAnnotation(makeAnnotation({ id: "a1", bookId: "b1" }));
    await addAnnotation(makeAnnotation({ id: "a2", bookId: "b1" }));

    await deleteBook("b1");

    expect(await getBook("b1")).toBeUndefined();
    expect(await getReadingPosition("b1")).toBeUndefined();
    expect(await listAnnotations("b1")).toEqual([]);

    const inspectionDb = new Dexie("AiReader");
    await inspectionDb.open();
    try {
      expect(await inspectionDb.table("bookCovers").get("b1")).toBeUndefined();
    } finally {
      inspectionDb.close();
    }
  });
});

describe("Reading workspace storage", () => {
  it("creates one stable default workspace and session per book", async () => {
    await saveBook(
      makeBook({ id: "b-workspace", title: "Workspace Book" })
    );

    const [first, second] = await Promise.all([
      ensureDefaultBookWorkspace("b-workspace"),
      ensureDefaultBookWorkspace("b-workspace"),
    ]);

    expect(second).toEqual(first);
    expect(await listWorkspaceBooks(first.workspace.id)).toEqual([
      first.bookLink,
    ]);
    expect(await listWorkspaceSessions(first.workspace.id)).toEqual([
      first.session,
    ]);
  });

  it("rejects workspace creation for a missing book", async () => {
    await expect(ensureDefaultBookWorkspace("missing")).rejects.toThrow(
      "Book not found: missing"
    );
  });

  it("creates, updates, and orders sessions by most recent activity", async () => {
    await saveBook(makeBook({ id: "session-book" }));
    const owner = await ensureDefaultBookWorkspace("session-book");
    const second = await createWorkspaceSession(
      owner.workspace.id,
      "Second conversation",
      "2026-07-28T01:00:00.000Z"
    );

    await putWorkspaceSession({
      ...owner.session,
      title: "Updated first conversation",
      updatedAt: "2026-07-28T02:00:00.000Z",
    });

    expect(
      (await listWorkspaceSessions(owner.workspace.id)).map((item) => item.id)
    ).toEqual([owner.session.id, second.id]);
  });

  it("stores a message pair atomically and pages with a compound cursor", async () => {
    await saveBook(makeBook({ id: "message-book" }));
    const owner = await ensureDefaultBookWorkspace("message-book");
    const pairUser = makeWorkspaceMessage(owner, 0, {
      id: "pair-user",
      role: "user",
    });
    const pairAssistant = makeWorkspaceMessage(owner, 1, {
      id: "pair-assistant",
      role: "assistant",
      replyToMessageId: pairUser.id,
    });
    await putWorkspaceMessagePair(pairUser, pairAssistant);

    for (let index = 2; index < 132; index += 1) {
      await putWorkspaceMessage(makeWorkspaceMessage(owner, index));
    }

    const latest = await listWorkspaceMessages(owner.session.id, {
      limit: 100,
    });
    expect(latest).toHaveLength(100);
    expect(latest[0].content).toBe("message-32");

    const older = await listWorkspaceMessages(owner.session.id, {
      limit: 50,
      before: { createdAt: latest[0].createdAt, id: latest[0].id },
    });
    expect(older).toHaveLength(32);
    expect(older[0].id).toBe("pair-user");
    expect(older.at(-1)?.content).toBe("message-31");
  });

  it("stores materials in most-recent order and deletes one artifact", async () => {
    await saveBook(makeBook({ id: "materials-book" }));
    const owner = await ensureDefaultBookWorkspace("materials-book");
    const artifact: WorkspaceArtifactRecord = {
      id: "artifact-old",
      workspaceId: owner.workspace.id,
      sourceMessageIds: [],
      kind: "summary",
      title: "Old summary",
      content: "Old",
      mediaType: "text/markdown",
      createdAt: "2026-07-28T00:00:00.000Z",
      updatedAt: "2026-07-28T00:00:00.000Z",
    };
    await putWorkspaceArtifact(artifact);
    await putWorkspaceArtifact({
      ...artifact,
      id: "artifact-new",
      title: "New summary",
      createdAt: "2026-07-28T01:00:00.000Z",
      updatedAt: "2026-07-28T01:00:00.000Z",
    });

    const memory: WorkspaceMemoryRecord = {
      id: "memory-old",
      workspaceId: owner.workspace.id,
      content: "Old memory",
      state: "active",
      createdAt: "2026-07-28T00:00:00.000Z",
      updatedAt: "2026-07-28T00:00:00.000Z",
    };
    await putWorkspaceMemory(memory);
    await putWorkspaceMemory({
      ...memory,
      id: "memory-new",
      content: "New memory",
      createdAt: "2026-07-28T01:00:00.000Z",
      updatedAt: "2026-07-28T01:00:00.000Z",
    });

    expect(
      (await listWorkspaceArtifacts(owner.workspace.id)).map((item) => item.id)
    ).toEqual(["artifact-new", "artifact-old"]);
    expect(
      (await listWorkspaceMemories(owner.workspace.id)).map((item) => item.id)
    ).toEqual(["memory-new", "memory-old"]);

    await deleteWorkspaceArtifact("artifact-old");
    expect(
      (await listWorkspaceArtifacts(owner.workspace.id)).map((item) => item.id)
    ).toEqual(["artifact-new"]);
  });

  it("deletes an orphaned one-book workspace with all descendants", async () => {
    await saveBook(
      makeBook({ id: "b-workspace", title: "Workspace Book" })
    );
    const owner = await ensureDefaultBookWorkspace("b-workspace");
    await putWorkspaceMessage(makeWorkspaceMessage(owner, 0));
    await putWorkspaceArtifact({
      id: "artifact-1",
      workspaceId: owner.workspace.id,
      sourceMessageIds: [],
      kind: "note",
      title: "Note",
      content: "Content",
      mediaType: "text/markdown",
      createdAt: "2026-07-28T00:00:00.000Z",
      updatedAt: "2026-07-28T00:00:00.000Z",
    });
    await putWorkspaceMemory({
      id: "memory-1",
      workspaceId: owner.workspace.id,
      content: "Memory",
      state: "active",
      createdAt: "2026-07-28T00:00:00.000Z",
      updatedAt: "2026-07-28T00:00:00.000Z",
    });

    await deleteBook("b-workspace");

    expect(await getReadingWorkspace(owner.workspace.id)).toBeUndefined();
    expect(
      await listWorkspaceMessages(owner.session.id, { limit: 100 })
    ).toEqual([]);
    expect(await listWorkspaceArtifacts(owner.workspace.id)).toEqual([]);
    expect(await listWorkspaceMemories(owner.workspace.id)).toEqual([]);
  });

  it("preserves a workspace while another associated book remains", async () => {
    await saveBook(makeBook({ id: "book-a", title: "Book A" }));
    await saveBook(makeBook({ id: "book-b", title: "Book B" }));
    const owner = await ensureDefaultBookWorkspace("book-a");
    const reference = await attachBookToWorkspace(
      owner.workspace.id,
      "book-b",
      "reference"
    );

    expect(
      await attachBookToWorkspace(
        owner.workspace.id,
        "book-b",
        "reference"
      )
    ).toEqual(reference);

    await deleteBook("book-a");

    expect(await getReadingWorkspace(owner.workspace.id)).toBeDefined();
    expect(await listWorkspaceBooks(owner.workspace.id)).toEqual([reference]);
  });

  it("clears every workspace table with reader data", async () => {
    await saveBook(makeBook({ id: "clear-workspace" }));
    const owner = await ensureDefaultBookWorkspace("clear-workspace");
    await putWorkspaceMessage(makeWorkspaceMessage(owner, 0));
    await putWorkspaceArtifact({
      id: "clear-artifact",
      workspaceId: owner.workspace.id,
      sourceMessageIds: [],
      kind: "note",
      title: "Note",
      content: "Content",
      mediaType: "text/markdown",
      createdAt: "2026-07-28T00:00:00.000Z",
      updatedAt: "2026-07-28T00:00:00.000Z",
    });
    await putWorkspaceMemory({
      id: "clear-memory",
      workspaceId: owner.workspace.id,
      content: "Memory",
      state: "active",
      createdAt: "2026-07-28T00:00:00.000Z",
      updatedAt: "2026-07-28T00:00:00.000Z",
    });

    const { clearAllReaderData: clearAll } = await import("./db");
    await clearAll();

    expect(await listAllReadingWorkspaces()).toEqual([]);
    expect(await listAllWorkspaceBooks()).toEqual([]);
    expect(await listAllWorkspaceSessions()).toEqual([]);
    expect(await listAllWorkspaceMessages()).toEqual([]);
    expect(await listAllWorkspaceArtifacts()).toEqual([]);
    expect(await listAllWorkspaceMemories()).toEqual([]);
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

  it("deletes one annotation without touching siblings", async () => {
    await addAnnotation(makeAnnotation({ id: "keep", kind: "bookmark" }));
    await addAnnotation(makeAnnotation({ id: "remove", kind: "highlight" }));
    await deleteAnnotation("remove");
    expect((await listAnnotations("book-1")).map((item) => item.id)).toEqual([
      "keep",
    ]);
  });

  it("normalizes legacy annotations as yellow highlights", async () => {
    const inspectionDb = new Dexie("AiReader");
    await inspectionDb.open();
    await inspectionDb.table("annotations").put({
      id: "legacy",
      bookId: "book-1",
      locator: "epubcfi(/6/2)",
      text: "legacy text",
      createdAt: "2024-01-01T00:00:00Z",
    });
    inspectionDb.close();

    expect(await listAnnotations("book-1")).toContainEqual(
      expect.objectContaining({
        id: "legacy",
        kind: "highlight",
        color: "yellow",
      })
    );
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

describe("Custom background image", () => {
  it("saves and retrieves the selected background blob", async () => {
    const blob = new Blob(["custom-background"], { type: "image/png" });

    await saveCustomBackgroundImage(blob);
    const stored = await getCustomBackgroundImage();

    expect(stored).toBeDefined();
    expect(stored!.type).toBe("image/png");
    expect(await stored!.text()).toBe("custom-background");
  });

  it("replaces the previous selected background blob", async () => {
    await saveCustomBackgroundImage(new Blob(["old"], { type: "image/png" }));
    await saveCustomBackgroundImage(new Blob(["new"], { type: "image/jpeg" }));

    const stored = await getCustomBackgroundImage();

    expect(stored!.type).toBe("image/jpeg");
    expect(await stored!.text()).toBe("new");
  });

  it("deletes the selected background blob", async () => {
    await saveCustomBackgroundImage(new Blob(["custom"], { type: "image/png" }));

    await deleteCustomBackgroundImage();

    expect(await getCustomBackgroundImage()).toBeNull();
  });

  it("clears the selected background with reader data", async () => {
    await saveCustomBackgroundImage(new Blob(["custom"], { type: "image/png" }));
    const { clearAllReaderData: clearAll } = await import("./db");

    await clearAll();

    expect(await getCustomBackgroundImage()).toBeNull();
  });
});
