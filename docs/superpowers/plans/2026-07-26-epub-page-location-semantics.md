# EPUB Page and Location Semantics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop presenting generated EPUB CFI locations as pages while preserving real publisher page numbers and TXT pagination.

**Architecture:** Add an explicit semantic unit to the shared reader-page value, keep `page` as the backward-compatible default, and mark only generated EPUB CFI indexes as `location`. Central formatters own all visible wording, while a small helper prevents location indexes from entering annotation `pageNumber` fields.

**Tech Stack:** TypeScript, React 19, epub.js, Vitest, Playwright, Next.js 16

---

## File Map

- `lib/readerPageInfo.ts`: defines the page/location unit, normalization,
  formatting, EPUB mapping, and annotation page-number filtering.
- `lib/readerPageInfo.test.ts`: verifies wording, normalization, publisher pages,
  generated locations, and annotation filtering.
- `lib/readerMenuIntegration.test.ts`: locks the reader lifecycle wiring without
  depending on browser timing.
- `app/EpubReader.tsx`: publishes unit-aware values and only exposes real pages
  to annotation snapshots.
- `e2e/epub-page-info.spec.ts`: verifies a long reflowable EPUB without a
  `page-list` resolves to a whole-book location count.

### Task 1: Model and format page versus location

**Files:**
- Modify: `lib/readerPageInfo.test.ts`
- Modify: `lib/readerPageInfo.ts`

- [ ] **Step 1: Write failing semantic tests**

Add assertions that the page-list path remains a page, generated CFI indexes
become locations, location labels do not say page, and only real pages may be
stored on annotations:

```ts
import {
  formatReaderPageLabel,
  formatReaderPageSummary,
  getAnnotationPageNumber,
  getEpubBookPageInfo,
  normalizeReaderPageInfo,
} from "./readerPageInfo";

expect(formatReaderPageLabel({ current: 288, total: 901, unit: "location" }))
  .toBe("位置 288/901");
expect(formatReaderPageSummary({ current: 288, total: 901, unit: "location" }))
  .toBe("位置 288（共 901 个）");
expect(normalizeReaderPageInfo({ current: 999, total: 20, unit: "location" }))
  .toEqual({ current: 20, total: 20, unit: "location" });
expect(getAnnotationPageNumber({ current: 8, total: 20, unit: "page" }))
  .toBe(8);
expect(getAnnotationPageNumber({ current: 8, total: 20, unit: "location" }))
  .toBeUndefined();
```

Update the EPUB expectations to require `{ unit: "page" }` for a publisher
`page-list` and `{ unit: "location" }` for generated indexes. Update status
expectations to `正在计算阅读位置…` and `阅读位置未知`.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm.cmd test -- lib/readerPageInfo.test.ts
```

Expected: failure because `unit` and `getAnnotationPageNumber` do not exist and
the current strings still claim generated values are pages.

- [ ] **Step 3: Implement the minimal semantic model**

In `lib/readerPageInfo.ts`, add the unit and preserve it through normalization:

```ts
export type ReaderPageUnit = "page" | "location";

export type ReaderPageInfo = {
  current: number;
  total: number;
  unit?: ReaderPageUnit;
  status?: "calculating" | "unavailable";
};

export function normalizeReaderPageInfo(pageInfo: ReaderPageInfo): ReaderPageInfo {
  const total = safePositiveInteger(pageInfo.total, 1);
  const current = Math.min(total, safePositiveInteger(pageInfo.current, 1));
  return {
    current,
    total,
    ...(pageInfo.unit ? { unit: pageInfo.unit } : {}),
  };
}
```

Make the formatters unit-aware:

```ts
export function formatReaderPageLabel(pageInfo: ReaderPageInfo): string {
  if (pageInfo.status === "calculating") return "正在计算阅读位置…";
  if (pageInfo.status === "unavailable") return "阅读位置未知";
  const normalized = normalizeReaderPageInfo(pageInfo);
  return normalized.unit === "location"
    ? `位置 ${normalized.current}/${normalized.total}`
    : `${normalized.current}/${normalized.total}页`;
}

export function formatReaderPageSummary(pageInfo: ReaderPageInfo): string {
  if (pageInfo.status === "calculating") return "正在计算阅读位置…";
  if (pageInfo.status === "unavailable") return "阅读位置未知";
  const normalized = normalizeReaderPageInfo(pageInfo);
  return normalized.unit === "location"
    ? `位置 ${normalized.current}（共 ${normalized.total} 个）`
    : `第 ${normalized.current} 页（共 ${normalized.total} 页）`;
}

