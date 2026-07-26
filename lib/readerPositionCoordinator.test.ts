import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReadingPosition } from "./db";
import { createReaderPositionCoordinator } from "./readerPositionCoordinator";

function makePosition(
  bookId: string,
  progressPercent: number
): ReadingPosition {
  return {
    bookId,
    locator: `txt-${progressPercent}`,
    progressPercent,
    readingMode: "scroll",
    updatedAt: `2026-07-22T00:00:${String(progressPercent).padStart(2, "0")}.000Z`,
  };
}

describe("reader position coordinator", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("persists only the latest scheduled position after the debounce", async () => {
    const saved: ReadingPosition[] = [];
    const coordinator = createReaderPositionCoordinator(async (position) => {
      saved.push(position);
    });
    const first = makePosition("book", 10);
    const latest = makePosition("book", 20);

    coordinator.schedule(first);
    coordinator.schedule(latest);
    await vi.advanceTimersByTimeAsync(180);
    await coordinator.flush();

    expect(saved).toEqual([latest]);
  });

  it("cancels a pending debounce without persisting it", async () => {
    const saved: ReadingPosition[] = [];
    const coordinator = createReaderPositionCoordinator(async (position) => {
      saved.push(position);
    });

    coordinator.schedule(makePosition("book", 25));
    await coordinator.cancel();
    await vi.advanceTimersByTimeAsync(180);

    expect(saved).toEqual([]);
  });

  it("rejects scheduled and immediate writes while blocked", async () => {
    const saved: ReadingPosition[] = [];
    const coordinator = createReaderPositionCoordinator(async (position) => {
      saved.push(position);
    });
    const position = makePosition("book", 30);

    coordinator.setBlocked(true);
    coordinator.schedule(position);
    await coordinator.saveNow(position);
    await vi.advanceTimersByTimeAsync(180);

    expect(saved).toEqual([]);
  });

  it("keeps timer and flush writes ordered", async () => {
    const saved: ReadingPosition[] = [];
    const coordinator = createReaderPositionCoordinator(async (position) => {
      saved.push(position);
    });
    const first = makePosition("first", 40);
    const latest = makePosition("second", 50);

    coordinator.schedule(first);
    await vi.advanceTimersByTimeAsync(180);
    coordinator.schedule(latest);
    await coordinator.flush();

    expect(saved).toEqual([first, latest]);
  });

  it("waits for an already-started write when pending state is cancelled", async () => {
    let releaseWrite!: () => void;
    const writeFinished = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    const coordinator = createReaderPositionCoordinator(async () => {
      await writeFinished;
    });

    coordinator.schedule(makePosition("book", 60));
    await vi.advanceTimersByTimeAsync(180);
    let cancelFinished = false;
    const cancellation = coordinator.cancel().then(() => {
      cancelFinished = true;
    });
    await Promise.resolve();
    expect(cancelFinished).toBe(false);

    releaseWrite();
    await cancellation;
    expect(cancelFinished).toBe(true);
  });
});
