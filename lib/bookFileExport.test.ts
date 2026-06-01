import { describe, expect, it } from "vitest";
import type { BookRecord } from "./db";
import { createBookFileExport, getBookExportFileName } from "./bookFileExport";

function makeBook(overrides: Partial<BookRecord> = {}): BookRecord {
  return {
    id: "b1",
    title: "测试书籍",
    format: "txt",
    fileName: "测试书籍.txt",
    fileBlob: new Blob(["hello"], { type: "text/plain" }),
    size: 5,
    createdAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("getBookExportFileName", () => {
  it("keeps the original file name when it has the expected extension", () => {
    expect(getBookExportFileName(makeBook({ fileName: "原文件.epub", format: "epub" }))).toBe(
      "原文件.epub"
    );
  });

  it("uses the title and format when the original file name is missing the extension", () => {
    expect(getBookExportFileName(makeBook({ title: "高兴/第一章", fileName: "高兴", format: "txt" }))).toBe(
      "高兴_第一章.txt"
    );
  });
});

describe("createBookFileExport", () => {
  it("returns a txt blob with the export file name", async () => {
    const exported = await createBookFileExport(makeBook());

    expect(exported.fileName).toBe("测试书籍.txt");
    expect(exported.blob.type).toBe("text/plain");
    expect(await exported.blob.text()).toBe("hello");
  });

  it("returns an epub blob with epub mime type", async () => {
    const exported = await createBookFileExport(
      makeBook({
        format: "epub",
        fileName: "book.epub",
        fileBlob: new Blob(["epub"], { type: "" }),
      })
    );

    expect(exported.fileName).toBe("book.epub");
    expect(exported.blob.type).toBe("application/epub+zip");
  });
});
