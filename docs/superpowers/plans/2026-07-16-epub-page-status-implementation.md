# EPUB Page Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace false EPUB `1/1页` results with explicit calculation/failure states and correct epub.js whole-book totals.

**Architecture:** Extend `ReaderPageInfo` with backward-compatible pending and unavailable states, centralize all visible labels, and let `EpubReader` own the async generation lifecycle. Existing TXT dimension-based page counting remains unchanged.

**Tech Stack:** TypeScript, React 19, Next.js 16, epub.js 0.3.93, Vitest

---

### Task 1: Status-aware page information

**Files:**
- Modify: `lib/readerPageInfo.ts`
- Modify: `lib/readerPageInfo.test.ts`
- Modify: `app/TocDrawer.tsx`

- [ ] Add failing tests expecting `正在计算页数…`, `页数未知`, and a generated total of `locationTotal + 1`.
- [ ] Run `npm.cmd test -- lib/readerPageInfo.test.ts` and verify the new assertions fail for the missing status API and old total.
- [ ] Add `status?: "calculating" | "unavailable"`, make `formatReaderPageLabel` status-aware, add a status-aware TOC summary formatter, and convert epub.js's final index to a count.
- [ ] Use the shared TOC formatter in `TocDrawer`.
- [ ] Re-run `npm.cmd test -- lib/readerPageInfo.test.ts` and verify it passes.

### Task 2: EPUB generation lifecycle

**Files:**
- Modify: `app/useReaderBookState.ts`
- Modify: `app/EpubReader.tsx`
- Modify: `lib/readerMenuIntegration.test.ts`

- [ ] Add failing integration assertions that EPUB initialization uses `status: "calculating"`, generation awaits `reportLocation`, and failure emits `status: "unavailable"` without overwriting a valid result.
- [ ] Run `npm.cmd test -- lib/readerMenuIntegration.test.ts` and verify the assertions fail for the current silent fallback.
- [ ] Initialize EPUB page information as calculating, track whether relocation produced valid page data, await the post-generation location report, and publish unavailable only when generation fails before resolution.
- [ ] Re-run the focused integration and page-info tests and verify they pass.

### Task 3: Regression verification and handoff

**Files:**
- Modify: `HANDOFF.md`

- [ ] Run focused reader tests covering page info, menu integration, EPUB integration, and reader state.
- [ ] Run `npm.cmd test`, `npm.cmd run lint`, and `npm.cmd run build`.
- [ ] Update `HANDOFF.md` with the root cause, behavior, verification evidence, and undeployed state.
- [ ] Run `git diff --check`, inspect `git status -sb` and `git log -8 --oneline --decorate`, then commit the verified fix.

