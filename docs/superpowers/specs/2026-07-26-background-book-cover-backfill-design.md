# Background Book Cover Backfill Design

## Goal

Make real EPUB covers available to the Library and ambient background without requiring each book to be opened first. New imports continue extracting their cover before the imported record is saved. Existing books are repaired in the background after the first metadata-only Library render and after backup restore.

## Constraints

- Library startup must not wait for cover migration or EPUB extraction.
- Source files must never be hydrated in one bulk operation.
- At most one book may be processed at a time.
- Books in the current rendered Library window take priority over off-screen books.
- Existing covers must never be extracted or written again.
- One damaged or coverless book must not stop the remaining queue.
- Cover writes must not rewrite the EPUB/TXT source bytes.
- The backup format remains unchanged.

## Data-Layer Design

`saveBookCover(bookId, blob)` is the only mutation used by background repair. It serializes the Blob into a `BookCoverRecord` and writes only `bookCovers`; it never calls `saveBook()` and never touches `books` or `bookFiles`.

`loadMissingBookCover(bookId)` repairs one book with this ordered path:

1. Read `bookCovers[bookId]`. If present, return the hydrated Blob with an `existing` result and perform no write.
2. Read the metadata record. If absent or not EPUB, return `unavailable`.
3. Read that book's single `bookFiles` record.
4. If the legacy record contains `coverImageData`, hydrate it, call `saveBookCover`, and return `migrated` without reading or reconstructing `fileData`.
5. Otherwise reconstruct only this EPUB's source Blob from `fileData`, call `extractEpubCoverImage`, and persist a successful result through `saveBookCover`.
6. Missing source data, no declared cover, malformed EPUB data, and extraction errors return `unavailable` for that book.

The operation rechecks `bookCovers` before any legacy migration or extraction, so concurrent import/open flows cannot cause repeat work.

## Background Queue

A focused cover-backfill coordinator accepts the current metadata list, a function that supplies the latest visible book IDs, the single-book loader, and a success callback. It maintains one in-flight promise and selects one next candidate only after the prior candidate settles.

At every selection boundary it:

- removes books that are TXT, already contain `coverImageBlob`, have completed successfully, or have already been attempted in this run;
- orders the remaining candidates with current visible IDs first while preserving Library order inside each priority group;
- processes exactly the first candidate;
- catches that candidate's failure and continues;
- calls the success callback immediately when a Blob is returned.

This dynamic selection means a book that becomes visible while the queue is running is promoted before the next off-screen book. An abort signal stops future selections and React updates but does not roll back a completed IndexedDB cover write.

## React Integration

Initial startup continues to await only `listBookMetadata()` and reading positions. After `setBooks(storedBooks)`, the page schedules the shared backfill coordinator without awaiting it.

The page keeps refs for the latest metadata and visible Library IDs. A successful result uses functional `setBooks` to replace only the matching metadata item with `{ ...book, coverImageBlob }`. This immediately updates the real cover and `AmbientBookBackground` without hydrating the complete book record.

Backup restore follows the same sequence: restore data, list and publish metadata, then start a fresh instance of the same coordinator. Starting a new run aborts the previous run so stale success callbacks cannot publish into restored state.

New EPUB import remains synchronous with respect to cover extraction: `createBookRecordFromFile` extracts the cover and `saveBook` stores it directly in `bookCovers` as part of the import transaction. Newly imported books with a cover are excluded from backfill.

## Failure Behavior

Backfill is opportunistic. A missing legacy cover, missing source record, corrupt archive, unsupported cover declaration, database read error, or extraction error leaves the generated placeholder in place. No user-facing import or restore error is raised for background cover failure, and the queue proceeds to the next book.

## Verification

Automated coverage will prove:

- legacy `bookFiles.coverImageData` migrates directly into `bookCovers`;
- extraction writes only `bookCovers` through `saveBookCover`;
- backup restoration starts the shared backfill path after publishing metadata;
- one failed book does not block later books;
- the queue has a maximum concurrency of one;
- visible books are selected before off-screen books;
- books with existing covers are skipped;
- initial Library metadata rendering does not read all EPUB source files;
- a successful result updates only the matching React metadata item.

Full Vitest, ESLint, Next.js build, focused mobile Playwright, whitespace validation, standalone build, and OpenNext build remain the release gates before push and deployment.
