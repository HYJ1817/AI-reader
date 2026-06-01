import { describe, expect, it, vi } from "vitest";
import type { BookRecord } from "./db";
import { backfillMissingBookCovers } from "./bookCoverBackfill";

function makeBook(overrides: Partial<BookRecord> = {}): BookRecord {
  return {
    id: overrides.id ?? "book",
    title: overrides.title ?? "Book",
    format: overrides.format ?? "epub",
    fileName: overrides.fileName ?? "book.epub",
    fileBlob: overrides.fileBlob ?? new Blob(["content"], { type: "application/epub+zip" }),
    size: overrides.size ?? 7,
    createdAt: overrides.createdAt ?? "2024-01-01T00:00:00.000Z",
    lastOpenedAt: overrides.lastOpenedAt,
    groupIds: overrides.groupIds,
    coverImageBlob: overrides.coverImageBlob,
  };
}

describe("backfillMissingBookCovers", () => {
  it("extracts and saves covers for EPUB books missing cover images", async () => {
    const cover = new Blob(["cover"], { type: "image/png" });
    const book = makeBook({ id: "epub-without-cover" });
    const extractCoverImage = vi.fn().mockResolvedValue(cover);
    const saveBook = vi.fn().mockResolvedValue(undefined);

    const result = await backfillMissingBookCovers([book], {
      extractCoverImage,
      saveBook,
    });

    expect(extractCoverImage).toHaveBeenCalledWith(book.fileBlob);
    expect(saveBook).toHaveBeenCalledWith({ ...book, coverImageBlob: cover });
    expect(result.updatedCount).toBe(1);
    expect(result.books[0].coverImageBlob).toBe(cover);
  });

  it("skips TXT books", async () => {
    const txtBook = makeBook({
      id: "txt",
      format: "txt",
      fileName: "notes.txt",
      fileBlob: new Blob(["notes"], { type: "text/plain" }),
    });
    const extractCoverImage = vi.fn();
    const saveBook = vi.fn();

    const result = await backfillMissingBookCovers([txtBook], {
      extractCoverImage,
      saveBook,
    });

    expect(extractCoverImage).not.toHaveBeenCalled();
    expect(saveBook).not.toHaveBeenCalled();
    expect(result.updatedCount).toBe(0);
    expect(result.books).toEqual([txtBook]);
  });

  it("does not overwrite an existing cover image", async () => {
    const existingCover = new Blob(["existing"], { type: "image/jpeg" });
    const book = makeBook({ coverImageBlob: existingCover });
    const extractCoverImage = vi.fn();
    const saveBook = vi.fn();

    const result = await backfillMissingBookCovers([book], {
      extractCoverImage,
      saveBook,
    });

    expect(extractCoverImage).not.toHaveBeenCalled();
    expect(saveBook).not.toHaveBeenCalled();
    expect(result.books[0].coverImageBlob).toBe(existingCover);
  });

  it("keeps the original book when no cover can be extracted", async () => {
    const book = makeBook();
    const extractCoverImage = vi.fn().mockResolvedValue(undefined);
    const saveBook = vi.fn();

    const result = await backfillMissingBookCovers([book], {
      extractCoverImage,
      saveBook,
    });

    expect(saveBook).not.toHaveBeenCalled();
    expect(result.updatedCount).toBe(0);
    expect(result.books[0]).toBe(book);
  });
});
