import type { BookRecord } from "./db";

const MIME_BY_FORMAT: Record<BookRecord["format"], string> = {
  epub: "application/epub+zip",
  txt: "text/plain",
};

function sanitizeFileNamePart(value: string): string {
  return value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "_").replace(/\s+/g, " ");
}

export function getBookExportFileName(book: BookRecord): string {
  const extension = `.${book.format}`;
  const originalName = sanitizeFileNamePart(book.fileName);

  if (originalName.toLocaleLowerCase().endsWith(extension)) {
    return originalName;
  }

  const titleName = sanitizeFileNamePart(book.title) || "book";
  return `${titleName}${extension}`;
}

export async function createBookFileExport(
  book: BookRecord
): Promise<{ fileName: string; blob: Blob }> {
  const buffer = await book.fileBlob.arrayBuffer();
  return {
    fileName: getBookExportFileName(book),
    blob: new Blob([buffer], {
      type: book.fileBlob.type || MIME_BY_FORMAT[book.format],
    }),
  };
}
