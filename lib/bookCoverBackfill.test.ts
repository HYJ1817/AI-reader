import { describe, expect, it, vi } from "vitest";
import type { BookMetadata } from "./db";
import { runBookCoverBackfill } from "./bookCoverBackfill";

function makeBook(overrides: Partial<BookMetadata> = {}): BookMetadata {
  return {
    id: overrides.id ?? "book",
    title: overrides.title ?? "Book",
    format: overrides.format ?? "epub",
    fileName: overrides.fileName ?? "book.epub",
    size: overrides.size ?? 7,
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
    lastOpenedAt: overrides.lastOpenedAt,
    groupIds: overrides.groupIds,
    coverImageBlob: overrides.coverImageBlob,
  };
}

describe("runBookCoverBackfill", () => {
  it("processes visible books before off-screen books", async () => {
    const books = [
      makeBook({ id: "offscreen-first" }),
      makeBook({ id: "visible" }),
      makeBook({ id: "offscreen-last" }),
    ];
    const order: string[] = [];

    await runBookCoverBackfill({
      books,
      getVisibleBookIds: () => ["visible"],
      loadCover: async (bookId) => {
        order.push(bookId);
        return new Blob([bookId]);
      },
      onCover: vi.fn(),
    });

    expect(order).toEqual(["visible", "offscreen-first", "offscreen-last"]);
  });

  it("re-evaluates visible priority before selecting each next book", async () => {
    const books = [
      makeBook({ id: "first" }),
      makeBook({ id: "second" }),
      makeBook({ id: "third" }),
    ];
    const order: string[] = [];
    let visibleIds = ["first"];

    await runBookCoverBackfill({
      books,
      getVisibleBookIds: () => visibleIds,
      loadCover: async (bookId) => {
        order.push(bookId);
        if (bookId === "first") visibleIds = ["third"];
        return new Blob([bookId]);
      },
      onCover: vi.fn(),
    });

    expect(order).toEqual(["first", "third", "second"]);
  });

  it("never processes more than one EPUB at a time", async () => {
    const books = [
      makeBook({ id: "one" }),
      makeBook({ id: "two" }),
      makeBook({ id: "three" }),
    ];
    let active = 0;
    let maxActive = 0;

    await runBookCoverBackfill({
      books,
      getVisibleBookIds: () => [],
      loadCover: async (bookId) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await Promise.resolve();
        active -= 1;
        return new Blob([bookId]);
      },
      onCover: vi.fn(),
    });

    expect(maxActive).toBe(1);
  });

  it("skips TXT books and metadata that already has a cover", async () => {
    const existingCover = new Blob(["existing"]);
    const loadCover = vi.fn().mockResolvedValue(new Blob(["new"]));

    await runBookCoverBackfill({
      books: [
        makeBook({ id: "txt", format: "txt", fileName: "notes.txt" }),
        makeBook({ id: "covered", coverImageBlob: existingCover }),
        makeBook({ id: "missing" }),
      ],
      getVisibleBookIds: () => ["txt", "covered", "missing"],
      loadCover,
      onCover: vi.fn(),
    });

    expect(loadCover).toHaveBeenCalledTimes(1);
    expect(loadCover).toHaveBeenCalledWith("missing");
  });

  it("publishes each successful cover as soon as that book completes", async () => {
    const events: string[] = [];

    await runBookCoverBackfill({
      books: [makeBook({ id: "one" }), makeBook({ id: "two" })],
      getVisibleBookIds: () => [],
      loadCover: async (bookId) => {
        events.push(`load:${bookId}`);
        return new Blob([bookId]);
      },
      onCover: (bookId) => events.push(`publish:${bookId}`),
    });

    expect(events).toEqual([
      "load:one",
      "publish:one",
      "load:two",
      "publish:two",
    ]);
  });

  it("continues after a rejected or coverless book", async () => {
    const published: string[] = [];
    const loadCover = vi
      .fn<(bookId: string) => Promise<Blob | undefined>>()
      .mockRejectedValueOnce(new Error("damaged epub"))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(new Blob(["third cover"]));

    const result = await runBookCoverBackfill({
      books: [
        makeBook({ id: "damaged" }),
        makeBook({ id: "coverless" }),
        makeBook({ id: "healthy" }),
      ],
      getVisibleBookIds: () => [],
      loadCover,
      onCover: (bookId) => published.push(bookId),
    });

    expect(loadCover).toHaveBeenCalledTimes(3);
    expect(published).toEqual(["healthy"]);
    expect(result.attemptedIds).toEqual(["damaged", "coverless", "healthy"]);
    expect(result.completedIds).toEqual(["healthy"]);
  });

  it("stops selecting and publishing after cancellation", async () => {
    const controller = new AbortController();
    const onCover = vi.fn();

    const result = await runBookCoverBackfill({
      books: [makeBook({ id: "one" }), makeBook({ id: "two" })],
      getVisibleBookIds: () => [],
      loadCover: async () => {
        controller.abort();
        return new Blob(["cover"]);
      },
      onCover,
      signal: controller.signal,
    });

    expect(result.attemptedIds).toEqual(["one"]);
    expect(result.completedIds).toEqual([]);
    expect(onCover).not.toHaveBeenCalled();
  });
});
