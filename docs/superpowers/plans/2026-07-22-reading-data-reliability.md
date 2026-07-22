# Reading Data Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the newest TXT/EPUB reading state across lifecycle events and backup replacement, while adding a 500 MiB import guard and low-cost cache/API-key safeguards.

**Architecture:** Introduce a small ordered pending-position coordinator shared by TXT and EPUB. Route normal exits through flush, destructive replacement through block/cancel/drain, and keep backup restoration behind an explicit guard. Keep the existing metadata-only library boundary and make the remaining safeguards narrow, independently tested changes.

**Tech Stack:** Next.js 16, React 19, TypeScript, Dexie 4, Vitest 4, epub.js, Service Worker, Playwright, OpenNext/Cloudflare Workers.

---

## File map

- `lib/readerPositionCoordinator.ts`: ordered debounce, flush, cancel/drain, immediate save, and write blocking.
- `lib/readerPositionCoordinator.test.ts`: real async ordering and fake-timer behavior.
- `lib/backupRestoreGuard.ts`: restore sequencing independent of React.
- `lib/backupRestoreGuard.test.ts`: proves stale writes drain before restore and locks always release.
- `lib/backupImport.ts`, `lib/backupImport.test.ts`: 500 MiB pre-read validation.
- `app/page.tsx`: owns the coordinator, lifecycle listeners, book-switch/close behavior, restore guard, and EPUB mode snapshot.
- `app/EpubReader.tsx`, `app/ReadingSession.tsx`: route relocation persistence through the shared coordinator and remove local fire-and-forget teardown writes.
- `app/ServiceWorkerRegistration.tsx`: dispatch a flush event before controlled reload.
- `lib/readingPersistenceIntegration.test.ts`: source contracts for lifecycle, restore, and EPUB wiring.
- `public/sw.js`, `lib/serviceWorkerUpdate.test.ts`: prefix-scoped cache cleanup.
- `lib/aiChat.ts`, `lib/aiChat.test.ts`: Gemini header authentication.
- `lib/uiText.ts`: dedicated oversized-backup message.
- `e2e/native-navigation.spec.ts`: browser smoke for immediate close/mode persistence where deterministic.
- `HANDOFF.md`: exact commits, gates, deployment version, and physical-device boundary.

---

### Task 1: Add an ordered pending-position coordinator

**Files:**
- Create: `lib/readerPositionCoordinator.ts`
- Create: `lib/readerPositionCoordinator.test.ts`

- [ ] **Step 1: Write failing coordinator tests**

Create tests using `vi.useFakeTimers()` that require this public API:

```ts
const coordinator = createReaderPositionCoordinator(save, 180);
coordinator.schedule(first);
coordinator.schedule(latest);
await vi.advanceTimersByTimeAsync(180);
await coordinator.flush();
expect(saved).toEqual([latest]);
```

Add separate tests proving:

```ts
coordinator.schedule(position);
await coordinator.cancel();
await vi.advanceTimersByTimeAsync(180);
expect(saved).toEqual([]);
```

```ts
coordinator.setBlocked(true);
coordinator.schedule(position);
await coordinator.saveNow(position);
expect(saved).toEqual([]);
```

```ts
coordinator.schedule(first);
await vi.advanceTimersByTimeAsync(180);
coordinator.schedule(latest);
await coordinator.flush();
expect(saved).toEqual([first, latest]);
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm.cmd test -- lib/readerPositionCoordinator.test.ts
```

Expected: FAIL because the module and API do not exist.

- [ ] **Step 3: Implement the minimal coordinator**

Export:

```ts
export type ReaderPositionCoordinator = {
  schedule: (position: ReadingPosition) => void;
  saveNow: (position: ReadingPosition) => Promise<void>;
  flush: () => Promise<void>;
  cancel: () => Promise<void>;
  setBlocked: (blocked: boolean) => void;
};

export function createReaderPositionCoordinator(
  persist: (position: ReadingPosition) => Promise<void>,
  delayMs = 180
): ReaderPositionCoordinator;
```

Internally keep one `pending` snapshot, one timer, one `blocked` flag, and one
promise chain. `flush` takes the pending value and appends it to the chain.
`cancel` clears pending/timer and awaits the existing chain so restoration
cannot overtake an already-started IndexedDB write. `saveNow` clears the
pending timer before appending the supplied snapshot. Blocked methods do not
enqueue new writes.

- [ ] **Step 4: Run the test and verify GREEN**

Run:

```powershell
npm.cmd test -- lib/readerPositionCoordinator.test.ts
```

Expected: all coordinator tests pass.

- [ ] **Step 5: Commit the coordinator**

```powershell
git add -- lib/readerPositionCoordinator.ts lib/readerPositionCoordinator.test.ts
git commit -m "fix: coordinate pending reader position writes"
```

---