export function getAnnotationPageNumber(
  pageInfo: ReaderPageInfo
): number | undefined {
  if (pageInfo.unit === "location" || pageInfo.status) return undefined;
  return normalizeReaderPageInfo(pageInfo).current;
}
```

Return `unit: "page"` from the validated publisher-page branch and
`unit: "location"` from the generated-location branch of
`getEpubBookPageInfo()`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```powershell
npm.cmd test -- lib/readerPageInfo.test.ts lib/readerMenuIntegration.test.ts
```

Expected: all tests pass; any old status-string integration assertion is
updated in Task 2 if it fails here.

- [ ] **Step 5: Commit the semantic model**

```powershell
git add -- lib/readerPageInfo.ts lib/readerPageInfo.test.ts
git commit -m "fix: distinguish EPUB pages from locations"
```

### Task 2: Prevent generated locations from becoming annotation pages

**Files:**
- Modify: `lib/readerMenuIntegration.test.ts`
- Modify: `app/EpubReader.tsx`

- [ ] **Step 1: Write the failing integration assertions**

Extend the reader lifecycle source integration test:

```ts
expect(readerBookStateSource).toContain('status: book.format === "epub" ? "calculating" : undefined');
expect(epubReaderSource).toContain("getAnnotationPageNumber(pageInfo)");
expect(epubReaderSource).not.toContain("latestPageNumberRef.current = pageInfo.current");
```

Keep the assertions for generated locations, refreshing the current location,
and the unavailable fallback.

- [ ] **Step 2: Run the integration test and verify RED**

Run:

```powershell
npm.cmd test -- lib/readerMenuIntegration.test.ts
```

Expected: failure because `EpubReader` still assigns every current location to
`latestPageNumberRef`.

- [ ] **Step 3: Wire the page-number filter into EPUB relocation**

Import the helper in `app/EpubReader.tsx`:

```ts
import {
  getAnnotationPageNumber,
  getEpubBookPageInfo,
  type ReaderPageInfo,
} from "@/lib/readerPageInfo";
```

Replace the unconditional assignment inside `handleRelocated`:

```ts
if (pageInfo) {
  hasResolvedPageInfoRef.current = true;
  latestPageNumberRef.current = getAnnotationPageNumber(pageInfo);
  onPageInfoChangeRef.current?.(pageInfo);
}
```

This immediately clears a stale synthetic value while keeping CFI locator and
progress metadata available for every bookmark and highlight.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```powershell
npm.cmd test -- lib/readerPageInfo.test.ts lib/readerMenuIntegration.test.ts lib/readerAnnotations.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 5: Commit the reader integration**

```powershell
git add -- app/EpubReader.tsx lib/readerMenuIntegration.test.ts
git commit -m "fix: keep EPUB locations out of annotation pages"
```

### Task 3: Verify the browser contract and full application

**Files:**
- Modify: `e2e/epub-page-info.spec.ts`
- Modify: `HANDOFF.md`

- [ ] **Step 1: Update the browser regression to the location contract**

Rename the test to `EPUB location label resolves from calculating to a
whole-book count`. Require `正在计算阅读位置…`, then poll for a label matching
the location unit:

```ts
const label = (await chrome.innerText()).match(/位置 \d+\/(\d+)/);
if (!label) return 0;
observedLabels.push(label[0]);
return Number(label[1]);
```

After the total exceeds one, assert:

```ts
expect(observedLabels).not.toContain("位置 1/1");
await expect(chrome).not.toContainText(/\d+\/\d+页/);
```

- [ ] **Step 2: Run the focused Vitest checks**

Run:

```powershell
npm.cmd test -- lib/readerPageInfo.test.ts lib/readerMenuIntegration.test.ts lib/readerAnnotations.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 3: Run the targeted browser regression**

Build and serve the app using an unused local port, then run:

```powershell
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:<unused-port>'
npx.cmd playwright test e2e/epub-page-info.spec.ts --project=iphone-14 --workers=1 --retries=0 --trace=off
```

Expected: 1 test passes and the long EPUB resolves to `位置 current/total` with
a total greater than one.

- [ ] **Step 4: Run complete verification**

Run:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
git diff --check
```

Expected: full Vitest, ESLint, and production Next.js build pass; diff check
reports no whitespace errors.

- [ ] **Step 5: Record evidence and commit**

Add a concise authoritative section to `HANDOFF.md` describing page/location
semantics, the exact verification results, and that production was not
redeployed. Then commit:

```powershell
git add -- e2e/epub-page-info.spec.ts HANDOFF.md
git commit -m "test: verify EPUB location semantics"
```

- [ ] **Step 6: Inspect publication state**

Run:

```powershell
git status -sb
git log -8 --oneline --decorate
```

Expected: the worktree is clean and the branch is ahead of its remote. Do not
merge `main`, push `main`, deploy production, or claim publication without the
required authorization and evidence.
