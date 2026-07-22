import type { ReadingPosition } from "./db";

export type ReaderPositionCoordinator = {
  schedule: (position: ReadingPosition) => void;
  saveNow: (position: ReadingPosition) => Promise<void>;
  flush: () => Promise<void>;
  cancel: () => Promise<void>;
  setBlocked: (blocked: boolean) => void;
};

export function createReaderPositionCoordinator(
  persist: (position: ReadingPosition) => Promise<void>,
  delayMs = 180
): ReaderPositionCoordinator {
  let pending: ReadingPosition | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let blocked = false;
  let writeChain = Promise.resolve();

  const clearTimer = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  };

  const enqueue = (position: ReadingPosition): Promise<void> => {
    const write = writeChain.then(() => {
      if (blocked) return;
      return persist(position);
    });
    writeChain = write.catch(() => undefined);
    return write;
  };

  const takePending = (): ReadingPosition | null => {
    clearTimer();
    const position = pending;
    pending = null;
    return position;
  };

  const flush = async () => {
    const position = takePending();
    if (position && !blocked) {
      await enqueue(position);
      return;
    }
    await writeChain;
  };

  return {
    schedule(position) {
      if (blocked) return;
      pending = position;
      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        const scheduled = pending;
        pending = null;
        if (scheduled) void enqueue(scheduled).catch(() => undefined);
      }, delayMs);
    },
    async saveNow(position) {
      if (blocked) return;
      takePending();
      await enqueue(position);
    },
    flush,
    async cancel() {
      takePending();
      await writeChain;
    },
    setBlocked(nextBlocked) {
      blocked = nextBlocked;
    },
  };
}
