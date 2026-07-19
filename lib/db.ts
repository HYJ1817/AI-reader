import Dexie, { type EntityTable } from "dexie";
import type { ReaderMode } from "./readerMode";

export type BookRecord = {
  id: string;
  title: string;
  format: "epub" | "txt";
  fileName: string;
  fileBlob: Blob;
  size: number;
  createdAt: string;
  lastOpenedAt?: string;
  groupIds?: string[];
  coverImageBlob?: Blob;
};

type StoredBookRecord = Omit<BookRecord, "fileBlob" | "coverImageBlob"> & {
  fileBlob?: Blob;
  coverImageBlob?: Blob;
};

type BookFileRecord = {
  bookId: string;
  fileData: ArrayBuffer;
  fileType: string;
  coverImageData?: ArrayBuffer;
  coverImageType?: string;
};

export type ReadingPosition = {
  bookId: string;
  locator: string;
  progressPercent: number;
  readingMode?: ReaderMode;
  updatedAt: string;
};

export type AnnotationKind = "bookmark" | "highlight";
export type HighlightColor = "yellow" | "green" | "blue";

export type AnnotationRecord = {
  id: string;
  bookId: string;
  kind: AnnotationKind;
  locator?: string;
  text: string;
  note?: string;
  color?: HighlightColor;
  progressPercent?: number;
  pageNumber?: number;
  createdAt: string;
};

function normalizeAnnotation(record: AnnotationRecord): AnnotationRecord {
  const kind = record.kind === "bookmark" ? "bookmark" : "highlight";
  const color: HighlightColor =
    record.color === "green" || record.color === "blue"
      ? record.color
      : "yellow";
  return {
    ...record,
    kind,
    ...(kind === "highlight" ? { color } : { color: undefined }),
  };
}

export type DailyReadingStat = {
  date: string;
  secondsRead: number;
  updatedAt: string;
};

export type BookGroup = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type CustomBackgroundRecord = {
  id: "app-background";
  imageBlob: Blob;
  updatedAt: string;
};

const CUSTOM_BACKGROUND_ID: CustomBackgroundRecord["id"] = "app-background";

type AiReaderDb = Dexie & {
  books: EntityTable<StoredBookRecord, "id">;
  bookFiles: EntityTable<BookFileRecord, "bookId">;
  readingPositions: EntityTable<ReadingPosition, "bookId">;
  annotations: EntityTable<AnnotationRecord, "id">;
  dailyReadingStats: EntityTable<DailyReadingStat, "date">;
  bookGroups: EntityTable<BookGroup, "id">;
  customBackgrounds: EntityTable<CustomBackgroundRecord, "id">;
};

function createDb(): AiReaderDb {
  const db = new Dexie("AiReader") as AiReaderDb;

  db.version(1).stores({
    books: "id, lastOpenedAt, createdAt",
    readingPositions: "bookId",
    annotations: "id, bookId, createdAt",
  });

  db.version(2).stores({
    dailyReadingStats: "date",
  });

  db.version(3).stores({
    bookGroups: "id, createdAt, name",
  });

  db.version(4).stores({
    customBackgrounds: "id, updatedAt",
  });

  db.version(5).stores({
    bookFiles: "bookId",
  });

  return db;
}

const db: AiReaderDb | null =
  typeof indexedDB === "undefined" ? null : createDb();

function getDb(): AiReaderDb {
  if (!db) {
    throw new Error("IndexedDB is unavailable in this browser.");
  }
  return db;
}

export async function saveBook(record: BookRecord): Promise<void> {
  const db = getDb();
  const { fileBlob, coverImageBlob, ...metadata } = record;
  const fileRecord: BookFileRecord = {
    bookId: record.id,
    fileData: await fileBlob.arrayBuffer(),
    fileType: fileBlob.type || "application/octet-stream",
    ...(coverImageBlob
      ? {
          coverImageData: await coverImageBlob.arrayBuffer(),
          coverImageType: coverImageBlob.type || "image/*",
        }
      : {}),
  };
  await db.transaction("rw", [db.books, db.bookFiles], async () => {
    await db.books.put(metadata);
    await db.bookFiles.put(fileRecord);
  });
}

