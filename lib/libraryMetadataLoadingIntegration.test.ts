import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8"
);
const readerStateSource = readFileSync(
  new URL("../app/useReaderBookState.ts", import.meta.url),
  "utf8"
);

describe("metadata-only library integration", () => {
  it("uses metadata reads for startup and library refreshes", () => {
    expect(pageSource).toContain("listBookMetadata");
    expect(pageSource).not.toContain("listBooks(");
  });

  it("hydrates a target book before reader preparation and export", () => {
    expect(pageSource).toContain("await getBook(book.id)");
    expect(readerStateSource).toContain("await getBook(readerEntry.bookId)");
  });

  it("updates last-opened metadata without rewriting source bytes", () => {
    expect(pageSource).toContain("updateBookLastOpenedAt(book.id, now)");
    expect(pageSource).not.toContain("saveBook({ ...book, lastOpenedAt: now })");
  });
});
