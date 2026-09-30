import Dexie from "dexie";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { clearAllReaderData, getReaderDataRevision, listBookMetadata, saveBook, saveBookAtRevision, type BookRecord } from "./db";
import { BookDuplicateDetectionError, inspectAndCommitBook } from "./bookImportDuplicate";

function book(id: string, bytes = "same", overrides: Partial<BookRecord> = {}): BookRecord {
  return { id, title: id, fileName: `${id}.txt`, format: "txt", size: new Blob([bytes]).size,
    createdAt: "2026-01-01", fileBlob: new Blob([bytes]), ...overrides };
}
beforeEach(async () => { await clearAllReaderData(); });
afterEach(() => { vi.restoreAllMocks(); });

describe("duplicate-aware import", () => {
  it("reuses candidate digests until the shared data revision changes", async () => {
    await saveBook(book("old"));
    const digest = vi.spyOn(crypto.subtle, "digest");
    await inspectAndCommitBook(book("first-attempt"));
    await inspectAndCommitBook(book("second-attempt"));
    expect(digest).toHaveBeenCalledTimes(3);
    await saveBook(book("old", "diff"));
    expect(await inspectAndCommitBook(book("new"))).toEqual({ kind: "saved" });
    expect(digest).toHaveBeenCalledTimes(5);
  });
  it("recognizes identical renamed bytes without touching the original", async () => {
    await saveBook(book("old"));
    expect(await inspectAndCommitBook(book("renamed"))).toMatchObject({ kind: "duplicate", book: { id: "old" } });
    expect(await listBookMetadata()).toHaveLength(1);
  });
  it("allows a same-name file with different bytes", async () => {
    await saveBook(book("old"));
    expect(await inspectAndCommitBook(book("new", "diff", { fileName: "old.txt" }))).toEqual({ kind: "saved" });
  });
  it("filters size and format before hashing", async () => {
    await saveBook(book("different-format", "same", { format: "epub" }));
    await saveBook(book("different-size", "longer"));
    const digest = vi.spyOn(crypto.subtle, "digest");
    expect(await inspectAndCommitBook(book("new"))).toEqual({ kind: "saved" });
    expect(digest).not.toHaveBeenCalled();
  });
  it("fails explicitly when a candidate file is missing", async () => {
    await saveBook(book("old"));
    const connection = new Dexie("AiReader");
    await connection.open();
    try { await connection.table("bookFiles").delete("old"); } finally { connection.close(); }
    await expect(inspectAndCommitBook(book("new"))).rejects.toBeInstanceOf(BookDuplicateDetectionError);
    expect(await listBookMetadata()).toHaveLength(1);
  });
  it("fails explicitly on SHA-256 failure", async () => {
    await saveBook(book("old"));
    vi.spyOn(crypto.subtle, "digest").mockRejectedValue(new Error("unavailable"));
    await expect(inspectAndCommitBook(book("new"))).rejects.toBeInstanceOf(BookDuplicateDetectionError);
  });
  it("allows explicit continuation without overwriting the old record", async () => {
    await saveBook(book("old"));
    vi.spyOn(crypto.subtle, "digest").mockRejectedValue(new Error("unavailable"));
    expect(await inspectAndCommitBook(book("new"), { allowDuplicate: true })).toEqual({ kind: "saved" });
    expect((await listBookMetadata()).map((b) => b.id).sort()).toEqual(["new", "old"]);
  });
  it("serializes concurrent identical imports and rechecks the loser", async () => {
    const results = await Promise.all([inspectAndCommitBook(book("a")), inspectAndCommitBook(book("b"))]);
    expect(results.map((r) => r.kind).sort()).toEqual(["duplicate", "saved"]);
    expect(await listBookMetadata()).toHaveLength(1);
  });
  it("serializes separate database connections like separate browser tabs", async () => {
    vi.resetModules();
    const otherTab = await import("./bookImportDuplicate");
    const results = await Promise.all([
      inspectAndCommitBook(book("tab-a")),
      otherTab.inspectAndCommitBook(book("tab-b")),
    ]);
    expect(results.map((r) => r.kind).sort()).toEqual(["duplicate", "saved"]);
    expect(await listBookMetadata()).toHaveLength(1);
  });
  it("cancels before commit and does not announce a commit", async () => {
    const onCommit = vi.fn();
    await expect(inspectAndCommitBook(book("new"), { shouldCommit: () => false, onCommit })).rejects.toMatchObject({ name: "AbortError" });
    expect(onCommit).not.toHaveBeenCalled();
    expect(await listBookMetadata()).toHaveLength(0);
  });
  it("announces successful commit once", async () => {
    const onCommit = vi.fn();
    await inspectAndCommitBook(book("new"), { onCommit });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
  it("checks cancellation again after preparing the file for commit", async () => {
    let active = true;
    const record = book("new");
    const read = record.fileBlob.arrayBuffer.bind(record.fileBlob);
    vi.spyOn(record.fileBlob, "arrayBuffer").mockImplementation(async () => {
      active = false;
      return read();
    });
    const onCommit = vi.fn();
    await expect(inspectAndCommitBook(record, { shouldCommit: () => active, onCommit })).rejects.toMatchObject({ name: "AbortError" });
    expect(onCommit).not.toHaveBeenCalled();
    expect(await listBookMetadata()).toHaveLength(0);
  });
});

describe("revision checked insert", () => {
  it("rejects a stale revision without a partial write", async () => {
    const { revision } = await getReaderDataRevision();
    await saveBook(book("old"));
    expect(await saveBookAtRevision(book("new"), revision)).toBe(false);
    expect((await listBookMetadata()).map((b) => b.id)).toEqual(["old"]);
  });
  it("never overwrites an existing ID, even with explicit continuation", async () => {
    await saveBook(book("old"));
    await expect(inspectAndCommitBook(book("old", "diff"), { allowDuplicate: true })).rejects.toBeDefined();
    expect((await listBookMetadata())[0].title).toBe("old");
  });
});