export async function listBooks(): Promise<BookRecord[]> {
  const db = getDb();
  const storedBooks = await db.books.toArray();
  const all = await Promise.all(
    storedBooks.map(async (storedBook) => {
      const fileRecord = await db.bookFiles.get(storedBook.id);
      if (fileRecord) return hydrateBookRecord(storedBook, fileRecord);
      if (!(storedBook.fileBlob instanceof Blob)) {
        throw new Error(`Stored file is unavailable for book ${storedBook.id}.`);
      }
      const legacyBook: BookRecord = {
        ...storedBook,
        fileBlob: storedBook.fileBlob,
        ...(storedBook.coverImageBlob
          ? { coverImageBlob: storedBook.coverImageBlob }
          : {}),
      };
      await saveBook(legacyBook);
      return legacyBook;
    })
  );
  return all.sort((a, b) => {
    const aTime = a.lastOpenedAt ?? a.createdAt;
    const bTime = b.lastOpenedAt ?? b.createdAt;
    if (aTime !== bTime) return bTime.localeCompare(aTime);
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export async function getBook(id: string): Promise<BookRecord | undefined> {
  const db = getDb();
  const storedBook = await db.books.get(id);
  if (!storedBook) return undefined;
  const fileRecord = await db.bookFiles.get(id);
  if (fileRecord) return hydrateBookRecord(storedBook, fileRecord);
  if (!(storedBook.fileBlob instanceof Blob)) return undefined;
  const legacyBook: BookRecord = {
    ...storedBook,
    fileBlob: storedBook.fileBlob,
    ...(storedBook.coverImageBlob
      ? { coverImageBlob: storedBook.coverImageBlob }
      : {}),
  };
  await saveBook(legacyBook);
  return legacyBook;
}

function hydrateBookRecord(
  storedBook: StoredBookRecord,
  fileRecord: BookFileRecord
): BookRecord {
  const metadata = { ...storedBook };
  delete metadata.fileBlob;
  delete metadata.coverImageBlob;
  return {
    ...metadata,
    fileBlob: new Blob([fileRecord.fileData], { type: fileRecord.fileType }),
    ...(fileRecord.coverImageData
      ? {
          coverImageBlob: new Blob([fileRecord.coverImageData], {
            type: fileRecord.coverImageType || "image/*",
          }),
        }
      : {}),
  };
}

export async function deleteBook(id: string): Promise<void> {
  const db = getDb();
  await db.transaction("rw", [db.books, db.bookFiles, db.readingPositions, db.annotations], async () => {
    await db.books.delete(id);
    await db.bookFiles.delete(id);
    await db.readingPositions.delete(id);
    await db.annotations.where("bookId").equals(id).delete();
  });
}

export async function saveReadingPosition(position: ReadingPosition): Promise<void> {
  await getDb().readingPositions.put(position);
}

export async function getReadingPosition(
  bookId: string
): Promise<ReadingPosition | undefined> {
  return getDb().readingPositions.get(bookId);
}

export async function addAnnotation(record: AnnotationRecord): Promise<void> {
  await getDb().annotations.put(record);
}

export async function deleteAnnotation(id: string): Promise<void> {
  await getDb().annotations.delete(id);
}

export async function listAnnotations(bookId: string): Promise<AnnotationRecord[]> {
  const records = await getDb().annotations
    .where("bookId")
    .equals(bookId)
    .sortBy("createdAt");
  return records.map(normalizeAnnotation);
}

export async function listReadingPositions(): Promise<ReadingPosition[]> {
  return getDb().readingPositions.toArray();
}

export async function listAllAnnotations(): Promise<AnnotationRecord[]> {
  const records = await getDb().annotations.toArray();
  return records.map(normalizeAnnotation);
}

export async function listBookGroups(): Promise<BookGroup[]> {
  const all = await getDb().bookGroups.toArray();
  return all.sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt);
    return a.name.localeCompare(b.name);
  });
}

export async function saveBookGroup(group: BookGroup): Promise<void> {
  await getDb().bookGroups.put(group);
}

export async function deleteBookGroup(id: string): Promise<void> {
  const db = getDb();
  await db.transaction("rw", [db.bookGroups, db.books], async () => {
    await db.bookGroups.delete(id);
    const books = await db.books.toArray();
    for (const book of books) {
      if (book.groupIds && book.groupIds.includes(id)) {
        await db.books.update(book.id, {
          groupIds: book.groupIds.filter((gid) => gid !== id),
        });
      }
    }
  });
}

export async function updateBookGroupName(id: string, name: string): Promise<void> {
  const db = getDb();
  const trimmed = name.trim();
  if (!trimmed) return;
  const existing = await db.bookGroups.get(id);
  if (!existing) return;
  await db.bookGroups.update(id, { name: trimmed, updatedAt: new Date().toISOString() });
}

export async function updateBookGroupMembership(bookId: string, groupIds: string[]): Promise<void> {
  const db = getDb();
  const book = await db.books.get(bookId);
  if (!book) return;
  const deduped = [...new Set(groupIds)];
  await db.books.update(bookId, { groupIds: deduped });
}

