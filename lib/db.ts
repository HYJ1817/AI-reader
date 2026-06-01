import Dexie, { type EntityTable } from "dexie";

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

const db = new Dexie("AiReader") as Dexie & {
  books: EntityTable<BookRecord, "id">;
  readingPositions: EntityTable<ReadingPosition, "bookId">;
  annotations: EntityTable<AnnotationRecord, "id">;
  dailyReadingStats: EntityTable<DailyReadingStat, "date">;
  bookGroups: EntityTable<BookGroup, "id">;
};

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

export async function saveBook(record: BookRecord): Promise<void> {
  await db.books.put(record);
}

export async function listBooks(): Promise<BookRecord[]> {
  const all = await db.books.toArray();
  return all.sort((a, b) => {
    const aTime = a.lastOpenedAt ?? a.createdAt;
    const bTime = b.lastOpenedAt ?? b.createdAt;
    if (aTime !== bTime) return bTime.localeCompare(aTime);
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export async function getBook(id: string): Promise<BookRecord | undefined> {
  return db.books.get(id);
}

export async function deleteBook(id: string): Promise<void> {
  await db.transaction("rw", [db.books, db.readingPositions, db.annotations], async () => {
    await db.books.delete(id);
    await db.readingPositions.delete(id);
    await db.annotations.where("bookId").equals(id).delete();
  });
}

export async function saveReadingPosition(position: ReadingPosition): Promise<void> {
  await db.readingPositions.put(position);
}

export async function getReadingPosition(
  bookId: string
): Promise<ReadingPosition | undefined> {
  return db.readingPositions.get(bookId);
}

export async function addAnnotation(record: AnnotationRecord): Promise<void> {
  await db.annotations.put(record);
}

export async function listAnnotations(bookId: string): Promise<AnnotationRecord[]> {
  return db.annotations
    .where("bookId")
    .equals(bookId)
    .sortBy("createdAt");
}

export async function listReadingPositions(): Promise<ReadingPosition[]> {
  return db.readingPositions.toArray();
}

export async function listAllAnnotations(): Promise<AnnotationRecord[]> {
  return db.annotations.toArray();
}

export async function listBookGroups(): Promise<BookGroup[]> {
  const all = await db.bookGroups.toArray();
  return all.sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt);
    return a.name.localeCompare(b.name);
  });
}

export async function saveBookGroup(group: BookGroup): Promise<void> {
  await db.bookGroups.put(group);
}

export async function deleteBookGroup(id: string): Promise<void> {
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
  const trimmed = name.trim();
  if (!trimmed) return;
  const existing = await db.bookGroups.get(id);
  if (!existing) return;
  await db.bookGroups.update(id, { name: trimmed, updatedAt: new Date().toISOString() });
}

export async function updateBookGroupMembership(bookId: string, groupIds: string[]): Promise<void> {
  const book = await db.books.get(bookId);
  if (!book) return;
  const deduped = [...new Set(groupIds)];
  await db.books.update(bookId, { groupIds: deduped });
}

export async function clearAllReaderData(): Promise<void> {
  await db.transaction("rw", [db.books, db.readingPositions, db.annotations, db.dailyReadingStats, db.bookGroups], async () => {
    await db.books.clear();
    await db.readingPositions.clear();
    await db.annotations.clear();
    await db.dailyReadingStats.clear();
    await db.bookGroups.clear();
  });
}

export async function getDailyReadingStat(
  date: string
): Promise<DailyReadingStat | undefined> {
  return db.dailyReadingStats.get(date);
}

export async function incrementDailyReadingSeconds(
  date: string,
  seconds: number
): Promise<void> {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
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
  return db.dailyReadingStats.toArray();
}