### Task 2: Route TXT, EPUB, close, switch, and lifecycle writes through the coordinator

**Files:**
- Create: `lib/readingPersistenceIntegration.test.ts`
- Modify: `app/page.tsx`
- Modify: `app/EpubReader.tsx`
- Modify: `app/ReadingSession.tsx`
- Modify: `app/ServiceWorkerRegistration.tsx`

- [ ] **Step 1: Write failing integration contracts**

Read the four app sources and assert:

```ts
expect(pageSource).toContain("createReaderPositionCoordinator");
expect(pageSource).toContain('document.addEventListener("visibilitychange"');
expect(pageSource).toContain('window.addEventListener("pagehide"');
expect(pageSource).toContain('window.addEventListener("ai-reader-before-reload"');
expect(pageSource).toContain("positionCoordinatorRef.current.flush()");
expect(pageSource).toContain("await positionCoordinatorRef.current.flush()");
expect(epubSource).toContain("scheduleReadingPosition(position)");
expect(epubSource).not.toContain("pendingPositionRef");
expect(epubSource).not.toContain("saveTimerRef");
expect(registrationSource).toContain('new Event("ai-reader-before-reload")');
```

Also assert EPUB mode changes call `saveNow` with `readingMode: nextMode` before
`setReaderMode(nextMode)`.

- [ ] **Step 2: Run the integration test and verify RED**

```powershell
npm.cmd test -- lib/readingPersistenceIntegration.test.ts
```

Expected: FAIL because the shared coordinator is not wired.

- [ ] **Step 3: Create one stable coordinator in `page.tsx`**

Use a ref initialized once:

```ts
const positionCoordinatorRef = useRef<ReaderPositionCoordinator | null>(null);
if (!positionCoordinatorRef.current) {
  positionCoordinatorRef.current = createReaderPositionCoordinator(
    saveReadingPosition,
    180
  );
}
```

Replace TXT's local timer body with:

```ts
positionCoordinatorRef.current.schedule({
  bookId: openBook.id,
  locator: readerMode === "paged" ? "txt-paged" : "txt-scroll",
  progressPercent,
  readingMode: readerMode,
  updatedAt: new Date().toISOString(),
});
```

Remove `readerSaveTimerRef` and its cleanup.

- [ ] **Step 4: Wire normal lifecycle flushes**

Before opening a different book, await:

```ts
await positionCoordinatorRef.current.flush();
```

On normal reader dismissal, start `flush()` before dismissing navigation. Add
one effect that calls it when the document becomes hidden, on `pagehide`, and
on `ai-reader-before-reload`. Register and remove all listeners in that effect.

In `ServiceWorkerRegistration`, immediately before each controlled
`window.location.reload()` call, dispatch:

```ts
window.dispatchEvent(new Event("ai-reader-before-reload"));
```

- [ ] **Step 5: Remove EPUB-local persistence timers**

Change `ReadingSession`/`EpubReader` props from direct persistence to:

```ts
scheduleReadingPosition: (position: ReadingPosition) => void;
```

In `handleRelocated`, construct the same `ReadingPosition` and call
`scheduleReadingPosition(position)`. Remove `pendingPositionRef`,
`saveTimerRef`, their timeout, and the teardown `void saveReadingPosition(...)`.
The page-level coordinator now survives rendition teardown.

- [ ] **Step 6: Persist EPUB mode changes immediately**

In `handleReaderModeChange`, before `setReaderMode(nextMode)`, obtain:

```ts
const snapshot = epubReaderRef.current?.getCurrentSnapshot();
```

For EPUB, call:

```ts
void positionCoordinatorRef.current.saveNow({
  bookId: openBook.id,
  locator: snapshot?.locator ?? "epub-unknown",
  progressPercent: snapshot?.progressPercent ?? readerProgressPercent,
  readingMode: nextMode,
  updatedAt: new Date().toISOString(),
});
```

For TXT, use `saveNow` with its computed progress and new locator. This clears
any older pending snapshot before the mode transition.

- [ ] **Step 7: Run focused tests and verify GREEN**

```powershell
npm.cmd test -- lib/readerPositionCoordinator.test.ts lib/readingPersistenceIntegration.test.ts lib/readerChromeIntegration.test.ts lib/epubReaderMode.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 8: Commit lifecycle persistence**

```powershell
git add -- app/page.tsx app/EpubReader.tsx app/ReadingSession.tsx app/ServiceWorkerRegistration.tsx lib/readingPersistenceIntegration.test.ts
git commit -m "fix: flush the latest reader position on lifecycle exits"
```

---

### Task 3: Quiesce reader writes before backup replacement

**Files:**
- Create: `lib/backupRestoreGuard.ts`
- Create: `lib/backupRestoreGuard.test.ts`
- Modify: `app/page.tsx`
- Modify: `lib/backupUiIntegration.test.ts`

- [ ] **Step 1: Write a failing restore-order test**

Test a helper with event-recording callbacks:

```ts
await runBackupRestoreGuarded({
  coordinator,
  stopReader: () => events.push("stop-reader"),
  restore: async () => events.push("restore"),
  reload: async () => events.push("reload"),
});

