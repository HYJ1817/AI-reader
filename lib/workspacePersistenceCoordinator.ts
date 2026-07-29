export type WorkspaceOwnedTask = (
  stillOwned: () => boolean
) => Promise<void> | void;

export class WorkspacePersistenceCoordinator {
  private tail: Promise<void> = Promise.resolve();

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
    await this.enqueue(task);
  }

  async drain(): Promise<void> {
    await this.tail.catch(() => undefined);
  }
}
