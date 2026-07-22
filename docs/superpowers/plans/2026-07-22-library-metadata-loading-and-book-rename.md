# Library Metadata Loading and Book Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop library startup and metadata refreshes from reading every EPUB/TXT source file, add display-title renaming, and make AI context disclosure accurate.

**Architecture:** Add a metadata-only library model and a v6 `bookCovers` table while retaining targeted `BookRecord` hydration for the active reader, export, and backup. Convert library surfaces to `BookMetadata`, load a full record by ID only at the consumption boundary, and add a `book-rename` route on the existing shared sheet system.

**Tech Stack:** Next.js 16, React 19, TypeScript, Dexie 4/fake-indexeddb, Vitest 4, Motion shared sheets, Playwright.

---

## File map

- `lib/db.ts`: metadata/file/cover types, v6 schema, targeted reads, rename and timestamp mutations, transactional writes/deletes/restores.
- `lib/db.test.ts`: real IndexedDB regression coverage for metadata-only listing, target hydration, covers, rename, and cascades.
- `app/page.tsx`: metadata-only library state, lazy open/export, metadata refreshes, rename action, and removal of startup full-file cover backfill.
- `app/useReaderBookState.ts`: history restoration by target ID rather than treating library metadata as a full reader record.
- `app/LibrarySurface.tsx`, `app/AppOverlays.tsx`, `app/MotionBookCover.tsx`,
  `app/ReadingDashboard.tsx`, and `app/AmbientBookBackground.tsx`: accept
  `BookMetadata`; add the rename action and sheet where applicable.
- `lib/ambientBookBackground.ts`: accept metadata because ambient presentation
  needs only the title, format, ID, and cover.
- `lib/appNavigation.ts`: add the `book-rename` sheet route.
- `lib/backup.ts`, `lib/backup.test.ts`: enumerate metadata and hydrate one file at a time while preserving v2 backup format.
- `lib/libraryMetadataLoadingIntegration.test.ts`: source-level contract that startup/refresh paths cannot regress to `listBooks()`.
- `lib/bookRenameIntegration.test.ts`: rename sheet and action wiring contract.
- `lib/overlayMotionIntegration.test.ts`, `e2e/native-navigation.spec.ts`: include `book-rename` in the shared sheet route matrix and verify the user flow.
- `lib/uiText.ts`, `app/page.module.css`: rename copy, validation message, and focused form styling.
- `README.md`, `app/AiSettingsSurface.tsx`, `lib/askAiReaderContextIntegration.test.ts`: accurate AI disclosure.
- `HANDOFF.md`: final verified state and remaining device boundary.

---

### Task 1: Introduce metadata-only storage reads and independent covers

**Files:**
- Modify: `lib/db.ts:1-230`
- Modify: `lib/db.test.ts:1-180`

- [ ] **Step 1: Write the failing metadata and targeted-read tests**

Add imports for `listBookMetadata` and `getBookFile`, then add these tests under `describe("Book storage")`:

