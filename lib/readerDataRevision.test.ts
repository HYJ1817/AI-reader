import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { installReaderDataRevision, type ReaderDataRevision } from "./readerDataRevision";

async function openClient(name: string) {
  const db = new Dexie(name);
  db.version(1).stores({ books: "id", readerState: "id" });
  const guard = installReaderDataRevision(db);
  await db.open();
  return { db, guard };
}

describe("reader database revision fence", () => {
  it("locks other clients before draining and releases without changing revision", async () => {
    const name = `revision-${crypto.randomUUID()}`;
    const first = await openClient(name);
    const second = await openClient(name);
    try {
      const release = await first.guard.acquireRestoreLock(0);
      await expect(second.db.table("books").put({ id: "racing" })).rejects.toThrow("正在恢复");
      await expect(second.guard.acquireRestoreLock(0)).rejects.toThrow("正在恢复");
      await first.db.table("books").put({ id: "drained-local-task" });
      expect(await first.guard.getRestoreRevision()).toBe(1);
      await release();
      expect((await first.db.table("readerState").get("data")).revision).toBe(1);
      await expect(first.guard.getRestoreRevision()).rejects.toThrow("预览后");
      await second.db.table("books").put({ id: "safe" });
      await expect(first.guard.acquireRestoreLock(0)).rejects.toThrow("预览后");
    } finally { second.db.close(); await first.db.delete(); }
  });
  it("advances revision for writes and rolls it back with a failed transaction", async () => {
    const { db } = await openClient(`revision-${crypto.randomUUID()}`);
    try {
      await db.table("books").put({ id: "first" });
      const before = await db.table("readerState").get("data") as ReaderDataRevision;
      expect(before.revision).toBe(1);
      await expect(db.transaction("rw", db.table("books"), async () => {
        await db.table("books").put({ id: "second" });
        throw new Error("rollback");
      })).rejects.toThrow("rollback");
      expect(await db.table("readerState").get("data")).toEqual(before);
      expect(await db.table("books").toArray()).toEqual([{ id: "first" }]);
    } finally { await db.delete(); }
  });

  it("rejects writes from a client opened before a replacement epoch", async () => {
    const name = `revision-${crypto.randomUUID()}`;
    const first = await openClient(name);
    const second = await openClient(name);
    try {
      await first.db.table("books").put({ id: "original" });
      await first.db.table("readerState").put({ id: "data", revision: 2, epoch: 1 });
      first.guard.acceptEpoch(1);
      await expect(second.db.table("books").put({ id: "stale" })).rejects.toThrow("书库已在其他页面恢复");
      await first.db.table("books").put({ id: "new" });
      expect(await first.db.table("books").get("stale")).toBeUndefined();
    } finally { second.db.close(); await first.db.delete(); }
  });
});
