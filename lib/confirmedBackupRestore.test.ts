import { describe, expect, it, vi } from "vitest";
import { executeConfirmedBackupRestore } from "./confirmedBackupRestore";

function scenario() {
  const events: string[] = [];
  const release = vi.fn(async () => { events.push("release"); });
  const options = {
    acquire: async () => { events.push("lock"); return release; },
    coordinator: {
      schedule: vi.fn(), saveNow: vi.fn(), flush: vi.fn(),
      cancel: async () => { events.push("positions"); },
      setBlocked: (blocked: boolean) => { events.push(`blocked:${blocked}`); },
    },
    stopTasks: () => [Promise.resolve().then(() => { events.push("tasks"); })],
    stopReader: () => { events.push("reader"); },
    restore: vi.fn(async () => { events.push("restore"); return { configurationSaved: true }; }),
    reload: async () => { events.push("refresh"); },
  };
  return { events, release, options };
}

describe("confirmed backup execution", () => {
  it("locks before stopping work, drains before commit and refreshes before unlocking", async () => {
    const { events, options } = scenario();
    await executeConfirmedBackupRestore(options);
    expect(events).toEqual(["lock", "blocked:true", "positions", "tasks", "reader", "restore", "refresh", "blocked:false", "release"]);
  });
  it("does not stop reading or replace data if a background task times out", async () => {
    vi.useFakeTimers();
    try {
      const { events, options, release } = scenario();
      options.stopTasks = () => [new Promise(() => {})];
      const task = executeConfirmedBackupRestore(options);
      const assertion = expect(task).rejects.toThrow("backup-task-timeout");
      await vi.advanceTimersByTimeAsync(10_000);
      await assertion;
      expect(options.restore).not.toHaveBeenCalled();
      expect(events).not.toContain("reader");
      expect(release).toHaveBeenCalledOnce();
      expect(events).toContain("blocked:false");
    } finally { vi.useRealTimers(); }
  });
  it("does not stop tasks when the preview is stale", async () => {
    const { events, options } = scenario();
    options.acquire = async () => { throw new Error("stale"); };
    await expect(executeConfirmedBackupRestore(options)).rejects.toThrow("stale");
    expect(events).toEqual([]);
  });
});