```ts
it("lists metadata when the source file record is absent", async () => {
  const inspectionDb = new Dexie("AiReader");
  await inspectionDb.open();
  try {
    await inspectionDb.table("books").put({
      id: "metadata-only",
      title: "Metadata Only",
      format: "epub",
      fileName: "metadata-only.epub",
      size: 50_000_000,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    await inspectionDb.table("bookFiles").delete("metadata-only");
  } finally {
    inspectionDb.close();
  }

  const books = await listBookMetadata();
  expect(books).toEqual([
    expect.objectContaining({ id: "metadata-only", title: "Metadata Only" }),
  ]);
  expect(books[0]).not.toHaveProperty("fileBlob");
});

it("loads only the requested source file", async () => {
  await saveBook(makeBook({ id: "first", fileBlob: new Blob(["first"]) }));
  await saveBook(makeBook({ id: "second", fileBlob: new Blob(["second"]) }));

  const inspectionDb = new Dexie("AiReader");
  await inspectionDb.open();
  try {
    await inspectionDb.table("bookFiles").delete("second");
  } finally {
    inspectionDb.close();
  }

  expect(await (await getBookFile("first"))?.text()).toBe("first");
  expect(await getBookFile("second")).toBeUndefined();
  expect((await listBookMetadata()).map((book) => book.id).sort()).toEqual([
    "first",
    "second",
  ]);
});

it("stores covers outside source-file records", async () => {
  await saveBook(makeBook({
    id: "covered",
    coverImageBlob: new Blob(["cover"], { type: "image/png" }),
  }));
  const inspectionDb = new Dexie("AiReader");
  await inspectionDb.open();
  try {
    const file = await inspectionDb.table("bookFiles").get("covered");
    const cover = await inspectionDb.table("bookCovers").get("covered");
    expect(file.coverImageData).toBeUndefined();
    expect(cover.coverImageData).toBeInstanceOf(ArrayBuffer);
  } finally {
    inspectionDb.close();
  }
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm.cmd test -- lib/db.test.ts
```

Expected: FAIL because `listBookMetadata`, `getBookFile`, and `bookCovers` do not exist.

- [ ] **Step 3: Add the metadata type and v6 schema**

Replace the top-level book types and extend the database shape:

```ts
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

export type BookRecord = BookMetadata & { fileBlob: Blob };

type StoredBookRecord = Omit<BookMetadata, "coverImageBlob"> & {
  fileBlob?: Blob;
  coverImageBlob?: Blob;
};

type BookCoverRecord = {
  bookId: string;
  coverImageData: ArrayBuffer;
  coverImageType: string;
};
```

Add `bookCovers` to `AiReaderDb` and schema version 6:

```ts
bookCovers: EntityTable<BookCoverRecord, "bookId">;

db.version(6).stores({
  bookCovers: "bookId",
});
```

- [ ] **Step 4: Implement metadata-only and targeted read helpers**

Add small hydration helpers and the public APIs:

```ts
function hydrateCover(record?: BookCoverRecord): Blob | undefined {
  return record
    ? new Blob([record.coverImageData], {
        type: record.coverImageType || "image/*",
      })
    : undefined;
}

function toBookMetadata(
  stored: StoredBookRecord,
  cover?: BookCoverRecord
): BookMetadata {
  const coverImageBlob = hydrateCover(cover) ?? stored.coverImageBlob;
  return {
    id: stored.id,
    title: stored.title,
    format: stored.format,
    fileName: stored.fileName,
    size: stored.size,
    createdAt: stored.createdAt,
    ...(stored.lastOpenedAt ? { lastOpenedAt: stored.lastOpenedAt } : {}),
    ...(stored.groupIds ? { groupIds: stored.groupIds } : {}),
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
  const file = await db.bookFiles.get(id);
  if (file) return new Blob([file.fileData], { type: file.fileType });
  const stored = await db.books.get(id);
  if (!(stored?.fileBlob instanceof Blob)) return undefined;
  await migrateLegacySourceRecord(db, stored);
  return stored.fileBlob;
}
```

Extract the existing sort comparison into `compareBooksByRecency`. Update
`getBook(id)` to fetch only that book's metadata, file, and cover. When an old
`BookFileRecord` contains `coverImageData`, write that one cover to
`bookCovers` during the targeted read and return it.

- [ ] **Step 5: Make writes and cleanup cover-aware**

Change `saveBook` to write three stores transactionally and stop writing cover
bytes into `bookFiles`:

```ts
await db.transaction("rw", [db.books, db.bookFiles, db.bookCovers], async () => {
  await db.books.put(metadata);
  await db.bookFiles.put(fileRecord);
  if (coverRecord) await db.bookCovers.put(coverRecord);
  else await db.bookCovers.delete(record.id);
});
```

