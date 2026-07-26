import { describe, expect, it } from "vitest";
import type { ReaderPositionCoordinator } from "./readerPositionCoordinator";
import { runBackupRestoreGuarded } from "./backupRestoreGuard";

function makeCoordinator(events: string[]): ReaderPositionCoordinator {
  return {
    schedule: () => undefined,
    saveNow: async () => undefined,
    flush: async () => undefined,
    cancel: async () => {
      events.push("cancel");
    },
    setBlocked: (blocked) => {
      events.push(`blocked:${blocked}`);
    },
  };
}

describe("backup restore guard", () => {
  it("drains stale writes and stops the reader before replacing data", async () => {
    const events: string[] = [];

    await runBackupRestoreGuarded({
      coordinator: makeCoordinator(events),
      stopReader: () => events.push("stop-reader"),
      restore: async () => {
        events.push("restore");
      },
      reload: async () => {
        events.push("reload");
      },
    });

    expect(events).toEqual([
      "blocked:true",
      "cancel",
      "stop-reader",
      "restore",
      "reload",
      "blocked:false",
    ]);
  });

  it("always releases the write block when restoration fails", async () => {
    const events: string[] = [];

    await expect(
      runBackupRestoreGuarded({
        coordinator: makeCoordinator(events),
        stopReader: () => events.push("stop-reader"),
        restore: async () => {
          events.push("restore");
          throw new Error("restore failed");
        },
        reload: async () => {
          events.push("reload");
        },
      })
    ).rejects.toThrow("restore failed");

    expect(events).toEqual([
      "blocked:true",
      "cancel",
      "stop-reader",
      "restore",
      "blocked:false",
    ]);
  });
});
