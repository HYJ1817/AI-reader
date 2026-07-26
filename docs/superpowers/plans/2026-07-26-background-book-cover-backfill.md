# Background Book Cover Backfill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backfill existing EPUB covers after the metadata-only Library render, one book at a time with visible-book priority, while keeping new-import cover extraction unchanged.

**Architecture:** Add a cover-only IndexedDB write and a single-book repair operation to `lib/db.ts`. Add a pure serial coordinator in `lib/bookCoverBackfill.ts`, then integrate it through a small React hook that runs after startup and backup restore and publishes each successful Blob into the matching `BookMetadata` entry.

**Tech Stack:** TypeScript, React 19, Dexie/IndexedDB, JSZip EPUB cover extraction, Vitest, Playwright, Next.js 16.

---

### Task 1: Cover-only persistence and single-book repair

**Files:**
- Modify: `lib/db.ts`
- Modify: `lib/db.test.ts`

- [ ] **Step 1: Write failing database tests**

Add tests that seed a legacy `bookFiles.coverImageData`, call `loadMissingBookCover(id)`, and assert `bookCovers` receives the same bytes. Add a second test that seeds an EPUB without legacy cover bytes, injects an extractor result, and asserts only `bookCovers` changes while `bookFiles.fileData` remains byte-identical.

```ts
const result = await loadMissingBookCover("legacy-cover", extractCover);
expect(result?.source).toBe("legacy");
expect(await result?.blob.text()).toBe("legacy image");
expect(extractCover).not.toHaveBeenCalled();
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm.cmd test -- lib/db.test.ts`

Expected: FAIL because `saveBookCover` and `loadMissingBookCover` are not exported.

- [ ] **Step 3: Implement the cover-only APIs**

Add:

```ts
export async function saveBookCover(bookId: string, coverImageBlob: Blob): Promise<void>
export async function loadMissingBookCover(
  bookId: string,
  extractCoverImage?: (fileBlob: Blob) => Promise<Blob | undefined>
): Promise<{ blob: Blob; source: "existing" | "legacy" | "extracted" } | undefined>
```

The loader checks `bookCovers`, validates EPUB metadata, migrates legacy bytes before reconstructing source bytes, invokes the extractor for only one book, and catches per-book extraction failure.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `npm.cmd test -- lib/db.test.ts`

Expected: all database tests pass.

- [ ] **Step 5: Commit the database slice**

```powershell
git add lib/db.ts lib/db.test.ts
git commit -m "feat: repair one missing book cover"
```

### Task 2: Strictly serial visible-priority coordinator

**Files:**
- Modify: `lib/bookCoverBackfill.ts`
- Modify: `lib/bookCoverBackfill.test.ts`

- [ ] **Step 1: Replace the obsolete full-record backfill tests with failing queue tests**

Cover visible priority, dynamic reprioritization, maximum concurrency one, existing-cover/TXT skips, immediate success publication, and continuation after a rejected or unavailable book.

```ts
const result = await runBookCoverBackfill({
  books,
  getVisibleBookIds: () => visibleIds,
  loadCover,
  onCover: (bookId, blob) => published.push([bookId, blob]),
});
expect(order).toEqual(["visible", "offscreen"]);
expect(maxActive).toBe(1);
expect(result.completedIds).toContain("visible");
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm.cmd test -- lib/bookCoverBackfill.test.ts`

Expected: FAIL because the serial coordinator API does not exist.

- [ ] **Step 3: Implement the minimal coordinator**

