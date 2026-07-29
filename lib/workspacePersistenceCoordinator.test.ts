import { describe, expect, it } from "vitest";
import { WorkspacePersistenceCoordinator } from "./workspacePersistenceCoordinator";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("WorkspacePersistenceCoordinator", () => {
  it("lets cancellation win while a checkpoint delays terminal completion", async () => {
    const checkpoint = deferred();
    const coordinator = new WorkspacePersistenceCoordinator();
    const writes: string[] = [];
    let owned = true;
    let messageState = "streaming";
    let sessionState = "streaming";

    coordinator.enqueueCheckpoint(async () => {
      await checkpoint.promise;
      writes.push("checkpoint");
    });
    const terminal = coordinator.commitOwned(
      () => owned,
      async () => {
        writes.push("complete");
        messageState = "complete";
        sessionState = "idle";
      }
    );

    owned = false;
    const cancellation = coordinator.cancel(async () => {
      writes.push("cancelled");
      messageState = "cancelled";
      sessionState = "paused";
    });
    checkpoint.resolve();

    await expect(terminal).resolves.toBe(false);
    await cancellation;
    expect(writes).toEqual(["checkpoint", "cancelled"]);
    expect(messageState).toBe("cancelled");
    expect(sessionState).toBe("paused");
  });

  it("queues cancellation after an already-started terminal write", async () => {
    const terminalWrite = deferred();
    const terminalStarted = deferred();
    const coordinator = new WorkspacePersistenceCoordinator();
    const writes: string[] = [];
    let owned = true;
    let messageState = "streaming";
    let sessionState = "streaming";

    const terminal = coordinator.commitOwned(
      () => owned,
      async (stillOwned) => {
        terminalStarted.resolve();
        await terminalWrite.promise;
        writes.push("complete");
        messageState = "complete";
        if (!stillOwned()) return;
        writes.push("idle");
        sessionState = "idle";
      }
    );
    await terminalStarted.promise;
    owned = false;
    const cancellation = coordinator.cancel(async () => {
      writes.push("cancelled");
      messageState = "cancelled";
      sessionState = "paused";
    });
    terminalWrite.resolve();

    await expect(terminal).resolves.toBe(false);
    await cancellation;
    expect(writes).toEqual(["complete", "cancelled"]);
    expect(messageState).toBe("cancelled");
    expect(sessionState).toBe("paused");
  });

  it("skips a queued error terminal after a workspace switch", async () => {
    const checkpoint = deferred();
    const coordinator = new WorkspacePersistenceCoordinator();
    const writes: string[] = [];
    let owned = true;
    let messageState = "streaming";
    let sessionState = "streaming";

    coordinator.enqueueCheckpoint(async () => {
      await checkpoint.promise;
      writes.push("checkpoint");
    });
    const terminal = coordinator.commitOwned(
      () => owned,
      async () => {
        writes.push("error");
        messageState = "error";
        sessionState = "error";
      }
    );

    owned = false;
    const workspaceSwitch = coordinator.cancel(async () => {
      writes.push("cancelled");
      messageState = "cancelled";
      sessionState = "paused";
    });
    checkpoint.resolve();

    await expect(terminal).resolves.toBe(false);
    await workspaceSwitch;
    expect(writes).toEqual(["checkpoint", "cancelled"]);
    expect(messageState).toBe("cancelled");
    expect(sessionState).toBe("paused");
  });
});
