# Reader Experience Refinement Implementation Plan

> **For agentic workers:** Use subagent-driven-development for isolated implementation/review tasks, and execute coupled persistence work in the coordinating session. Track completed steps below.

**Goal:** Implement the approved three-stage experience design and verify A1–C5 without changing production during development.

**Architecture:** Reuse existing surfaces, sheets, reader position coordination and IndexedDB transactions. Extract backup/import orchestration from Home; keep update discovery separate from user-authorized reload. Add narrow, tested cross-tab data revision protection and AI request authorization checks.

**Tech Stack:** Next.js 16, React 19, TypeScript, Dexie, Motion, Vitest, Playwright.

## Baseline and scope

- Worktree: `C:/aaa/ai-reader-pwa/.worktrees/pwa-interaction-fluidity`.
- Approved design: `docs/superpowers/specs/2026-09-18-reader-experience-refinement-design.md`.
- Baseline: `93470e2`; initial Vitest 145 files / 1308 tests pass.
- Initial fetch failed with TLS handshake errors using both schannel and OpenSSL. Continue local work; independently resolve connectivity before integration. Never disable certificate verification.
- No reset, clean, force push, user-data operations, new dependencies or production deployment.
- Existing Home budget remains 1935 lines. Extract owned flows instead of raising it.

## Task 1: Search parity (A8–A9)

Files: `lib/libraryFilters.ts`, `lib/libraryFilters.test.ts`, `app/LibraryBookResults.tsx`, `app/LibrarySearchSurface.tsx`, `e2e/book-details.spec.ts`.

- [x] Add behavioral cases for enriched titles/authors/tags, NFKC, whitespace, cross-field AND and stable ordering. Test shape:

```ts
expect(filterBooksByQuery([book], "马克思 资本论")).toEqual([book]);
expect(filterBooksByQuery([book], "马克思 不存在")).toEqual([]);
expect(filterBooksByQuery([book], "ＴＸＴ")).toEqual([book]);
```

- [x] Run `npx.cmd vitest run lib/libraryFilters.test.ts`; observe missing-field failures.
- [x] Normalize searchable values with `value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase()`; match every query token against at least one field, preserve input ordering. Export a small match-context helper for result presentation; keep user title unchanged.
- [x] Add optional search query to shared results, show enriched title and author/tag match context only where relevant. No remote calls or full-text indexing.
- [x] Run focused units and browser search/details/back journey; record evidence for A8–A9.

## Task 2: Safe backup restoration (A1–A4)

Files: `lib/backup.ts`, `lib/db.ts`, `lib/backupRestoreGuard.ts`, new `lib/backupPresentation.ts`, new `lib/readerDataRevision.ts`, new `app/useBackupTransfer.ts`, new `app/BackupRestoreSheet.tsx`, `app/SettingsSurface.tsx`, `app/page.tsx`, `app/useBookMetadataEnrichment.ts`, related tests.

- [x] Add pure presentation/error cases and real fake-indexeddb replacement cases before implementation:

```ts
expect(buildBackupPreview(validEmptyV1).bookCount).toBe(0);
expect(buildBackupPreview(validEmptyV1).replacesWorkspace).toBe(true);
await expect(restoreWithStaleRevision()).rejects.toThrow();
expect(await listBookMetadata()).toEqual(originalBooks);
```

- [x] Implement validation-only preparation, counts/date/version impact, Chinese typed error mapping. Keep `{ payload, revision, fileName }` until confirmation. Invalid selection and cancel have no persistence side effects.
- [x] Protect replacement with transactional revision/epoch checks that cover every database write; test concurrent/stale clients. Old database connections must not silently write after replacement. Prefer a tiny persisted coordination record to ad hoc per-component locks.
- [x] Extend metadata task control with abort-and-drain; stop AI/cover/metadata work with a 10-second bound before replacement. Abort/timeout prevents the transaction and releases UI blocking; never restart paid AI automatically.
- [x] Extract backup handlers into `useBackupTransfer`; render an existing-style sheet with file/date/counts/impact, zero-book warning, cancel, export-before-restore and explicit destructive commit. Ensure focus return and busy guards.
- [x] Restore database and provider configuration as separately reported phases. Preserve existing v1/v2/v3 semantics. Export must say download initiated, not that disk persistence is proven.
- [x] Verify cancellation, empty replacement, invalid/large backup, stale revision, transaction rollback, task timeout and partial configuration failure; browser E2E uses isolated data only.