Include `bookCovers` in `deleteBook`, `clearAllReaderData`, and
`replaceReaderData`. `replaceReaderData` must clear the cover table and write
cover records for restored `BookRecord` values in the same transaction.

- [ ] **Step 6: Run the focused tests and verify GREEN**

Run:

```powershell
npm.cmd test -- lib/db.test.ts
```

Expected: all `lib/db.test.ts` tests pass.

- [ ] **Step 7: Commit the storage boundary**

```powershell
git add -- lib/db.ts lib/db.test.ts
git commit -m "perf: load library metadata without book files"
```

---

### Task 2: Convert library state and reader restoration to targeted hydration

**Files:**
- Create: `lib/libraryMetadataLoadingIntegration.test.ts`
- Modify: `app/page.tsx:1-1220`
- Modify: `app/useReaderBookState.ts:1-165`
- Modify: `app/LibrarySurface.tsx:1-70`
- Modify: `app/AppOverlays.tsx:1-230`
- Modify: `app/MotionBookCover.tsx:1-25`
- Modify: `app/ReadingDashboard.tsx:1-30`
- Modify: `app/AmbientBookBackground.tsx:1-35`
- Modify: `lib/libraryFilters.ts:1-20`
- Modify: `lib/ambientBookBackground.ts:1-30`
- Modify: `lib/readerChromeIntegration.test.ts:45-55`

- [ ] **Step 1: Write the failing source-contract test**

Create `lib/libraryMetadataLoadingIntegration.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const readerStateSource = readFileSync(
  new URL("../app/useReaderBookState.ts", import.meta.url),
  "utf8"
);

describe("metadata-only library integration", () => {
  it("uses metadata reads for startup and library refreshes", () => {
    expect(pageSource).toContain("listBookMetadata");
    expect(pageSource).not.toContain("listBooks(");
  });

  it("hydrates a target book before reader preparation and export", () => {
    expect(pageSource).toContain("await getBook(book.id)");
    expect(readerStateSource).toContain("await getBook(readerEntry.bookId)");
  });

  it("updates last-opened metadata without rewriting source bytes", () => {
    expect(pageSource).toContain("updateBookLastOpenedAt(book.id, now)");
    expect(pageSource).not.toContain("saveBook({ ...book, lastOpenedAt: now })");
  });
});
```

- [ ] **Step 2: Run the integration test and verify RED**

Run:

```powershell
npm.cmd test -- lib/libraryMetadataLoadingIntegration.test.ts
```

Expected: FAIL on all three contracts.

- [ ] **Step 3: Add a cheap last-opened mutation**

Add to `lib/db.ts` with a focused test in `lib/db.test.ts`:

```ts
export async function updateBookLastOpenedAt(
  id: string,
  lastOpenedAt: string
): Promise<void> {
  await getDb().books.update(id, { lastOpenedAt });
}
```

The test must inspect `bookFiles.fileData` before and after and assert its bytes
are unchanged.

- [ ] **Step 4: Convert library-facing types to metadata**

Change library state and props from `BookRecord` to `BookMetadata` in
`page.tsx`, `LibrarySurface.tsx`, `AppOverlays.tsx`, and `libraryFilters.ts`.
Keep `openBook` in `useReaderBookState` as `BookRecord | null`.

The action signatures become ID/metadata based:

```ts
pressBook: (book: BookMetadata, originId: string) => void;
openBookActions: (book: BookMetadata) => void;
openBook: (book: BookMetadata) => void;
exportBook: (book: BookMetadata) => void;
deleteBook: (book: BookMetadata) => void;
```

Replace every library refresh `listBooks()` call with
`listBookMetadata()`. Remove startup and restore calls to
`backfillMissingBookCovers`, because they require hydrated source records.

- [ ] **Step 5: Hydrate only at reader and export boundaries**

Change `openBookForReading` to resolve the requested full record:

