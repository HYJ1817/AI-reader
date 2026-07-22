# Library Metadata Loading and Book Rename Design

## Goal

Keep the library fast and memory-efficient as book count and file size grow by
loading only book metadata at startup, while adding a safe display-title rename
flow and correcting the AI context disclosure.

## Scope

This change will:

- separate library metadata, source files, and covers at the data-access boundary;
- keep full EPUB/TXT bytes out of long-lived library React state;
- load one source file only when opening, exporting, or backing up that book;
- add a dedicated book rename sheet launched from the existing book actions sheet;
- update AI privacy copy to disclose nearby reading text and recent conversation
  messages accurately; and
- preserve the current local library, reading progress, groups, and annotations.

This change will not split `app/page.tsx` into controllers, add ZIP backups,
add AI context modes, or claim physical 120 Hz performance. Those remain
separate follow-up projects.

## Data Model

`BookMetadata` becomes the library-facing type. It contains the existing book
identity and presentation fields but no `fileBlob`:

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
```

`BookRecord` remains the full record used by readers, export, import, and
backup. It extends metadata with `fileBlob`.

Dexie schema version 6 adds a `bookCovers` table keyed by `bookId`. New and
updated books store source bytes in `bookFiles` and cover bytes in
`bookCovers`. The old optional cover fields remain readable in existing
`bookFiles` records for compatibility but are no longer written.

No blocking upgrade scan will read every v5 `bookFiles` record. Existing
metadata and source files remain in place. An existing cover that has not yet
been copied to `bookCovers` may temporarily use the deterministic fallback
cover. When that book is opened and its full legacy file record is already
being read, any embedded legacy cover is copied to `bookCovers` without an
additional full-library pass.

## Data Access APIs

The storage layer will expose explicit read costs:

- `listBookMetadata()` reads `books` and `bookCovers`, never `bookFiles`;
- `getBookFile(bookId)` reads only the requested `bookFiles` record and returns
  its Blob;
- `getBook(bookId)` combines one metadata record, one requested source file,
  and its cover when present;
- `saveBook(record)` writes metadata, source bytes, and cover bytes in one
  transaction;
- `renameBook(bookId, title)` trims and validates the display title and updates
  only the `books` record;
- `deleteBook(bookId)` deletes metadata, source, cover, progress, and annotations
  transactionally; and
- backup enumerates metadata first and reads each source file sequentially.

Group membership updates continue to touch only metadata. Refreshes after
group, rename, delete, import, or restore use `listBookMetadata()` and cannot
hydrate every source Blob.

## Application Data Flow

At startup, the page loads `BookMetadata[]`, reading positions, groups, and
statistics. Library surfaces and overlays receive metadata only.

When the user opens a book, the application calls `getBook(bookId)` and keeps
the returned full record only for the active reader session. Closing or
switching the reader releases the previous full record reference. Export calls
`getBookFile(bookId)` for the requested book. Backup reads one source file at a
time while constructing the existing v2 payload, preserving compatibility in
this project.

Cover loading stays independent from source-file loading. The first
implementation may load the small `bookCovers` records as part of metadata
listing; it must not retrieve `bookFiles` to obtain a cover.

## Rename Interaction

The book actions sheet gains a `重命名` action. It presents a new
`book-rename` navigation sheet for the selected book.

The rename sheet contains:

- title `重命名书籍`;
- one text input prefilled with the current display title;
- `取消` and `保存` actions;
- autofocus with the existing sheet focus trap; and
- submission through either `保存` or Enter.

Whitespace is trimmed. An empty title is rejected inline and does not close the
sheet. A successful rename updates only the display title, preserves the
original `fileName`, source format, progress, groups, and annotations, then
dismisses the rename sheet. Export therefore continues to use the original
source filename.

`book-rename` is included in the set of book-bound routes so deletion or a
missing book dismisses an invalid sheet safely.

## AI Disclosure

README and the AI settings surface will state that a request can include the
book title, format, selected text, nearby visible reading text, the current
question, and recent conversation messages. The copy will continue to state
that the whole book and API keys are not uploaded or included in backups.

This task changes disclosure only. It does not change which context is sent or
add new preferences.

## Error Handling and Compatibility

- Missing source bytes affect only the requested book; metadata for other books
  remains visible.
- A missing cover falls back to the existing generated cover presentation.
- Save, delete, and full restore transactions include `bookCovers` so partial
  cross-table updates are not committed.
- Existing v1/v2 backup payloads remain readable, and v2 output stays unchanged.
- Existing v5 databases open without a destructive migration or full-file scan.
- Rename failures keep the sheet open and retain the typed title.

## Testing

Implementation follows red-green-refactor cycles. Required regression coverage:

1. `listBookMetadata()` returns sorted metadata and never reads or hydrates
   `bookFiles`.
2. `getBook()` reads only the requested source file and migrates that book's
   legacy embedded cover when encountered.
3. Saving and deleting a book keep `books`, `bookFiles`, and `bookCovers`
   consistent.
4. Existing v5-style records remain openable without a full migration.
5. Library startup and metadata refresh paths call `listBookMetadata()`, not
   `listBooks()`.
6. Opening and exporting a book load only the target source file.
7. Backup output remains compatible and reads source files sequentially.
8. Rename trims the title, rejects blank input, preserves `fileName`, and does
   not replace other metadata.
9. The `book-rename` sheet shares the existing motion/accessibility layer,
   submits with Enter, and dismisses correctly.
10. README and settings copy match the actual AI context fields.

After focused tests pass, run the complete Vitest suite, lint, production build,
and the relevant Playwright library/sheet flows. Performance acceptance uses a
seeded 50-100 book database to verify that metadata listing does not access
source-file records; exact memory numbers remain device-dependent.

## Delivery Boundaries

The implementation will remain on the current isolated worktree until its tests
pass and the user separately authorizes publishing or deployment. No database
clearing, destructive migration, branch merge, push, or production deployment
is implied by approval of this design.