## Task 3: User-controlled updates (A5–A7)

Files: `app/ServiceWorkerRegistration.tsx`, `public/sw.js`, new `lib/appUpdate.ts`, new `app/AppUpdateNotice.tsx`, `app/SettingsSurface.tsx`, `app/useReaderPositionLifecycle.ts`, `app/page.tsx`, `app/AiSettingsSurface.tsx`, `app/useWorkspaceChat.ts`, update tests.

- [x] Add executable worker/controller tests proving discovery and controller change do not reload, first install does not announce an update, user update flushes successfully once, failed flush does not reload.
- [x] Centralize candidate build, running build, deferred candidate and update action in a small subscription API. Emit only a pending-update notification from detection.
- [x] Register dirty/busy state for provider forms, questions, note editing, imports/restores and AI output. Confirmation choices distinguish unsaved drafts, non-interruptible transfer and stoppable generation. Read-only checks never clear drafts.
- [x] Reuse the before-reload waitUntil protocol with rejected flush propagation. Activate a waiting worker by explicit message; reload only the requesting client. Retain old caches while old clients are open; scope all cleanup to AI Reader caches.
- [x] Add unobtrusive non-reader notice and persistent Settings entry. Same-version “later” suppresses repeated notice per session. Reading/typing/AI output do not get intrusive prompts.
- [x] Verify draft survival on build change/resume, busy operation, flush failure, exactly-one reload, two clients and offline resources. Document unavoidable initial migration from old automatic reload clients.

## Task 4: Observable import and exact duplicate handling (B1–B3)

Files: new `app/useBookImport.ts`, new `app/BookImportStatus.tsx`, new `lib/bookImportDuplicate.ts`, `lib/importBook.ts`, `app/page.tsx`, library surfaces, duplicate tests.

- [x] Test renamed identical bytes, same-name different bytes, cancel-before-save and simultaneous duplicate imports.
- [x] Implement a single active import state with operation generation, filename/stage/status and cancel until commit. Reuse input bytes; metadata runs after successful save without holding import busy.
- [x] Filter potential duplicates by format/size, hash only candidates locally, compare and recheck within the cross-tab commit boundary. No bulk migration or persisted hash index.
- [x] Present existing book/progress with open-existing, import-another and cancel; detection failure offers cancel or explicit continue. Keep existing progress and annotations untouched.
- [x] Wire success/status/reselect UI, preserving current root. No automatic reader navigation after success.
- [x] Verify delayed reads, repeated clicks, cancelled late result, duplicate choices and concurrent contexts.

## Task 5: Explicit AI enrichment control (B4–B6)

Files: `lib/appPreferences.ts`, `lib/bookMetadataEnrichment.ts`, `app/useBookMetadataEnrichment.ts`, `app/AiSettingsSurface.tsx`, `app/BookDetailsSurface.tsx`, `app/useBookDetailsIntegration.ts`, `PRODUCT.md`, associated tests.

- [x] Test missing preference => false, public metadata without AI, opt-in => eligible request, opt-out before send => no AI, explicit one-book consent => request without changing preference.
- [x] Add `autoAiMetadata` false default to preference sanitization/persistence. Enrichment reads current authorization immediately before sending, not only at task creation.
- [x] Add provider-settings switch and accurate secret/request copy. Toggle affects future imports/manual updates only; no scan or replay when enabled.
- [x] Return a manual-completion offer for missing prose with automatic AI disabled. Explicit one-book action shows provider/request scope and does not toggle global preference.
- [x] Keep public queries independent; preserve existing data on failure, mark AI provenance beside generated prose and classify network/provider/no-match errors honestly.
- [x] Verify all calls with fake credentials and mocked endpoints; never send real books or keys.