```ts
const openBookForReading = useCallback(async (
  book: BookMetadata,
  originId?: string
) => {
  const fullBook = await getBook(book.id);
  if (!fullBook) {
    setImportError(UI_TEXT.ERROR_READ_FILE);
    return;
  }
  const now = new Date().toISOString();
  await updateBookLastOpenedAt(book.id, now);
  const [nextBooks, savedPosition] = await Promise.all([
    listBookMetadata(),
    getReadingPosition(book.id),
  ]);
  setBooks(nextBooks);
  scrollRestoredRef.current = false;
  resetAskAi();
  const contentReady = prepareReaderBook(fullBook, savedPosition);
  navigation.presentReader(book.id, { originId });
  await contentReady;
}, [navigation, prepareReaderBook, resetAskAi]);
```

Change export to call `getBook(book.id)` and pass the resulting full record to
`createBookFileExport`. A missing source sets the existing read/export error.

- [ ] **Step 6: Make history restoration lazy and cancellable**

Change `useReaderBookState` options to `books: BookMetadata[]`, import
`getBook`, and replace direct preparation of the metadata object:

```ts
let cancelled = false;
Promise.all([
  getBook(readerEntry.bookId),
  getReadingPosition(readerEntry.bookId),
])
  .then(([restoredBook, savedPosition]) => {
    if (cancelled) return;
    if (!restoredBook) {
      removeInvalid(readerEntry.key);
      return;
    }
    void prepareReaderBook(restoredBook, savedPosition);
  })
  .catch(() => {
    if (!cancelled) removeInvalid(readerEntry.key);
  });
```

Retain the metadata existence check before starting the request so deleted
history entries are removed without touching `bookFiles`.

- [ ] **Step 7: Run focused tests and type-facing unit tests**

Run:

```powershell
npm.cmd test -- lib/libraryMetadataLoadingIntegration.test.ts lib/db.test.ts lib/libraryFilters.test.ts lib/readerChromeIntegration.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 8: Commit application lazy hydration**

```powershell
git add -- app/page.tsx app/useReaderBookState.ts app/LibrarySurface.tsx app/AppOverlays.tsx lib/libraryFilters.ts lib/libraryMetadataLoadingIntegration.test.ts lib/readerChromeIntegration.test.ts lib/db.ts lib/db.test.ts
git commit -m "perf: hydrate only the active library book"
```

---

### Task 3: Keep backup compatibility while reading source files sequentially

**Files:**
- Modify: `lib/backup.ts:1-180`
- Modify: `lib/backup.test.ts:1-550`

- [ ] **Step 1: Write the failing backup compatibility test**

Add a test that saves two books, removes the second source record, and proves
the failure is isolated to the missing source rather than metadata listing:

```ts
it("enumerates metadata and reports the specific missing backup source", async () => {
  await saveBook(makeBook({ id: "available", title: "Available" }));
  await saveBook(makeBook({ id: "missing", title: "Missing" }));
  const inspectionDb = new Dexie("AiReader");
  await inspectionDb.open();
  try {
    await inspectionDb.table("bookFiles").delete("missing");
  } finally {
    inspectionDb.close();
  }

  await expect(createBackupPayload()).rejects.toThrow(
    "Stored file is unavailable for book missing."
  );
  expect((await listBookMetadata()).map((book) => book.id).sort()).toEqual([
    "available",
    "missing",
  ]);
});
```

- [ ] **Step 2: Run the focused backup test and verify RED**

Run:

```powershell
npm.cmd test -- lib/backup.test.ts
```

Expected: FAIL because backup still calls `listBooks()` and has no targeted
missing-file message.

- [ ] **Step 3: Enumerate metadata and load one file per loop iteration**

Change the imports and backup loop:

```ts
const [books, positions, annotations, groups, dailyReadingStats, customBackground] =
  await Promise.all([
    listBookMetadata(),
    listReadingPositions(),
    listAllAnnotations(),
    listBookGroups(),
    listDailyReadingStats(),
    getCustomBackgroundRecord(),
  ]);

