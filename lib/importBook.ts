import type { BookRecord } from "./db";
import { extractEpubCoverImage } from "./epubCover";

export const SUPPORTED_BOOK_EXTENSIONS = ["epub", "txt"] as const;

export function getBookFormatFromFileName(
  fileName: string
): "epub" | "txt" | undefined {
  const dot = fileName.lastIndexOf(".");
  if (dot === -1) return undefined;
  const ext = fileName.slice(dot + 1).toLowerCase();
  if (ext === "epub") return "epub";
  if (ext === "txt") return "txt";
  return undefined;
}

export function titleFromFileName(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  const base = dot === -1 ? fileName : fileName.slice(0, dot);
  return base.replace(/[_-]+/g, " ").trim();
}

export async function createBookRecordFromFile(
  file: File
): Promise<BookRecord> {
  const format = getBookFormatFromFileName(file.name);
  if (!format) {
    const dot = file.name.lastIndexOf(".");
    const ext = dot === -1 ? "" : file.name.slice(dot);
    throw new Error(`Unsupported file type: ${ext}`);
  }

  const buffer = await file.arrayBuffer();
  const fileBlob = new Blob([buffer], { type: file.type || "application/octet-stream" });
  const coverImageBlob =
    format === "epub" ? await extractEpubCoverImage(fileBlob) : undefined;

  return {
    id: crypto.randomUUID(),
    title: titleFromFileName(file.name),
    format,
    fileName: file.name,
    fileBlob,
    size: buffer.byteLength,
    createdAt: new Date().toISOString(),
    ...(coverImageBlob ? { coverImageBlob } : {}),
  };
}