expect(events).toEqual([
  "blocked:true",
  "cancel",
  "stop-reader",
  "restore",
  "reload",
  "blocked:false",
]);
```

Add a rejection test proving `blocked:false` occurs in `finally` when restore
throws.

- [ ] **Step 2: Run the test and verify RED**

```powershell
npm.cmd test -- lib/backupRestoreGuard.test.ts
```

Expected: FAIL because `runBackupRestoreGuarded` does not exist.

- [ ] **Step 3: Implement the guard**

Export:

```ts
export async function runBackupRestoreGuarded(options: {
  coordinator: ReaderPositionCoordinator;
  stopReader: () => void;
  restore: () => Promise<void>;
  reload: () => Promise<void>;
}): Promise<void> {
  options.coordinator.setBlocked(true);
  try {
    await options.coordinator.cancel();
    options.stopReader();
    await options.restore();
    await options.reload();
  } finally {
    options.coordinator.setBlocked(false);
  }
}
```

- [ ] **Step 4: Integrate the guarded restore**

After parsing and validating the selected file, replace the current sequence
with `runBackupRestoreGuarded`. `stopReader` must dismiss navigation, clear the
reader, and reset Ask AI before `restoreBackupPayload`. `reload` must refresh
books, reading positions, groups, daily stats, custom background, group filter,
and AI settings before the success message.

Update `backupUiIntegration.test.ts` to assert stop/clear source positions are
before `restoreBackupPayload(data)`, and that the guarded helper is used.

- [ ] **Step 5: Run restore tests and verify GREEN**

```powershell
npm.cmd test -- lib/backupRestoreGuard.test.ts lib/backupUiIntegration.test.ts lib/backup.test.ts lib/readerPositionCoordinator.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 6: Commit restore isolation**

```powershell
git add -- lib/backupRestoreGuard.ts lib/backupRestoreGuard.test.ts lib/backupUiIntegration.test.ts app/page.tsx
git commit -m "fix: isolate backup restore from stale reader writes"
```

---

### Task 4: Reject oversized backup files before reading

**Files:**
- Create: `lib/backupImport.ts`
- Create: `lib/backupImport.test.ts`
- Modify: `app/page.tsx`
- Modify: `lib/uiText.ts`

- [ ] **Step 1: Write boundary tests**

```ts
expect(() => assertBackupImportSize(500 * 1024 * 1024)).not.toThrow();
expect(() => assertBackupImportSize(500 * 1024 * 1024 + 1)).toThrow(
  UI_TEXT.BACKUP_TOO_LARGE
);
```

Add a source assertion that `assertBackupImportSize(file.size)` occurs before
`await file.text()`.

- [ ] **Step 2: Run tests and verify RED**

```powershell
npm.cmd test -- lib/backupImport.test.ts lib/backupUiIntegration.test.ts
```

Expected: FAIL because the size guard and copy do not exist.

- [ ] **Step 3: Implement the guard and copy**

```ts
export const MAX_BACKUP_IMPORT_BYTES = 500 * 1024 * 1024;

export function assertBackupImportSize(size: number): void {
  if (size > MAX_BACKUP_IMPORT_BYTES) {
    throw new Error(UI_TEXT.BACKUP_TOO_LARGE);
  }
}
```

Add `BACKUP_TOO_LARGE` with the Chinese meaning: “备份文件超过 500MB，当前设备无法安全恢复。” Call the guard immediately after selecting the file and before `file.text()`.

- [ ] **Step 4: Run tests and verify GREEN**