const backupBooks: BackupBookMeta[] = [];
for (const book of books) {
  const fileBlob = await getBookFile(book.id);
  if (!fileBlob) {
    throw new Error(`Stored file is unavailable for book ${book.id}.`);
  }
  backupBooks.push({
    id: book.id,
    title: book.title,
    format: book.format,
    fileName: book.fileName,
    size: book.size,
    createdAt: book.createdAt,
    lastOpenedAt: book.lastOpenedAt,
    fileContent: await blobToBase64(fileBlob),
    groupIds: book.groupIds,
  });
}
```

Do not change `BackupPayload.version` or the JSON fields.

- [ ] **Step 4: Run backup and database tests**

Run:

```powershell
npm.cmd test -- lib/backup.test.ts lib/db.test.ts
```

Expected: all selected tests pass, including v1/v2 restore coverage.

- [ ] **Step 5: Commit sequential backup hydration**

```powershell
git add -- lib/backup.ts lib/backup.test.ts
git commit -m "perf: read backup book files sequentially"
```

---

### Task 4: Add display-title rename storage behavior

**Files:**
- Modify: `lib/db.ts:280-320`
- Modify: `lib/db.test.ts:320-440`

- [ ] **Step 1: Write failing rename tests**

Import `renameBook` and add:

```ts
it("renames only the display title", async () => {
  await saveBook(makeBook({
    id: "rename-me",
    title: "Old title",
    fileName: "original.epub",
    groupIds: ["group-1"],
  }));

  await renameBook("rename-me", "  New title  ");

  const metadata = (await listBookMetadata()).find(
    (book) => book.id === "rename-me"
  );
  expect(metadata).toMatchObject({
    title: "New title",
    fileName: "original.epub",
    groupIds: ["group-1"],
  });
  expect(await (await getBookFile("rename-me"))?.text()).toBe("test");
});

