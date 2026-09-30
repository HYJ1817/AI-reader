import type { BookRecord } from "./db";
import { extractEpubPackage } from "./epubPackage";
import { createLocalId } from "./localId";
import { rememberBookFileBytes } from "./bookFileBytes";

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
  file: File,
  onStage?: (stage: "reading" | "parsing") => void
): Promise<BookRecord> {
  const format = getBookFormatFromFileName(file.name);
  if (!format) {
    const dot = file.name.lastIndexOf(".");
    const ext = dot === -1 ? "" : file.name.slice(dot);
    throw new Error(`Unsupported file type: ${ext}`);
  }

  onStage?.("reading");
  const buffer = await file.arrayBuffer();
  onStage?.("parsing");
  const fileBlob = new Blob([buffer], { type: file.type || "application/octet-stream" });
  rememberBookFileBytes(fileBlob, buffer);
  const epubPackage =
    format === "epub"
      ? await extractEpubPackage(fileBlob, { includeExcerpt: false })
      : undefined;
  const coverImageBlob = epubPackage?.coverImageBlob;
  const packageMetadata = epubPackage?.metadata;
  const hasMetadataHints = Boolean(
    packageMetadata?.title ||
      packageMetadata?.authors?.length ||
      packageMetadata?.identifiers?.length ||
      packageMetadata?.language
  );
  const createdAt = new Date().toISOString();

  return {
    id: createLocalId(),
    title: titleFromFileName(file.name),
    format,
    fileName: file.name,
    fileBlob,
    size: buffer.byteLength,
    createdAt,
    ...(hasMetadataHints
      ? {
          enrichment: {
            ...(packageMetadata?.title
              ? { bibliographicTitle: packageMetadata.title }
              : {}),
            ...(packageMetadata?.authors
              ? { authors: packageMetadata.authors }
              : {}),
            ...(packageMetadata?.identifiers
              ? { identifiers: packageMetadata.identifiers }
              : {}),
            ...(packageMetadata?.language
              ? { language: packageMetadata.language }
              : {}),
            status: "pending" as const,
            attemptedAt: createdAt,
          },
        }
      : {}),
    ...(coverImageBlob ? { coverImageBlob } : {}),
  };
}
