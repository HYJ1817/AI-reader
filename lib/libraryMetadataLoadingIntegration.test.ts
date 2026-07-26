import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8"
);
const readerStateSource = readFileSync(
  new URL("../app/useReaderBookState.ts", import.meta.url),
  "utf8"
);
const coverBackfillQueueSource = readFileSync(
  new URL("./bookCoverBackfill.ts", import.meta.url),
  "utf8"
);
const coverBackfillHookUrl = new URL(
  "../app/useBookCoverBackfill.ts",
  import.meta.url
);
const coverBackfillHookSource = existsSync(coverBackfillHookUrl)
  ? readFileSync(coverBackfillHookUrl, "utf8")
  : "";

describe("metadata-only library integration", () => {
  it("uses metadata reads for startup and library refreshes", () => {
    expect(pageSource).toContain("listBookMetadata");
    expect(pageSource).not.toContain("listBooks(");
  });

  it("hydrates a target book before reader preparation and export", () => {
    expect(pageSource).toContain("await getBook(book.id)");
    expect(readerStateSource).toContain("await getBook(readerEntry.bookId)");
  });

  it("keeps the library surface independent from source-file hydration", () => {
    expect(pageSource).toContain("setBooks(await listBookMetadata())");
    expect(pageSource).not.toContain("Promise.allSettled");
  });

  it("publishes the metadata-only Library before starting cover backfill", () => {
    const publishIndex = coverBackfillHookSource.indexOf("setBooks(storedBooks)");
    const backfillIndex = coverBackfillHookSource.indexOf(
      "startBookCoverBackfill(storedBooks)"
    );
    expect(publishIndex).toBeGreaterThan(-1);
    expect(backfillIndex).toBeGreaterThan(publishIndex);
    expect(coverBackfillHookSource).not.toContain(
      "await startBookCoverBackfill(storedBooks)"
    );
  });

  it("hydrates at most one EPUB per queue step instead of all source files", () => {
    expect(coverBackfillHookSource).toContain("runBookCoverBackfill");
    expect(coverBackfillHookSource).toContain("loadMissingBookCover");
    expect(coverBackfillHookSource).toContain("extractEpubCoverImage");
    expect(coverBackfillHookSource).not.toContain("listBooks(");
    expect(coverBackfillQueueSource).not.toContain("Promise.all");
  });

  it("updates last-opened metadata without rewriting source bytes", () => {
    expect(pageSource).toContain("updateBookLastOpenedAt(book.id, now)");
    expect(pageSource).not.toContain("saveBook({ ...book, lastOpenedAt: now })");
  });
});
