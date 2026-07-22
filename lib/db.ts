import Dexie, { type EntityTable } from "dexie";
import type { ReaderMode } from "./readerMode";

export type BookMetadata = {
  id: string;
  title: string;
  format: "epub" | "txt";
  fileName: string;
  size: number;
  createdAt: string;
  lastOpenedAt?: string;
  groupIds?: string[];
  coverImageBlob?: Blob;
};

export type BookRecord = BookMetadata & {
  fileBlob: Blob;
};

type StoredBookRecord = Omit<BookMetadata, "coverImageBlob"> & {
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

type BookCoverRecord = {
  bookId: string;
  coverImageData: ArrayBuffer;
  coverImageType: string;
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
  bookCovers: EntityTable<BookCoverRecord, "bookId">;
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

  db.version(6).stores({
    bookCovers: "bookId",
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
  };
  const coverRecord: BookCoverRecord | null = coverImageBlob
    ? {
        bookId: record.id,
        coverImageData: await coverImageBlob.arrayBuffer(),
        coverImageType: coverImageBlob.type || "image/*",
      }
    : null;
  await db.transaction("rw", [db.books, db.bookFiles, db.bookCovers], async () => {
    await db.books.put(metadata);
    await db.bookFiles.put(fileRecord);
    if (coverRecord) {
      await db.bookCovers.put(coverRecord);
    } else {
      await db.bookCovers.delete(record.id);
    }
  });
}

function compareBooksByRecency(a: BookMetadata, b: BookMetadata): number {
  const aTime = a.lastOpenedAt ?? a.createdAt;
  const bTime = b.lastOpenedAt ?? b.createdAt;
  if (aTime !== bTime) return bTime.localeCompare(aTime);
  return b.createdAt.localeCompare(a.createdAt);
}

function hydrateCover(record?: BookCoverRecord): Blob | undefined {
  return record
    ? new Blob([record.coverImageData], {
        type: record.coverImageType || "image/*",
      })
    : undefined;
}

function toBookMetadata(
  storedBook: StoredBookRecord,
  coverRecord?: BookCoverRecord
): BookMetadata {
  const coverImageBlob = hydrateCover(coverRecord) ?? storedBook.coverImageBlob;
  return {
    id: storedBook.id,
    title: storedBook.title,
    format: storedBook.format,
    fileName: storedBook.fileName,
    size: storedBook.size,
    createdAt: storedBook.createdAt,
    ...(storedBook.lastOpenedAt
      ? { lastOpenedAt: storedBook.lastOpenedAt }
      : {}),
    ...(storedBook.groupIds ? { groupIds: storedBook.groupIds } : {}),
    ...(coverImageBlob ? { coverImageBlob } : {}),
  };
}

export async function listBookMetadata(): Promise<BookMetadata[]> {
  const db = getDb();
  const [storedBooks, covers] = await Promise.all([
    db.books.toArray(),
    db.bookCovers.toArray(),
  ]);
  const coverByBookId = new Map(covers.map((cover) => [cover.bookId, cover]));
  return storedBooks
    .map((book) => toBookMetadata(book, coverByBookId.get(book.id)))
    .sort(compareBooksByRecency);
}

export async function getBookFile(id: string): Promise<Blob | undefined> {
  const db = getDb();
  const fileRecord = await db.bookFiles.get(id);
  if (fileRecord) {
    return new Blob([fileRecord.fileData], { type: fileRecord.fileType });
  }

  const storedBook = await db.books.get(id);
  if (!(storedBook?.fileBlob instanceof Blob)) return undefined;
  const legacyBook: BookRecord = {
    ...toBookMetadata(storedBook),
    fileBlob: storedBook.fileBlob,
  };
  await saveBook(legacyBook);
  return storedBook.fileBlob;
}

export async function listBooks(): Promise<BookRecord[]> {
  const metadata = await listBookMetadata();
  return Promise.all(
    metadata.map(async (book) => {
      const hydrated = await getBook(book.id);
      if (!hydrated) {
        throw new Error(`Stored file is unavailable for book ${book.id}.`);
      }
      return hydrated;
    })
  );
}

export async function getBook(id: string): Promise<BookRecord | undefined> {
  const db = getDb();
  const storedBook = await db.books.get(id);
  if (!storedBook) return undefined;
  const fileRecord = await db.bookFiles.get(id);
  if (fileRecord) {
    let coverRecord = await db.bookCovers.get(id);
    if (!coverRecord && fileRecord.coverImageData) {
      coverRecord = {
        bookId: id,
        coverImageData: fileRecord.coverImageData,
        coverImageType: fileRecord.coverImageType || "image/*",
      };
      await db.bookCovers.put(coverRecord);
    }
    return {
      ...toBookMetadata(storedBook, coverRecord),
      fileBlob: new Blob([fileRecord.fileData], { type: fileRecord.fileType }),
    };
  }
  if (!(storedBook.fileBlob instanceof Blob)) return undefined;
  const legacyBook: BookRecord = {
    ...toBookMetadata(storedBook),
    fileBlob: storedBook.fileBlob,
  };
  await saveBook(legacyBook);
  return legacyBook;
}

export async function deleteBook(id: string): Promise<void> {
  const db = getDb();
  await db.transaction("rw", [db.books, db.bookFiles, db.bookCovers, db.readingPositions, db.annotations], async () => {
    await db.books.delete(id);
    await db.bookFiles.delete(id);
    await db.bookCovers.delete(id);
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
  await db.transaction("rw", [db.books, db.bookFiles, db.bookCovers, db.readingPositions, db.annotations, db.dailyReadingStats, db.bookGroups, db.customBackgrounds], async () => {
    await db.books.clear();
    await db.bookFiles.clear();
    await db.bookCovers.clear();
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
      } satisfies BookFileRecord,
      cover: coverImageBlob
        ? ({
            bookId: metadata.id,
            coverImageData: await coverImageBlob.arrayBuffer(),
            coverImageType: coverImageBlob.type || "image/*",
          } satisfies BookCoverRecord)
        : null,
    }))
  );
  await db.transaction(
    "rw",
    [
      db.books,
      db.bookFiles,
      db.bookCovers,
      db.readingPositions,
      db.annotations,
      db.bookGroups,
      db.dailyReadingStats,
      db.customBackgrounds,
    ],
    async () => {
      await db.books.clear();
      await db.bookFiles.clear();
      await db.bookCovers.clear();
      await db.readingPositions.clear();
      await db.annotations.clear();
      await db.bookGroups.clear();
      if (serializedBooks.length > 0) {
        await db.books.bulkPut(serializedBooks.map((book) => book.metadata));
        await db.bookFiles.bulkPut(serializedBooks.map((book) => book.file));
        const covers = serializedBooks.flatMap((book) =>
          book.cover ? [book.cover] : []
        );
        if (covers.length > 0) await db.bookCovers.bulkPut(covers);
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