export async function saveCustomBackgroundImage(imageBlob: Blob): Promise<void> {
  await getDb().customBackgrounds.put({
    id: CUSTOM_BACKGROUND_ID,
    imageBlob,
    updatedAt: new Date().toISOString(),
  });
}

export async function getCustomBackgroundImage(): Promise<Blob | null> {
  const record = await getDb().customBackgrounds.get(CUSTOM_BACKGROUND_ID);
  return record?.imageBlob ?? null;
}

export async function getCustomBackgroundRecord(): Promise<CustomBackgroundRecord | null> {
  return (await getDb().customBackgrounds.get(CUSTOM_BACKGROUND_ID)) ?? null;
}

export async function deleteCustomBackgroundImage(): Promise<void> {
  await getDb().customBackgrounds.delete(CUSTOM_BACKGROUND_ID);
}

export async function clearAllReaderData(): Promise<void> {
  const db = getDb();
  await db.transaction("rw", [db.books, db.bookFiles, db.readingPositions, db.annotations, db.dailyReadingStats, db.bookGroups, db.customBackgrounds], async () => {
    await db.books.clear();
    await db.bookFiles.clear();
    await db.readingPositions.clear();
    await db.annotations.clear();
    await db.dailyReadingStats.clear();
    await db.bookGroups.clear();
    await db.customBackgrounds.clear();
  });
}

export type ReaderDataReplacement = {
  books: BookRecord[];
  readingPositions: ReadingPosition[];
  annotations: AnnotationRecord[];
  bookGroups: BookGroup[];
  dailyReadingStats?: DailyReadingStat[];
  customBackground?: CustomBackgroundRecord | null;
};

export async function replaceReaderData(data: ReaderDataReplacement): Promise<void> {
  const db = getDb();
  const serializedBooks = await Promise.all(
    data.books.map(async ({ fileBlob, coverImageBlob, ...metadata }) => ({
      metadata,
      file: {
        bookId: metadata.id,
        fileData: await fileBlob.arrayBuffer(),
        fileType: fileBlob.type || "application/octet-stream",
        ...(coverImageBlob
          ? {
              coverImageData: await coverImageBlob.arrayBuffer(),
              coverImageType: coverImageBlob.type || "image/*",
            }
          : {}),
      } satisfies BookFileRecord,
    }))
  );
  await db.transaction(
    "rw",
    [
      db.books,
      db.bookFiles,
      db.readingPositions,
      db.annotations,
      db.bookGroups,
      db.dailyReadingStats,
      db.customBackgrounds,
    ],
    async () => {
      await db.books.clear();
      await db.bookFiles.clear();
      await db.readingPositions.clear();
      await db.annotations.clear();
      await db.bookGroups.clear();
      if (serializedBooks.length > 0) {
        await db.books.bulkPut(serializedBooks.map((book) => book.metadata));
        await db.bookFiles.bulkPut(serializedBooks.map((book) => book.file));
      }
      if (data.readingPositions.length > 0) {
        await db.readingPositions.bulkPut(data.readingPositions);
      }
      if (data.annotations.length > 0) await db.annotations.bulkPut(data.annotations);
      if (data.bookGroups.length > 0) await db.bookGroups.bulkPut(data.bookGroups);

      if (data.dailyReadingStats !== undefined) {
        await db.dailyReadingStats.clear();
        if (data.dailyReadingStats.length > 0) {
          await db.dailyReadingStats.bulkPut(data.dailyReadingStats);
        }
      }
      if (data.customBackground !== undefined) {
        await db.customBackgrounds.clear();
        if (data.customBackground) {
          await db.customBackgrounds.put(data.customBackground);
        }
      }
    }
  );
}

export async function getDailyReadingStat(
  date: string
): Promise<DailyReadingStat | undefined> {
  return getDb().dailyReadingStats.get(date);
}

export async function incrementDailyReadingSeconds(
  date: string,
  seconds: number
): Promise<void> {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const db = getDb();
  const safeSeconds = Math.floor(seconds);
  await db.transaction("rw", [db.dailyReadingStats], async () => {
    const existing = await db.dailyReadingStats.get(date);
    if (existing) {
      await db.dailyReadingStats.put({
        date,
        secondsRead: existing.secondsRead + safeSeconds,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await db.dailyReadingStats.put({
        date,
        secondsRead: safeSeconds,
        updatedAt: new Date().toISOString(),
      });
    }
  });
}

export async function listDailyReadingStats(): Promise<DailyReadingStat[]> {
  return getDb().dailyReadingStats.toArray();
}
