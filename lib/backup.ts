import {
  listBooks,
  listReadingPositions,
  listAllAnnotations,
  saveBook,
  saveReadingPosition,
  addAnnotation,
  clearAllReaderData,
  listBookGroups,
  saveBookGroup,
  type BookRecord,
  type ReadingPosition,
  type AnnotationRecord,
  type BookGroup,
} from "./db";
import { loadAiSettings, saveAiSettingsToStorage, DEFAULT_AI_SETTINGS } from "./aiSettings";

export interface BackupBookMeta {
  id: string;
  title: string;
  format: "epub" | "txt";
  fileName: string;
  size: number;
  createdAt: string;
  lastOpenedAt?: string;
  fileContent: string;
  groupIds?: string[];
}

export interface BackupPayload {
  version: 1;
  exportedAt: string;
  books: BackupBookMeta[];
  readingPositions: ReadingPosition[];
  annotations: AnnotationRecord[];
  aiSettings: { baseUrl: string; model: string };
  bookGroups: BookGroup[];
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  const mimeType = blob.type || "application/octet-stream";
  return `data:${mimeType};base64,${base64}`;
}

function base64ToBlob(dataUrl: string, mimeType: string): Blob {
  const parts = dataUrl.split(",");
  const base64 = parts.length > 1 ? parts[1] : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

export async function createBackupPayload(
  input?: { aiSettings?: { baseUrl: string; apiKey: string; model: string } }
): Promise<BackupPayload> {
  const books = await listBooks();
  const positions = await listReadingPositions();
  const annotations = await listAllAnnotations();
  const groups = await listBookGroups();

  const aiSource = input?.aiSettings ?? loadAiSettings();

  const backupBooks: BackupBookMeta[] = await Promise.all(
    books.map(async (book) => ({
      id: book.id,
      title: book.title,
      format: book.format,
      fileName: book.fileName,
      size: book.size,
      createdAt: book.createdAt,
      lastOpenedAt: book.lastOpenedAt,
      fileContent: await blobToBase64(book.fileBlob),
      groupIds: book.groupIds,
    }))
  );

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    books: backupBooks,
    readingPositions: positions,
    annotations,
    aiSettings: {
      baseUrl: aiSource.baseUrl,
      model: aiSource.model,
    },
    bookGroups: groups,
  };
}

export function validateBackupPayload(data: unknown): BackupPayload {
  if (data === null || typeof data !== "object") {
    throw new Error("Invalid backup format");
  }
  const obj = data as Record<string, unknown>;
  if (obj.version !== 1) {
    throw new Error("Invalid backup: unsupported version");
  }
  if (!Array.isArray(obj.books)) {
    throw new Error("Invalid backup: missing books array");
  }
  if (!Array.isArray(obj.readingPositions)) {
    throw new Error("Invalid backup: missing readingPositions array");
  }
  if (!Array.isArray(obj.annotations)) {
    throw new Error("Invalid backup: missing annotations array");
  }
  if (typeof obj.exportedAt !== "string") {
    throw new Error("Invalid backup: missing exportedAt");
  }
  return data as BackupPayload;
}

export async function restoreBackupPayload(data: unknown): Promise<void> {
  const payload = validateBackupPayload(data);

  await clearAllReaderData();

  if (payload.bookGroups) {
    for (const group of payload.bookGroups) {
      await saveBookGroup(group);
    }
  }

  for (const book of payload.books) {
    const mimeType =
      book.format === "epub" ? "application/epub+zip" : "text/plain";
    const fileBlob = base64ToBlob(book.fileContent, mimeType);
    const record: BookRecord = {
      id: book.id,
      title: book.title,
      format: book.format,
      fileName: book.fileName,
      fileBlob,
      size: book.size,
      createdAt: book.createdAt,
      lastOpenedAt: book.lastOpenedAt,
      ...(book.groupIds ? { groupIds: book.groupIds } : {}),
    };
    await saveBook(record);
  }

  for (const pos of payload.readingPositions) {
    await saveReadingPosition(pos);
  }

  for (const ann of payload.annotations) {
    await addAnnotation(ann);
  }

  if (payload.aiSettings) {
    saveAiSettingsToStorage({
      baseUrl: payload.aiSettings.baseUrl || DEFAULT_AI_SETTINGS.baseUrl,
      model: payload.aiSettings.model || DEFAULT_AI_SETTINGS.model,
      apiKey: "",
    });
  }
}
