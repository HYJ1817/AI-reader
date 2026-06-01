import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import {
  SUPPORTED_BOOK_EXTENSIONS,
  getBookFormatFromFileName,
  titleFromFileName,
  createBookRecordFromFile,
} from "./importBook";

describe("SUPPORTED_BOOK_EXTENSIONS", () => {
  it("contains epub and txt", () => {
    expect(SUPPORTED_BOOK_EXTENSIONS).toContain("epub");
    expect(SUPPORTED_BOOK_EXTENSIONS).toContain("txt");
  });
});

describe("getBookFormatFromFileName", () => {
  it("detects epub extension", () => {
    expect(getBookFormatFromFileName("book.epub")).toBe("epub");
  });

  it("detects txt extension", () => {
    expect(getBookFormatFromFileName("notes.txt")).toBe("txt");
  });

  it("detects uppercase extensions", () => {
    expect(getBookFormatFromFileName("book.EPUB")).toBe("epub");
    expect(getBookFormatFromFileName("notes.TXT")).toBe("txt");
  });

  it("detects mixed-case extensions", () => {
    expect(getBookFormatFromFileName("book.Epub")).toBe("epub");
  });

  it("returns undefined for unsupported extension", () => {
    expect(getBookFormatFromFileName("file.pdf")).toBeUndefined();
    expect(getBookFormatFromFileName("file.doc")).toBeUndefined();
    expect(getBookFormatFromFileName("file")).toBeUndefined();
  });
});

describe("titleFromFileName", () => {
  it("strips .epub extension", () => {
    expect(titleFromFileName("my-book.epub")).toBe("my book");
  });

  it("strips .txt extension", () => {
    expect(titleFromFileName("notes.txt")).toBe("notes");
  });

  it("replaces underscores and hyphens with spaces", () => {
    expect(titleFromFileName("my_great-book.epub")).toBe("my great book");
  });

  it("trims whitespace", () => {
    expect(titleFromFileName("  title.txt  ")).toBe("title");
  });

  it("handles uppercase extensions in stripping", () => {
    expect(titleFromFileName("my-book.EPUB")).toBe("my book");
  });
});

describe("createBookRecordFromFile", () => {
  function makeFile(name: string, content = "test content"): File {
    return new File([content], name, { type: "application/octet-stream" });
  }

  async function makeEpubFileWithCover(): Promise<File> {
    const zip = new JSZip();
    zip.file(
      "META-INF/container.xml",
      `<container><rootfiles><rootfile full-path="OPS/package.opf"/></rootfiles></container>`
    );
    zip.file(
      "OPS/package.opf",
      `<package><manifest><item id="cover" href="cover.png" media-type="image/png" properties="cover-image"/></manifest></package>`
    );
    zip.file("OPS/cover.png", "cover bytes");
    const data = await zip.generateAsync({ type: "uint8array" });
    return new File([data], "covered.epub", { type: "application/epub+zip" });
  }

  it("creates a record from an epub file", async () => {
    const file = makeFile("my-book.epub", "epub data");
    const record = await createBookRecordFromFile(file);

    expect(record.id).toBeDefined();
    expect(typeof record.id).toBe("string");
    expect(record.title).toBe("my book");
    expect(record.format).toBe("epub");
    expect(record.fileName).toBe("my-book.epub");
    expect(record.fileBlob).toBeInstanceOf(Blob);
    expect(record.size).toBe(Buffer.from("epub data").length);
    expect(record.createdAt).toBeDefined();
    expect(new Date(record.createdAt).toISOString()).toBe(record.createdAt);
  });

  it("stores an extracted EPUB cover image when available", async () => {
    const record = await createBookRecordFromFile(await makeEpubFileWithCover());

    expect(record.coverImageBlob).toBeInstanceOf(Blob);
    expect(record.coverImageBlob?.type).toBe("image/png");
    expect(await record.coverImageBlob?.text()).toBe("cover bytes");
  });

  it("creates a record from a txt file", async () => {
    const file = makeFile("notes.txt", "hello world");
    const record = await createBookRecordFromFile(file);

    expect(record.format).toBe("txt");
    expect(record.title).toBe("notes");
    expect(record.fileName).toBe("notes.txt");
    expect(record.coverImageBlob).toBeUndefined();
  });

  it("handles uppercase extension", async () => {
    const file = makeFile("BOOK.EPUB");
    const record = await createBookRecordFromFile(file);

    expect(record.format).toBe("epub");
    expect(record.title).toBe("BOOK");
  });

  it("throws for unsupported file type", async () => {
    const file = makeFile("document.pdf");

    await expect(createBookRecordFromFile(file)).rejects.toThrow(
      "Unsupported file type: .pdf"
    );
  });

  it("throws for file with no extension", async () => {
    const file = makeFile("noext");

    await expect(createBookRecordFromFile(file)).rejects.toThrow(
      "Unsupported file type"
    );
  });

  it("stores file content as blob", async () => {
    const content = "the quick brown fox";
    const file = makeFile("test.txt", content);
    const record = await createBookRecordFromFile(file);

    const text = await record.fileBlob.text();
    expect(text).toBe(content);
  });

  it("generates unique ids for different files", async () => {
    const r1 = await createBookRecordFromFile(makeFile("a.txt"));
    const r2 = await createBookRecordFromFile(makeFile("b.txt"));

    expect(r1.id).not.toBe(r2.id);
  });
});