Export `runBookCoverBackfill` with immutable candidate selection, a per-run attempted set, current visible-ID lookup before every item, `await` inside one loop, per-item `try/catch`, and optional `AbortSignal` checks before selection and publication.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm.cmd test -- lib/bookCoverBackfill.test.ts`

Expected: all queue tests pass and maximum observed concurrency is one.

- [ ] **Step 5: Commit the coordinator**

```powershell
git add lib/bookCoverBackfill.ts lib/bookCoverBackfill.test.ts
git commit -m "feat: queue missing book cover repair"
```

### Task 3: Startup and restore integration

**Files:**
- Create: `app/useBookCoverBackfill.ts`
- Modify: `app/page.tsx`
- Create: `lib/bookCoverBackfillIntegration.test.ts`
- Modify: `lib/libraryMetadataLoadingIntegration.test.ts`

- [ ] **Step 1: Write failing integration tests**

Assert startup calls `listBookMetadata` and publishes it before `startBookCoverBackfill`; assert restore publishes restored metadata and invokes the same start function; assert the hook uses `loadMissingBookCover`, supplies latest visible IDs, and functionally updates only the matching metadata entry.

```ts
expect(pageSource.indexOf("setBooks(storedBooks)")).toBeLessThan(
  pageSource.indexOf("startBookCoverBackfill(storedBooks)")
);
expect(pageSource).not.toContain("await startBookCoverBackfill(storedBooks)");
```

- [ ] **Step 2: Run focused integration tests and verify RED**

Run: `npm.cmd test -- lib/bookCoverBackfillIntegration.test.ts lib/libraryMetadataLoadingIntegration.test.ts`

Expected: FAIL because the hook and startup/restore calls do not exist.

- [ ] **Step 3: Implement the hook and page wiring**

The hook owns an `AbortController`, latest metadata and visible-ID refs, and returns `startBookCoverBackfill(books)`. It aborts a previous run, runs the shared serial coordinator without awaiting from page load/restore, and on success performs:

```ts
setBooks((current) => current.map((book) =>
  book.id === bookId && !book.coverImageBlob
    ? { ...book, coverImageBlob }
    : book
));
```

`page.tsx` passes the current visible Library IDs to the hook, starts it after startup `setBooks`, and starts it again after backup restore publishes restored metadata.

- [ ] **Step 4: Run focused integration and import tests and verify GREEN**

Run: `npm.cmd test -- lib/bookCoverBackfillIntegration.test.ts lib/libraryMetadataLoadingIntegration.test.ts lib/importBook.test.ts`

Expected: all tests pass; new EPUB import extraction remains covered.

- [ ] **Step 5: Commit React integration**

```powershell
git add app/useBookCoverBackfill.ts app/page.tsx lib/bookCoverBackfillIntegration.test.ts lib/libraryMetadataLoadingIntegration.test.ts
git commit -m "feat: backfill covers after library load"
```

### Task 4: Full verification, documentation, push, and deployment

**Files:**
- Modify: `HANDOFF.md`

- [ ] **Step 1: Run focused and full quality gates**

Run:

```powershell
npm.cmd test -- lib/db.test.ts lib/bookCoverBackfill.test.ts lib/bookCoverBackfillIntegration.test.ts lib/libraryMetadataLoadingIntegration.test.ts lib/importBook.test.ts
npm.cmd test
npm.cmd run lint
npm.cmd run build
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 2: Run focused iPhone 14 behavior coverage**

Start a production server on a verified-unused local port and run the relevant import/Library/backup coverage with one worker, zero retries, and `--trace=off`. Expected: all selected tests pass and the server port is free afterward.

- [ ] **Step 3: Verify standalone and OpenNext builds**

```powershell
$env:NEXT_PRIVATE_STANDALONE='true'
$env:NEXT_PRIVATE_OUTPUT_TRACE_ROOT=(Get-Location).Path
npm.cmd run build
node node_modules\@opennextjs\cloudflare\dist\cli\index.js build --skipNextBuild
```

Expected: standalone output and OpenNext worker build complete successfully.

- [ ] **Step 4: Record evidence and commit**

Append the exact implementation, test counts, commands, and remaining device boundary to `HANDOFF.md`, then commit the plan/spec/handoff without altering historical evidence.

- [ ] **Step 5: Push the feature branch and verify CI**

Push `codex/shared-sheet-performance`, wait for PR #4 CI, and require the `verify` check to pass. Do not merge `main`.

- [ ] **Step 6: Deploy and verify production**

Deploy the already-built OpenNext output, record the Worker version and BUILD_ID, verify `/`, discovered JS/CSS, `/BUILD_ID`, `/sw.js`, manifest, assetlinks, APK, and expected `/api/models` validation behavior, then run focused production mobile coverage.

- [ ] **Step 7: Commit and push deployment evidence**

Update `HANDOFF.md` with exact production evidence, commit, push, and require the follow-up CI run to pass. Keep PR #4 as a draft and do not merge it.
