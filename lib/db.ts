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

export type ReadingPosition = {
  bookId: string;
  locator: string;
  progressPercent: number;
  readingMode?: ReaderMode;
  updatedAt: string;
};

export type AnnotationRecord = {
  id: string;
  bookId: string;
  locator?: string;
  text: string;
  note?: string;
  createdAt: string;
};

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
  books: EntityTable<BookRecord, "id">;
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
  await getDb().books.put(record);
}

export async function listBooks(): Promise<BookRecord[]> {
  const all = await getDb().books.toArray();
  return all.sort((a, b) => {
    const aTime = a.lastOpenedAt ?? a.createdAt;
    const bTime = b.lastOpenedAt ?? b.createdAt;
    if (aTime !== bTime) return bTime.localeCompare(aTime);
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export async function getBook(id: string): Promise<BookRecord | undefined> {
  return getDb().books.get(id);
}

export async function deleteBook(id: string): Promise<void> {
  const db = getDb();
  await db.transaction("rw", [db.books, db.readingPositions, db.annotations], async () => {
    await db.books.delete(id);
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

export async function listAnnotations(bookId: string): Promise<AnnotationRecord[]> {
  return getDb().annotations
    .where("bookId")
    .equals(bookId)
    .sortBy("createdAt");
}

export async function listReadingPositions(): Promise<ReadingPosition[]> {
  return getDb().readingPositions.toArray();
}

export async function listAllAnnotations(): Promise<AnnotationRecord[]> {
  return getDb().annotations.toArray();
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

export async function deleteCustomBackgroundImage(): Promise<void> {
  await getDb().customBackgrounds.delete(CUSTOM_BACKGROUND_ID);
}

export async function clearAllReaderData(): Promise<void> {
  const db = getDb();
  await db.transaction("rw", [db.books, db.readingPositions, db.annotations, db.dailyReadingStats, db.bookGroups, db.customBackgrounds], async () => {
    await db.books.clear();
    await db.readingPositions.clear();
    await db.annotations.clear();
    await db.dailyReadingStats.clear();
    await db.bookGroups.clear();
    await db.customBackgrounds.clear();
  });
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