```powershell
npm.cmd test -- lib/backupImport.test.ts lib/backupUiIntegration.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 5: Commit the import guard**

```powershell
git add -- lib/backupImport.ts lib/backupImport.test.ts lib/backupUiIntegration.test.ts lib/uiText.ts app/page.tsx
git commit -m "fix: reject oversized backup imports before reading"
```

---

### Task 5: Scope Service Worker cleanup and move Gemini keys to headers

**Files:**
- Modify: `public/sw.js`
- Modify: `lib/serviceWorkerUpdate.test.ts`
- Modify: `lib/aiChat.ts`
- Modify: `lib/aiChat.test.ts`

- [ ] **Step 1: Write failing Service Worker assertions**

Require:

```ts
expect(workerSource).toContain('const CACHE_PREFIX = "ai-reader-"');
expect(workerSource).toContain("key.startsWith(CACHE_PREFIX)");
expect(workerSource).not.toContain("keys.filter((key) => key !== CACHE_NAME)");
```

- [ ] **Step 2: Write failing Gemini request assertions**

Update the Gemini request test to require:

```ts
expect(request.url).toBe(
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"
);
expect(request.init.headers).toMatchObject({
  "Content-Type": "application/json",
  "x-goog-api-key": "gemini-secret",
});
expect(request.url).not.toContain("gemini-secret");
```

- [ ] **Step 3: Run both tests and verify RED**

```powershell
npm.cmd test -- lib/serviceWorkerUpdate.test.ts lib/aiChat.test.ts
```

Expected: both new contracts fail against current production code.

- [ ] **Step 4: Implement both narrow fixes**

In `sw.js` add `CACHE_PREFIX` and filter activation cleanup with:

```js
keys.filter(
  (key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME
)
```

In the Gemini branch remove `?key=...` and add
`"x-goog-api-key": provider.apiKey` to the existing headers.

- [ ] **Step 5: Run tests and verify GREEN**

```powershell
npm.cmd test -- lib/serviceWorkerUpdate.test.ts lib/aiChat.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 6: Commit safeguards**

```powershell
git add -- public/sw.js lib/serviceWorkerUpdate.test.ts lib/aiChat.ts lib/aiChat.test.ts
git commit -m "fix: scope cache cleanup and Gemini credentials"
```

---

### Task 6: Verify damaged-book isolation remains intact

**Files:**
- Modify: `lib/db.test.ts`
- Modify: `lib/libraryMetadataLoadingIntegration.test.ts`

- [ ] **Step 1: Add a regression test**

Save three books, remove one `bookFiles` row, then assert:

```ts
expect((await listBookMetadata()).map((book) => book.id).sort()).toEqual([
  "broken",
  "first",
  "second",
]);
expect(await getBook("broken")).toBeUndefined();
expect(await (await getBook("first"))?.fileBlob.text()).toBe("first");
expect(await (await getBook("second"))?.fileBlob.text()).toBe("second");
```

- [ ] **Step 2: Run the regression test**

```powershell
npm.cmd test -- lib/db.test.ts lib/libraryMetadataLoadingIntegration.test.ts
```

Expected: PASS because the recently deployed metadata-only architecture already
implements this isolation. This is a characterization test, not a new product
change; it therefore does not require an artificial RED failure.

- [ ] **Step 3: Commit the retained regression coverage**

```powershell
git add -- lib/db.test.ts lib/libraryMetadataLoadingIntegration.test.ts
git commit -m "test: preserve damaged book isolation"
```

---

### Task 7: Full verification, publication, and deployment

**Files:**
- Modify: `HANDOFF.md`

- [ ] **Step 1: Run complete local gates**

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
git diff --check
git status -sb
```

Expected: all tests pass, lint/build exit `0`, no whitespace errors, and only
the intended handoff update remains after code commits.

- [ ] **Step 2: Run focused mobile browser flows**

```powershell
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-14 --grep "reader closes back|renames a book|book action sheet entrance" --workers=1 --retries=0 --trace=off
```

Expected: selected flows pass. Preserve any observed performance failure exactly
and do not rerun it away.

- [ ] **Step 3: Update and commit HANDOFF**

Record commits, exact test counts, build results, browser metrics, remaining
physical iPhone lifecycle checks, and that publication was user-authorized.

```powershell
git add -- HANDOFF.md
git commit -m "docs: record reading reliability verification"
```

- [ ] **Step 4: Push the existing branch and update PR #4**

```powershell
git push origin codex/shared-sheet-performance
gh pr view 4 --json headRefOid,state,isDraft,url
```

Expected: remote head equals local head; PR #4 remains open and draft unless the
user separately requests a status change.

- [ ] **Step 5: Build and deploy the verified product commit**

```powershell
$env:NEXT_PRIVATE_STANDALONE='true'
$env:NEXT_PRIVATE_OUTPUT_TRACE_ROOT=(Get-Location).Path
npm.cmd run build
node node_modules\@opennextjs\cloudflare\dist\cli\index.js build --skipNextBuild
node node_modules\@opennextjs\cloudflare\dist\cli\index.js deploy
```

Expected: OpenNext deploy exits `0` and prints a new Worker version ID.

- [ ] **Step 6: Verify production once**

Check `/`, all discovered page JS/CSS, `/BUILD_ID`, `/sw.js`,
`/manifest.webmanifest`, `/.well-known/assetlinks.json`, the signed APK, and the
expected `/api/models` validation response. Run the same focused iPhone 14
Playwright command once with `PLAYWRIGHT_BASE_URL=https://881817.xyz`. Record
all results without replacing failures.

- [ ] **Step 7: Record deployment and push the record**

```powershell
git add -- HANDOFF.md
git commit -m "docs: record reading reliability deployment"
git push origin codex/shared-sheet-performance
git status -sb
```

Expected: clean worktree tracking the remote branch. Do not merge `main`.