it("rejects a blank display title", async () => {
  await saveBook(makeBook({ id: "rename-me", title: "Keep title" }));
  await expect(renameBook("rename-me", "   ")).rejects.toThrow(
    "Book title is required."
  );
  expect((await listBookMetadata())[0].title).toBe("Keep title");
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
npm.cmd test -- lib/db.test.ts
```

Expected: FAIL because `renameBook` is not exported.

- [ ] **Step 3: Implement the metadata-only mutation**

Add:

```ts
export async function renameBook(id: string, title: string): Promise<void> {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("Book title is required.");
  const updated = await getDb().books.update(id, { title: trimmed });
  if (updated === 0) throw new Error(`Book not found: ${id}.`);
}
```

- [ ] **Step 4: Run the test and verify GREEN**

Run:

```powershell
npm.cmd test -- lib/db.test.ts
```

Expected: all database tests pass.

- [ ] **Step 5: Commit the rename data API**

```powershell
git add -- lib/db.ts lib/db.test.ts
git commit -m "feat: rename library book titles"
```

---

### Task 5: Add the book rename shared-sheet flow

**Files:**
- Create: `lib/bookRenameIntegration.test.ts`
- Modify: `lib/appNavigation.ts:1-30`
- Modify: `app/AppOverlays.tsx:1-560`
- Modify: `app/page.tsx:560-680,1880-1910`
- Modify: `lib/uiText.ts:1-180`
- Modify: `app/page.module.css:3840-4060`
- Modify: `lib/overlayMotionIntegration.test.ts:120-175`
- Modify: `e2e/native-navigation.spec.ts:831-885`

- [ ] **Step 1: Write the failing rename integration contract**

Create `lib/bookRenameIntegration.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const navigation = readFileSync(new URL("./appNavigation.ts", import.meta.url), "utf8");
const overlays = readFileSync(new URL("../app/AppOverlays.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

describe("book rename integration", () => {
  it("routes book rename through the shared sheet stack", () => {
    expect(navigation).toContain('"book-rename"');
    expect(overlays).toContain('case "book-rename"');
    expect(overlays).toContain("<BookRenameSheet");
    expect(overlays).toContain('navigation.presentSheet("book-rename"');
  });

  it("submits a trimmed title without changing the source filename", () => {
    expect(page).toContain("await renameBook(bookId, title)");
    expect(page).toContain("setBooks(await listBookMetadata())");
    expect(overlays).toContain("UI_TEXT.RENAME_BOOK");
    expect(overlays).toContain("UI_TEXT.BOOK_TITLE_REQUIRED");
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm.cmd test -- lib/bookRenameIntegration.test.ts
```

Expected: FAIL because route and UI do not exist.

- [ ] **Step 3: Add route, copy, and page action**

Add `"book-rename"` to `SheetRoute` and `BOOK_ROUTES`. Add UI constants:

```ts
RENAME_BOOK: "重命名书籍",
BOOK_TITLE: "书名",
BOOK_TITLE_REQUIRED: "请输入书名",
```

Add the page action:

```ts
async function handleRenameBook(bookId: string, title: string) {
  await renameBook(bookId, title);
  setBooks(await listBookMetadata());
}
```

Expose it through `AppOverlaysProps.actions` as
`renameBook: (bookId: string, title: string) => Promise<void>`.

- [ ] **Step 4: Add the rename action and sheet component**

Add `onOpenRename` to `BookActionSheet` and an `ActionRow` before group
management. Route it with:

```tsx
onOpenRename={() =>
  navigation.presentSheet("book-rename", { entityId: sheetBook.id })
}
```

Implement the focused sheet:

```tsx
function BookRenameSheet({ book, onRename, onClose }: {
  book: BookMetadata;
  onRename: (bookId: string, title: string) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(book.title);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <BottomSheet
      onClose={onClose}
      ariaLabel={UI_TEXT.RENAME_BOOK}
      initialFocusRef={inputRef}
    >
      {(close) => {
        const submit = async () => {
          const trimmed = title.trim();
          if (!trimmed) {
            setError(UI_TEXT.BOOK_TITLE_REQUIRED);
            return;
          }
          setSaving(true);
          setError(null);
          try {
            await onRename(book.id, trimmed);
            close();
          } catch (renameError) {
            setError(
              renameError instanceof Error
                ? renameError.message
                : UI_TEXT.REQUEST_FAILED
            );
          } finally {
            setSaving(false);
          }
        };
        return (
          <form className={styles.bookRenameForm} onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}>
            <SheetHeader title={UI_TEXT.RENAME_BOOK} close={close} />
            <div className={styles.sheetBody}>
              <label className={styles.bookRenameField}>
                <span>{UI_TEXT.BOOK_TITLE}</span>
                <input
                  ref={inputRef}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "book-rename-error" : undefined}
                />
              </label>
              {error ? <p id="book-rename-error" className={styles.fieldError}>{error}</p> : null}
              <div className={styles.bookRenameActions}>
                <button type="button" className={styles.secondaryButton} onClick={() => close()}>
                  {UI_TEXT.CANCEL}
                </button>
                <button type="submit" className={styles.primaryButton} disabled={saving}>
                  {UI_TEXT.SAVE}
                </button>
              </div>
            </div>
          </form>
        );
      }}
    </BottomSheet>
  );
}
```

Use existing input, button, theme, safe-area, and focus tokens in the new CSS;
do not introduce a second animation owner.

- [ ] **Step 5: Extend shared sheet and browser coverage**

Add `{ route: "book-rename", entityId: bookId ?? undefined }` to the all-sheet
route array and `"book-rename"` to the source integration route list.

Add a Playwright flow that opens the visible book action sheet, clicks
`重命名书籍`, clears the focused input, verifies `请输入书名`, enters `新书名`,
submits with Enter, and confirms the new title appears in the library while the
original export source name remains represented by the unchanged metadata
unit test.

- [ ] **Step 6: Run focused rename and sheet tests**

Run:

```powershell
npm.cmd test -- lib/bookRenameIntegration.test.ts lib/overlayMotionIntegration.test.ts lib/db.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 7: Commit the rename interaction**

```powershell
git add -- lib/appNavigation.ts app/AppOverlays.tsx app/page.tsx lib/uiText.ts app/page.module.css lib/bookRenameIntegration.test.ts lib/overlayMotionIntegration.test.ts e2e/native-navigation.spec.ts
git commit -m "feat: rename books from the action sheet"
```

---

### Task 6: Correct AI context disclosure

**Files:**
- Modify: `README.md:1-100`
- Modify: `app/AiSettingsSurface.tsx:300-325`
- Modify: `lib/askAiReaderContextIntegration.test.ts:70-110`

- [ ] **Step 1: Write the failing disclosure test**

Add source reads for README and AI settings and assert both disclose nearby
text and recent conversation:

```ts
it("discloses every reader context category sent to AI providers", () => {
  for (const source of [readmeSource, aiSettingsSource]) {
    expect(source).toContain("附近正文");
    expect(source).toContain("最近对话");
    expect(source).toContain("不会发送整本书");
  }
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm.cmd test -- lib/askAiReaderContextIntegration.test.ts
```

Expected: FAIL because current copy claims only selected text is sent.

- [ ] **Step 3: Replace inaccurate copy**

Use this consistent disclosure in the settings surface:

```text
API Key 只保存在本机浏览器。提问时可能发送书名、格式、选中文本、当前页面附近正文、当前问题和最近对话；不会发送整本书，也不会在备份中导出 API Key。
```

Update README feature, configuration, and privacy sections with the same set
of fields. Do not change runtime context behavior in this task.

- [ ] **Step 4: Run the disclosure test and verify GREEN**

Run:

```powershell
npm.cmd test -- lib/askAiReaderContextIntegration.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 5: Commit the disclosure correction**

```powershell
git add -- README.md app/AiSettingsSurface.tsx lib/askAiReaderContextIntegration.test.ts
git commit -m "docs: disclose AI reading context accurately"
```

---

### Task 7: Verify the complete change and record the handoff

**Files:**
- Modify: `HANDOFF.md`

- [ ] **Step 1: Run the complete unit suite**

Run:

```powershell
npm.cmd test
```

Expected: all Vitest tests pass with zero failures.

- [ ] **Step 2: Run static and production checks**

Run:

```powershell
npm.cmd run lint
npm.cmd run build
```

Expected: both commands exit 0.

- [ ] **Step 3: Run focused Playwright flows against the production build**

Start the production server using the repository's established Playwright
web-server configuration, then run:

```powershell
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-14 --grep "all sheet routes|rename book|book action sheet entrance" --workers=1 --retries=0 --trace=off
```

Expected: all selected flows pass. The performance test must retain its
existing click-to-mount, frame cadence, long-task, and layout-shift budgets.

- [ ] **Step 4: Inspect git scope and whitespace**

Run:

```powershell
git diff --check
git status -sb
git diff --stat 347f3b3..HEAD
```

Expected: no whitespace errors and only files named in this plan are changed.

- [ ] **Step 5: Update HANDOFF with verified facts**

Record:

- exact commits and branch state;
- metadata/file/cover storage behavior;
- rename behavior and unchanged source filename;
- AI disclosure correction;
- exact unit, lint, build, and Playwright results; and
- the remaining physical iPhone/PWA validation boundary.

Do not claim lower memory or faster physical-device startup without measured
device evidence.

- [ ] **Step 6: Commit the handoff only after verification**

```powershell
git add -- HANDOFF.md
git commit -m "docs: record metadata loading verification"
```

- [ ] **Step 7: Stop before external publication**

Report the local commits and verification. Do not push, merge, alter PR #4, or
deploy until the user explicitly authorizes that external action.