## Task 6: Reader/detail polish (C1–C5)

Files: `app/ReaderControls.tsx`, `app/BookDetailsSurface.tsx`, `app/page.module.css`, `lib/bookDetailsPresentation.ts`, `lib/uiText.ts`, relevant E2E.

- [x] Scope opaque `#000000` reader overlay surfaces and press states to effective Dark, including System Dark. Preserve global surfaces, Light/Sepia and EPUB media.
- [x] Replace trailing “大小” with a standard navigation glyph. Preserve targets, layout, transitions and reduced motion.
- [x] Use plain metadata action labels, inline retry and distinct no-match/offline/timeout/provider messages. AI retry follows Task 5 consent.
- [x] Keep <=3 tags only in hero; show view-all navigation for >3. Clamp descriptions to six lines only when actually overflowing; expand/collapse with aria-expanded and stable scroll/focus.
- [x] Verify stable-state screenshots, press states, 200% text, keyboard and reduced motion using the existing mobile projects. Do not create string-matching CSS tests for visual polish.

## Task 7: Integration, verification and handoff

- [x] Run `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build` and inspect every failure.
- [x] Run new isolated-data experience E2E and the required full native-navigation matrix on a production build with one worker, zero retries and `--trace=off`.
- [x] Review spec compliance first, then code quality; fix findings without weakening thresholds or suppressing failed samples.
- [x] Record A1–C5 evidence and initial migration caveat in HANDOFF and update design status.
- [x] Check `git diff --check`; commit explicit files, preserve unrelated work. Resolve remote connectivity with validated TLS, then integrate through a normal PR and passing CI under existing user authorization.
- [x] Confirm no production deploy occurred; report completion only when all required work, including integration, is verified.

## Execution notes

2026-09-30 integration complete: PR #22 merged into main at bbc6d65 after required GitHub CI passed. Review findings are resolved, local work is committed, and production was not deployed. Dependency security follow-up uses Next/eslint-config-next 16.3.7, sharp 0.35.4 and XML parser overrides 0.8.15; production audit has no high/critical findings.

2026-09-30 closeout:

- Tasks 1–6 are implemented. Final reader keyboard handoff includes horizontal keys; the End-key regression requires real progress advancement and matching persisted position. Focused production-build E2E passed 4/4 across both mobile profiles, including paged TXT.
- Preserve the earlier complete 262/262 matrix as its own evidence. A later matrix was interrupted during its second device profile and recorded one 50ms contents-tab frame against the 34ms gate; it is not claimed as a passing full run. User requested targeted verification for final closeout.
- PR integration and CI are being completed; production deployment is outside this goal.

2026-09-20 progress (superseded by the 2026-09-23 status below):

- All seven feature areas are implemented locally; no implementation commit, PR, merge or production deployment yet. Final checklist remains open until latest-source verification and integration.
- Search A8/A9, backup confirmation, import cancellation/duplicate decisions, explicit update + failed flush retry: 9/9 targeted iPhone 14 browser cases passed. AI existing-user single consent: 1/1 passed separately.
- Expanded visual/interaction batch: 18/18 iPhone 14 cases passed, including 0/1/3/5 tags, long description keyboard expansion/collapse at 200%, Dark/System Dark pure-black controls/press states, preserved Light/Sepia, opt-in/opt-out and search round trip. Stable screenshots inspected; no CSS-source matching substituted for visual QA.
- Full unit baseline after initial implementation: 152 files / 1370 tests passed; lint and production build passed. Later safety changes require rerunning final gates.
- Full browser matrix first diagnostic run was interrupted after identifying stale direct-reader paths and a genuine enlarged-text status overlay obstruction. The status is now inline in the root surface, and tests explicitly enter/leave details without changing thresholds.
- Subsequent complete browser diagnostic: 236 passed / 20 failed out of 256 (13.9 min, one worker, zero retries, trace off). Failures retained: identical-byte multi-book fixtures, ambiguous Close labels, old reader reload path, missing randomUUID fallback, an unmocked metadata 502, and frame-budget failures. Fixes are in progress; this run is not a passing gate.
- Build-ID mismatch reproduced between `.next/BUILD_ID` and prerender endpoint. Parent environment inheritance fixed it; two subsequent production builds had matching server, endpoint and client-chunk IDs.
- Reviews found and prompted fixes for off→on reviving cancelled AI permission, cross-tab duplicate navigation with stale UI data, swallowed streaming cancellation saves, and retained chunks not falling back on HTTP 404. Latest fixes need browser revalidation and review. Strict workspace flush retains failed cancellation writes and retries them before update/restore.
- Import bytes are reused through weak Blob ownership; candidate digests are cached for the session and conservatively invalidated on any shared data revision/epoch change.
- Remaining: latest-source safety E2E, two-client/dirty update cases, full matrix including unchanged performance gates, final code review, acceptance evidence + HANDOFF, validated GitHub connectivity and normal PR integration. No deployment in this goal.

