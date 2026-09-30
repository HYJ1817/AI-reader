export type WorkspaceOwnedTask = (
  stillOwned: () => boolean
) => Promise<void> | void;

export class WorkspacePersistenceCoordinator {
  private tail: Promise<void> = Promise.resolve();
  private pendingCancellations = new Set<() => Promise<void> | void>();

  private enqueue(task: () => Promise<void> | void): Promise<void> {
    const queued = this.tail.catch(() => undefined).then(task);
    this.tail = queued;
    return queued;
  }

  enqueueCheckpoint(task: () => Promise<void> | void): void {
    void this.enqueue(task).catch(() => undefined);
  }

  async commitOwned(
    isOwned: () => boolean,
    task: WorkspaceOwnedTask
  ): Promise<boolean> {
    let committed = false;
    const queued = this.enqueue(async () => {
      if (!isOwned()) return;
      await task(isOwned);
      committed = isOwned();
    });
    await queued;
    return committed;
  }

  async cancel(task: () => Promise<void> | void): Promise<void> {
    this.pendingCancellations.add(task);
    await this.enqueue(async () => {
      await task();
      this.pendingCancellations.delete(task);
    });
  }

  async flush(): Promise<void> {
    await this.enqueue(async () => {
      for (const task of this.pendingCancellations) {
        await task();
        this.pendingCancellations.delete(task);
      }
    });
  }

  async drain(): Promise<void> {
    await this.tail.catch(() => undefined);
  }
}
