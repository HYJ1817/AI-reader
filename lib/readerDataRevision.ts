import Dexie from "dexie";
import type { DBCoreTransaction } from "dexie";
import { createLocalId } from "./localId";

export type ReaderDataRevision = {
  id: "data"; revision: number; epoch: number;
  restoreLock?: { owner: string; expiresAt: number };
};
export const INITIAL_READER_REVISION: ReaderDataRevision = { id: "data", revision: 0, epoch: 0 };
export const STALE_READER_MESSAGE = "书库已在其他页面恢复，请重新打开应用后继续。";
export const CHANGED_READER_MESSAGE = "书库在预览后发生了变化，请重新选择备份并确认。";
export const LOCKED_READER_MESSAGE = "其他页面正在恢复书库，请稍后重试。";

/** Every write transaction includes one small control store, so revision checks
 * and data replacement serialize even when different tabs write different tables. */
export function installReaderDataRevision(db: Dexie) {
  const owner = createLocalId();
  let acceptedEpoch: number | undefined;
  db.on("ready", async () => {
    const state = await db.table<ReaderDataRevision>("readerState").get("data");
    acceptedEpoch ??= state?.epoch ?? 0;
  });
  db.use({
    stack: "dbcore",
    name: "reader-data-revision",
    create(core) {
      const transactions = new WeakMap<DBCoreTransaction, Promise<void>>();
      const control = core.table("readerState");
      return {
        ...core,
        transaction(stores, mode, options) {
          return core.transaction(mode === "readwrite" ? [...new Set([...stores, "readerState"])] : stores, mode, options);
        },
        table(name) {
          const table = core.table(name);
          if (name === "readerState") return table;
          return {
            ...table,
            mutate(request) {
              let guard = transactions.get(request.trans);
              if (!guard) {
                guard = (async () => {
                  const state: ReaderDataRevision = await control.get({ trans: request.trans, key: "data" }) ?? INITIAL_READER_REVISION;
                  if (acceptedEpoch !== undefined && state.epoch !== acceptedEpoch) {
                    if (typeof window !== "undefined") window.dispatchEvent(new Event("ai-reader-data-replaced"));
                    throw new Error(STALE_READER_MESSAGE);
                  }
                  if (state.restoreLock && state.restoreLock.owner !== owner && state.restoreLock.expiresAt > Date.now()) {
                    throw new Error(LOCKED_READER_MESSAGE);
                  }
                  const result = await control.mutate({ type: "put", trans: request.trans, values: [{ ...state, revision: state.revision + 1 }] });
                  if (result.numFailures) throw result.failures[0];
                })();
                transactions.set(request.trans, guard);
              }
              // Dexie's hooks depend on its promise-local transaction context.
              return Dexie.Promise.resolve(guard).then(() => table.mutate(request));
            },
          };
        },
      };
    },
  });
  return {
    acceptEpoch: (epoch: number) => { acceptedEpoch = epoch; },
    async getRestoreRevision() {
      const state = await db.table<ReaderDataRevision>("readerState").get("data");
      if (!state?.restoreLock || state.restoreLock.owner !== owner || state.restoreLock.expiresAt <= Date.now()) {
        throw new Error(CHANGED_READER_MESSAGE);
      }
      if (state.epoch !== acceptedEpoch) throw new Error(STALE_READER_MESSAGE);
      return state.revision;
    },
    async acquireRestoreLock(expectedRevision: number) {
      const control = db.table<ReaderDataRevision>("readerState");
      await db.transaction("rw", control, async () => {
        const state = await control.get("data") ?? INITIAL_READER_REVISION;
        if (acceptedEpoch !== undefined && state.epoch !== acceptedEpoch) throw new Error(STALE_READER_MESSAGE);
        if (state.restoreLock && state.restoreLock.expiresAt > Date.now()) throw new Error(LOCKED_READER_MESSAGE);
        if (state.revision !== expectedRevision) throw new Error(CHANGED_READER_MESSAGE);
        // Longer than the ten-second drain bound; a crashed tab cannot lock forever.
        await control.put({ ...state, restoreLock: { owner, expiresAt: Date.now() + 15_000 } });
      });
      return async () => {
        await db.transaction("rw", control, async () => {
          const state = await control.get("data");
          if (state?.restoreLock?.owner !== owner) return;
          const { restoreLock: _lock, ...unlocked } = state;
          void _lock;
          await control.put(unlocked);
        });
      };
    },
  };
}