2026-09-18: Design approved by “设个目标，开始做吧”. Goal active. Existing linked worktree verified; baseline passed. Initial GitHub fetch currently fails TLS before authentication; local implementation is unblocked.

2026-09-23 verification update (superseded by 2026-09-24 below):

- Implemented the full A1–C5 scope in isolated test data, including backup-preview/revision fencing, explicit update consent and per-tab reload, observable import and exact duplicate checks, opt-in AI metadata consent, NFKC metadata search, reader-only black surfaces and details refinements. The physical iPhone/PWA verification exclusions remain unchanged.
- Fixed a reader progress/layout race found during repeated iPhone 14 runs: TXT paragraph chunks using `content-visibility:auto` can expand their intrinsic heights after a percentage scroll is restored. The reader now preserves the last semantic scroll percentage through observed content-height changes, and leaving the reader recomputes and immediately persists progress to synchronize the Details view and IndexedDB.
- The search → reader → back → reopen regression passed **10/10** repeated runs on iPhone 14 before extraction and then **2/2** across iPhone 14 and iPhone 15 Pro Max after extracting the layout observer. The regression compares the persisted value, Details value and reopened scroll ratio rather than assuming a placeholder-based 50% scroll remains exactly 50%.
- Fresh unit tests: **153 files / 1375 tests passed**. `npm run lint` passed. `npm run build` passed with Next.js 16.2.11, TypeScript and all 10 static routes.
- Latest complete Playwright run before helper extraction: **261/262** across the two mobile profiles, one worker, zero retries, and `--trace=off`. The sole failure was existing workspace-open performance sampling on iPhone 14 (**108ms** vs **100ms**); the same test passed **5/5** immediate isolated repetitions at 59–79ms, and passed in the full run on iPhone 15 Pro Max at 75ms. No budget or threshold was changed. The exact full matrix has not yet produced one fully green run.
- `npx tsc --noEmit` is not a repository gate: it includes test files and reports existing test-target/type errors outside the Next build's checked application scope. The Next production build's TypeScript phase passed; an introduced E2E nullability warning was explicitly fixed.
- No production deployment occurred. At that point, the full matrix and independent review were outstanding.

2026-09-24 final implementation verification (integration remains in progress):

- The complete Playwright matrix passed **262/262** on iPhone 14 and iPhone 15 Pro Max with one worker, zero retries, and `--trace=off`; workspace-open performance passed on both profiles without changing its 100ms gate.
- Final pre-review gates passed: Vitest **153 files / 1378 tests**, ESLint without warnings, Next.js 16.2.11 production build/typecheck and all 10 static routes, and `git diff --check`.
- Independent review identified that keyboard scroll did not end TXT restoration preservation. The test failed before the fix and then passed on iPhone 14 after making the reader keyboard-focusable and handing restoration to keyboard scroll input; iPhone 15 and final gates remain to be rerun.
- `npx tsc --noEmit` remains intentionally excluded as a repository gate because it includes legacy test files outside the app build TypeScript scope; production build typechecking is the supported check.
- No production deployment occurred. Independent review closure, normal merge of latest `origin/main`, explicit commit, PR/CI, and normal GitHub merge remain before completion.
