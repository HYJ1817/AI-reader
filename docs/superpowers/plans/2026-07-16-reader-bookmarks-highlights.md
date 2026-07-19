# Reader Bookmarks and Highlights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Add persistent, navigable bookmarks and yellow, green, or blue text highlights to EPUB and TXT reading, backed by the existing annotation store and exposed through the reader contents sheet.

**Architecture:** Extend the existing annotation record instead of adding stores. Keep annotation identity, TXT locators, and TXT highlight splitting in pure library modules; keep book-scoped CRUD in one hook. EPUB uses CFI ranges and rendition annotations, while TXT uses versioned paragraph offsets and deterministic React text runs.

**Tech Stack:** Next.js 16, React 19, TypeScript, Dexie 4, EPUB.js 0.3, Motion 12, Vitest 4, Playwright 1.61, CSS Modules.

---

## File map

Create:

- lib/localId.ts and lib/localId.test.ts: old-Android-safe local IDs.
- lib/readerAnnotations.ts and lib/readerAnnotations.test.ts: shared types, partitions, duplicate identity, and recoloring.
- lib/txtAnnotations.ts and lib/txtAnnotations.test.ts: TXT locator serialization, selection capture, marked runs, and navigation.
- app/useReaderAnnotations.ts: book-scoped load and mutations.
- lib/readerAnnotationsIntegration.test.ts: ownership and orchestration regression coverage.
- lib/epubAnnotations.test.ts: EPUB selection and rendition integration coverage.
- lib/tocAnnotations.test.ts: contents-sheet behavior and accessibility coverage.
- e2e/reader-annotations.spec.ts: mobile EPUB and TXT persistence flows.

Modify:

- lib/db.ts, lib/db.test.ts, lib/backup.ts, lib/backup.test.ts
- app/EpubReader.tsx, app/ReadingSession.tsx, app/ReaderControls.tsx
- app/TocDrawer.tsx, app/AppOverlays.tsx, app/page.tsx
- app/page.module.css
- lib/readerMenuIntegration.test.ts, lib/readerChromeIntegration.test.ts
- HANDOFF.md

## Task 1: Persist typed annotations safely

**Files:**

- Create: lib/localId.ts
- Create: lib/localId.test.ts
- Modify: lib/db.ts:38-45,223-242
- Modify: lib/db.test.ts:45-61,188-211
- Modify: lib/backup.ts:236-246
- Modify: lib/backup.test.ts:144-158,309-373

- [ ] **Step 1: Write failing ID and database tests**

Create lib/localId.test.ts:

~~~ts
import { describe, expect, it, vi } from "vitest";
import { createLocalId } from "./localId";

describe("createLocalId", () => {
  it("uses a callable randomUUID", () => {
    expect(createLocalId({ randomUUID: () => "uuid-1" })).toBe("uuid-1");
  });

  it("falls back when old Android has no callable randomUUID", () => {
    const id = createLocalId(
      { randomUUID: undefined },
      () => 1720000000000,
      vi.fn(() => 0.25)
    );
    expect(id).toMatch(/^local-1720000000000-[a-z0-9]{7}$/);
  });
});
~~~

Extend the Annotations describe block in lib/db.test.ts:

~~~ts
it("deletes one annotation without touching siblings", async () => {
  await addAnnotation(makeAnnotation({ id: "keep", kind: "bookmark" }));
  await addAnnotation(makeAnnotation({ id: "remove", kind: "highlight" }));
  await deleteAnnotation("remove");
  expect((await listAnnotations("book-1")).map((item) => item.id)).toEqual(["keep"]);
});

it("normalizes legacy annotations as yellow highlights", async () => {
  const inspectionDb = new Dexie("AiReader");
  await inspectionDb.open();
  await inspectionDb.table("annotations").put({
    id: "legacy",
    bookId: "book-1",
    locator: "epubcfi(/6/2)",
    text: "legacy text",
    createdAt: "2024-01-01T00:00:00Z",
  });
  inspectionDb.close();
  expect(await listAnnotations("book-1")).toContainEqual(
    expect.objectContaining({
      id: "legacy",
      kind: "highlight",
      color: "yellow",
    })
  );
});
~~~

Extend lib/backup.test.ts with one annotation containing kind, color, progressPercent, and pageNumber. Assert validation retains all four. Add one legacy annotation and assert it normalizes to kind highlight and color yellow.

- [ ] **Step 2: Run focused tests and verify failure**

Run:

~~~powershell
npm.cmd test -- lib/localId.test.ts lib/db.test.ts lib/backup.test.ts
~~~

Expected: FAIL because createLocalId, deleteAnnotation, and richer annotation fields do not exist.

- [ ] **Step 3: Add the local ID helper**

Create lib/localId.ts:

~~~ts
type CryptoUuidSource = {
  randomUUID?: (() => string) | undefined;
};

export function createLocalId(
  source: CryptoUuidSource | undefined = globalThis.crypto,
  now: () => number = Date.now,
  random: () => number = Math.random
): string {
  if (typeof source?.randomUUID === "function") return source.randomUUID();
  const randomPart = Math.floor(random() * 36 ** 7)
    .toString(36)
    .padStart(7, "0");
  return "local-" + now() + "-" + randomPart;
}
~~~

- [ ] **Step 4: Extend and normalize annotation records**

In lib/db.ts, use these contracts:

~~~ts
export type AnnotationKind = "bookmark" | "highlight";
export type HighlightColor = "yellow" | "green" | "blue";

export type AnnotationRecord = {
  id: string;
  bookId: string;
  kind: AnnotationKind;
  locator?: string;
  text: string;
  note?: string;
  color?: HighlightColor;
  progressPercent?: number;
  pageNumber?: number;
  createdAt: string;
};

function normalizeAnnotation(record: AnnotationRecord): AnnotationRecord {
  const kind = record.kind === "bookmark" ? "bookmark" : "highlight";
  return {
    ...record,
    kind,
    ...(kind === "highlight" ? { color: record.color ?? "yellow" } : {}),
  };
}

export async function deleteAnnotation(id: string): Promise<void> {
  await getDb().annotations.delete(id);
}
~~~

Map normalizeAnnotation over listAnnotations and listAllAnnotations so old IndexedDB rows and old backups receive defaults.

- [ ] **Step 5: Extend backup validation**

Update validateAnnotation in lib/backup.ts to accept bookmark or highlight, validate the three colors, normalize missing kind/color, retain finite progressPercent, and floor pageNumber to at least one. Keep backup version 2 because the new fields are backward-compatible optional data.

- [ ] **Step 6: Run tests and commit**

~~~powershell
npm.cmd test -- lib/localId.test.ts lib/db.test.ts lib/backup.test.ts
git add lib/localId.ts lib/localId.test.ts lib/db.ts lib/db.test.ts lib/backup.ts lib/backup.test.ts
git commit -m "feat: persist typed reader annotations"
~~~

Expected: focused tests PASS.

## Task 2: Build pure annotation and TXT locator helpers

**Files:**

- Create: lib/readerAnnotations.ts
- Create: lib/readerAnnotations.test.ts
- Create: lib/txtAnnotations.ts
- Create: lib/txtAnnotations.test.ts

- [ ] **Step 1: Write failing shared annotation tests**

Create lib/readerAnnotations.test.ts:

~~~ts
import { expect, it } from "vitest";
import {
  findBookmarkAtSnapshot,
  partitionAnnotations,
  upsertHighlightRecord,
} from "./readerAnnotations";
import type { AnnotationRecord } from "./db";

const records: AnnotationRecord[] = [
  {
    id: "b1",
    bookId: "book",
    kind: "bookmark",
    locator: "cfi-1",
    text: "one",
    createdAt: "1",
  },
  {
    id: "h1",
    bookId: "book",
    kind: "highlight",
    locator: "range-1",
    text: "two",
    color: "yellow",
    createdAt: "2",
  },
];

it("partitions annotation kinds", () => {
  expect(partitionAnnotations(records)).toEqual({
    bookmarks: [records[0]],
    highlights: [records[1]],
  });
});

it("finds the bookmark at the current locator", () => {
  expect(findBookmarkAtSnapshot(records, {
    locator: "cfi-1",
    text: "",
    progressPercent: 0,
  })).toBe(records[0]);
});

it("recolors the same range without duplicating it", () => {
  const result = upsertHighlightRecord(records, {
    ...records[1],
    id: "new",
    color: "blue",
    createdAt: "3",
  });
  expect(result).toHaveLength(2);
  expect(result[1]).toEqual(
    expect.objectContaining({ id: "h1", color: "blue", createdAt: "2" })
  );
});
~~~

- [ ] **Step 2: Write failing TXT locator and run tests**

Create lib/txtAnnotations.test.ts:

~~~ts
import { expect, it } from "vitest";
import {
  buildTxtHighlightRuns,
  parseTxtLocator,
  serializeTxtLocator,
} from "./txtAnnotations";

it("round trips a versioned range locator", () => {
  const locator = {
    version: 1 as const,
    type: "range" as const,
    startParagraph: 2,
    startOffset: 3,
    endParagraph: 3,
    endOffset: 4,
  };
  expect(parseTxtLocator(serializeTxtLocator(locator))).toEqual(locator);
});

it("rejects malformed locators", () => {
  expect(parseTxtLocator("txt:v1:{bad json")).toBeNull();
});

it("splits marked and unmarked text runs", () => {
  const locator = serializeTxtLocator({
    version: 1,
    type: "range",
    startParagraph: 2,
    startOffset: 2,
    endParagraph: 2,
    endOffset: 5,
  });
  expect(buildTxtHighlightRuns(2, "abcdefgh", [{
    id: "h1",
    bookId: "book",
    kind: "highlight",
    locator,
    text: "cde",
    color: "green",
    createdAt: "1",
  }])).toEqual([
    { text: "ab" },
    { text: "cde", annotationId: "h1", color: "green" },
    { text: "fgh" },
  ]);
});
~~~

Add DOM cases that construct two paragraphs with data-paragraph-index, create a Range spanning both, and assert captureTxtSelection returns the correct four offsets. Add navigation cases for vertical scroll, horizontal paged scroll, and progress fallback.

- [ ] **Step 3: Run helper tests and verify failure**

~~~powershell
npm.cmd test -- lib/readerAnnotations.test.ts lib/txtAnnotations.test.ts
~~~

Expected: FAIL because both modules are missing.

- [ ] **Step 4: Implement shared annotation helpers**

Create lib/readerAnnotations.ts:

~~~ts
import type { AnnotationRecord, HighlightColor } from "./db";

export const HIGHLIGHT_COLORS: HighlightColor[] = [
  "yellow",
  "green",
  "blue",
];

export type ReaderLocationSnapshot = {
  locator: string;
  text: string;
  progressPercent: number;
  pageNumber?: number;
};

export type ReaderTextSelection = ReaderLocationSnapshot;

export function partitionAnnotations(records: AnnotationRecord[]) {
  return {
    bookmarks: records.filter((record) => record.kind === "bookmark"),
    highlights: records.filter((record) => record.kind === "highlight"),
  };
}

export function findBookmarkAtSnapshot(
  records: AnnotationRecord[],
  snapshot: ReaderLocationSnapshot | null
): AnnotationRecord | null {
  if (!snapshot) return null;
  return records.find(
    (record) =>
      record.kind === "bookmark" &&
      record.locator === snapshot.locator
  ) ?? null;
}

export function upsertHighlightRecord(
  records: AnnotationRecord[],
  incoming: AnnotationRecord
): AnnotationRecord[] {
  const existing = records.find(
    (record) =>
      record.kind === "highlight" &&
      record.locator === incoming.locator
  );
  if (!existing) return [...records, incoming];
  return records.map((record) =>
    record.id === existing.id
      ? { ...incoming, id: existing.id, createdAt: existing.createdAt }
      : record
  );
}
~~~

- [ ] **Step 5: Implement TXT helpers**

Create lib/txtAnnotations.ts with these public contracts:

~~~ts
export type TxtAnnotationLocator =
  | {
      version: 1;
      type: "point";
      paragraph: number;
      offset: number;
    }
  | {
      version: 1;
      type: "range";
      startParagraph: number;
      startOffset: number;
      endParagraph: number;
      endOffset: number;
    };

export type TxtHighlightRun = {
  text: string;
  annotationId?: string;
  color?: HighlightColor;
};

export function serializeTxtLocator(
  locator: TxtAnnotationLocator
): string {
  return "txt:v1:" + JSON.stringify(locator);
}
~~~

parseTxtLocator must accept only finite non-negative integer offsets. captureTxtSelection(selection, reader, progressPercent, pageNumber) returns ReaderTextSelection or null. captureCurrentTxtLocation(reader, mode, progressPercent, pageNumber) chooses the visible paragraph nearest the leading edge. navigateToTxtLocator uses the paragraph first and existing scrollLeftFromProgress or scrollTopFromProgress only as fallback. buildTxtHighlightRuns clamps offsets and emits ordered, non-overlapping runs across multi-paragraph selections.

- [ ] **Step 6: Run tests and commit**

~~~powershell
npm.cmd test -- lib/readerAnnotations.test.ts lib/txtAnnotations.test.ts
git add lib/readerAnnotations.ts lib/readerAnnotations.test.ts lib/txtAnnotations.ts lib/txtAnnotations.test.ts
git commit -m "feat: add reader annotation locator helpers"
~~~

Expected: helper tests PASS.

## Task 3: Encapsulate book-scoped annotation state

**Files:**

- Create: app/useReaderAnnotations.ts
- Create: lib/readerAnnotationsIntegration.test.ts

- [ ] **Step 1: Write the failing ownership test**

Create lib/readerAnnotationsIntegration.test.ts:

~~~ts
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const hookSource = readFileSync(
  new URL("../app/useReaderAnnotations.ts", import.meta.url),
  "utf8"
);

it("owns annotation persistence behind one hook", () => {
  expect(hookSource).toContain("listAnnotations");
  expect(hookSource).toContain("addAnnotation");
  expect(hookSource).toContain("deleteAnnotation");
  expect(hookSource).toContain("createLocalId");
  expect(hookSource).not.toContain("crypto.randomUUID");
});
~~~

- [ ] **Step 2: Run the test and verify failure**

~~~powershell
npm.cmd test -- lib/readerAnnotationsIntegration.test.ts
~~~

Expected: FAIL because the hook is missing.

- [ ] **Step 3: Implement the hook**

Create app/useReaderAnnotations.ts with this return contract:

~~~ts
export type UseReaderAnnotationsResult = {
  records: AnnotationRecord[];
  bookmarks: AnnotationRecord[];
  highlights: AnnotationRecord[];
  selection: ReaderTextSelection | null;
  setSelection: (selection: ReaderTextSelection | null) => void;
  lastColor: HighlightColor;
  currentBookmark: AnnotationRecord | null;
  setCurrentSnapshot: (
    snapshot: ReaderLocationSnapshot | null
  ) => void;
  toggleBookmark: () => Promise<void>;
  saveHighlight: (color: HighlightColor) => Promise<void>;
  remove: (id: string) => Promise<void>;
  error: string | null;
  status: string | null;
};
~~~

The hook accepts bookId. Guard listAnnotations with a generation counter when books change. Derive partitions with partitionAnnotations. toggleBookmark deletes currentBookmark or writes a new bookmark from currentSnapshot. saveHighlight preserves ID and createdAt when recoloring the same locator, writes with addAnnotation, stores lastColor in localStorage, clears selection, and publishes a concise status. remove deletes first and then updates local state. On mutation failure, reload the book list and publish an error.

- [ ] **Step 4: Run test, lint, and commit**

~~~powershell
npm.cmd test -- lib/readerAnnotationsIntegration.test.ts
npm.cmd run lint -- app/useReaderAnnotations.ts lib/readerAnnotations.ts
git add app/useReaderAnnotations.ts lib/readerAnnotationsIntegration.test.ts
git commit -m "feat: manage reader annotations by book"
~~~

Expected: test and targeted lint PASS.

## Task 4: Add EPUB selections, snapshots, and native highlights

**Files:**

- Modify: app/EpubReader.tsx:54-73,291-301,341-418,817-956
- Create: lib/epubAnnotations.test.ts
- Modify: lib/readerChromeIntegration.test.ts:144-181

- [ ] **Step 1: Write failing EPUB integration tests**

Create lib/epubAnnotations.test.ts and read app/EpubReader.tsx as source. Assert:

~~~ts
expect(epubSource).toContain("ReaderTextSelection");
expect(epubSource).toContain("rendition.annotations.highlight");
expect(epubSource).toContain(
  'rendition.annotations.remove(record.locator, "highlight")'
);
expect(epubSource).toContain("getCurrentSnapshot");
expect(epubSource).toContain("goToAnnotation");
expect(epubSource).toContain("clearNativeSelection");
~~~

Update lib/readerChromeIntegration.test.ts to expect a structured selection callback and null clear.

- [ ] **Step 2: Run tests and verify failure**

~~~powershell
npm.cmd test -- lib/epubAnnotations.test.ts lib/readerChromeIntegration.test.ts
~~~

Expected: FAIL because EPUB callbacks remain text-only.

- [ ] **Step 3: Extend the EPUB contracts**

Change EpubReaderHandle to:

~~~ts
export type EpubReaderHandle = {
  next: () => Promise<void>;
  prev: () => Promise<void>;
  goTo: (href: string) => Promise<void>;
  goToAnnotation: (locator: string) => Promise<void>;
  getCurrentSnapshot: () => ReaderLocationSnapshot | null;
  getVisibleText: () => string;
  clearNativeSelection: () => void;
};
~~~

Accept highlights: AnnotationRecord[] and onTextSelect(selection: ReaderTextSelection | null). Track latest locator, progress, and page. getCurrentSnapshot returns those values and a trimmed visible-text excerpt.

- [ ] **Step 4: Publish CFI range selections**

In handleSelected, require a string cfiRange and publish:

~~~ts
onSelect({
  locator: cfiRange,
  text: trimmedText,
  progressPercent: latestProgressRef.current,
  ...(latestPageNumberRef.current
    ? { pageNumber: latestPageNumberRef.current }
    : {}),
});
~~~

A real reader tap clears the native Range and publishes null.

- [ ] **Step 5: Synchronize rendition highlights**

Use:

~~~ts
const EPUB_HIGHLIGHT_STYLES = {
  yellow: {
    fill: "#ffd84d",
    "fill-opacity": "0.42",
    "mix-blend-mode": "multiply",
  },
  green: {
    fill: "#65d68a",
    "fill-opacity": "0.38",
    "mix-blend-mode": "multiply",
  },
  blue: {
    fill: "#62a8ff",
    "fill-opacity": "0.38",
    "mix-blend-mode": "multiply",
  },
} satisfies Record<
  HighlightColor,
  Record<string, string>
>;
~~~

Keep applied highlight locators in a ref. On changes, remove previous highlight annotations, then call rendition.annotations.highlight for valid current records. This supports recoloring and EPUB.js render-hook reinjection.

- [ ] **Step 6: Run tests and commit**

~~~powershell
npm.cmd test -- lib/epubAnnotations.test.ts lib/readerChromeIntegration.test.ts lib/epubTapInteractions.test.ts
npm.cmd run lint -- app/EpubReader.tsx
git add app/EpubReader.tsx lib/epubAnnotations.test.ts lib/readerChromeIntegration.test.ts
git commit -m "feat: render persistent epub highlights"
~~~

Expected: EPUB integration, tap arbitration, and lint PASS.

## Task 5: Render and navigate TXT annotations

**Files:**

- Modify: app/ReadingSession.tsx:19-46,51-180
- Modify: app/page.tsx:871-873,1160-1172,1554-1574
- Modify: app/page.module.css:2351-2378
- Modify: lib/readerChromeIntegration.test.ts

- [ ] **Step 1: Add failing TXT integration assertions**

Add:

~~~ts
expect(readingSessionSource).toContain("buildTxtHighlightRuns");
expect(readingSessionSource).toContain("data-paragraph-index");
expect(readingSessionSource).toContain("<mark");
expect(pageSource).toContain("captureTxtSelection");
expect(pageSource).toContain("captureCurrentTxtLocation");
expect(pageSource).toContain("navigateToTxtLocator");
~~~

- [ ] **Step 2: Run the test and verify failure**

~~~powershell
npm.cmd test -- lib/readerChromeIntegration.test.ts
~~~

Expected: FAIL because TXT paragraphs are plain strings.

- [ ] **Step 3: Render stable TXT marks**

Add highlights to ReadingSessionProps. Calculate an absolute paragraph index with a cumulative chunk offset, add data-paragraph-index, and render:

~~~tsx
{buildTxtHighlightRuns(
  absoluteIndex,
  paragraph,
  highlights
).map((run, runIndex) =>
  run.annotationId ? (
    <mark
      key={run.annotationId + "-" + runIndex}
      className={styles.txtHighlight}
      data-highlight-color={run.color}
      data-annotation-id={run.annotationId}
    >
      {run.text}
    </mark>
  ) : (
    <span key={"text-" + runIndex}>{run.text}</span>
  )
)}
~~~

CSS uses translucent solid yellow, green, and blue fills, color: inherit, a small inline radius, and box-decoration-break: clone. It must not alter line height.

- [ ] **Step 4: Capture and navigate TXT locations**

Replace text-only handleTextSelect in app/page.tsx with captureTxtSelection. Store the result in the annotation hook and pass selection.text to setSelectedText for Ask AI. Refresh current TXT snapshot on scroll and before bookmark toggles. Navigate TXT annotations through navigateToTxtLocator using current reader mode and reduced-motion preference.

- [ ] **Step 5: Run tests and commit**

~~~powershell
npm.cmd test -- lib/txtAnnotations.test.ts lib/readerChromeIntegration.test.ts lib/txtReader.test.ts
npm.cmd run lint -- app/ReadingSession.tsx app/page.tsx lib/txtAnnotations.ts
git add app/ReadingSession.tsx app/page.tsx app/page.module.css lib/readerChromeIntegration.test.ts
git commit -m "feat: render and locate txt annotations"
~~~

Expected: TXT tests and lint PASS.

## Task 6: Add bookmark and three-color reader actions

**Files:**

- Modify: app/ReaderControls.tsx:80-180
- Modify: app/ReadingSession.tsx
- Modify: app/page.module.css
- Modify: lib/readerMenuIntegration.test.ts:40-120

- [ ] **Step 1: Write failing action tests**

Add assertions:

~~~ts
expect(controlsSource).toContain("onToggleBookmark");
expect(controlsSource).toContain("移除本页书签");
expect(controlsSource).toContain("添加书签");
expect(controlsSource).toContain("HIGHLIGHT_COLORS.map");
expect(controlsSource).toContain("onHighlight(color)");
expect(css).toContain(".readerHighlightPalette");
~~~

Also assert every palette button class has at least a 44 by 44 pixel hit target and reduced-motion overrides.

- [ ] **Step 2: Run the menu test and verify failure**

~~~powershell
npm.cmd test -- lib/readerMenuIntegration.test.ts
~~~

Expected: FAIL because no annotation actions exist.

- [ ] **Step 3: Add control contracts and JSX**

Add props:

~~~ts
selection: ReaderTextSelection | null;
lastHighlightColor: HighlightColor;
currentPageBookmarked: boolean;
onToggleBookmark: () => void;
onHighlight: (color: HighlightColor) => void;
~~~

Add a menu row before Ask AI whose label toggles between 添加书签 and 移除本页书签. When selection.locator exists, render HIGHLIGHT_COLORS as three labelled buttons. Each button directly calls onHighlight(color), uses a visible check for lastHighlightColor, and keeps Ask AI available.

- [ ] **Step 4: Add state motion and reduced-motion fallback**

Reuse existing Motion row variants. Palette selection may scale to at most 1.06. Both app reduced-motion data attributes and prefers-reduced-motion remove transforms and transitions.

- [ ] **Step 5: Run tests and commit**

~~~powershell
npm.cmd test -- lib/readerMenuIntegration.test.ts lib/motionCss.test.ts
npm.cmd run lint -- app/ReaderControls.tsx app/ReadingSession.tsx
git add app/ReaderControls.tsx app/ReadingSession.tsx app/page.module.css lib/readerMenuIntegration.test.ts
git commit -m "feat: add reader bookmark and highlight actions"
~~~

Expected: menu, motion, and lint PASS.

## Task 7: Activate the contents-sheet tabs

**Files:**

- Modify: app/TocDrawer.tsx:13-125
- Modify: app/AppOverlays.tsx:26-75,140-154
- Modify: app/page.module.css:4875-4968
- Create: lib/tocAnnotations.test.ts
- Modify: lib/readerMenuIntegration.test.ts

- [ ] **Step 1: Write failing sheet tests**

Create lib/tocAnnotations.test.ts and assert:

~~~ts
expect(tocSource).toContain(
  'useState<"chapters" | "bookmarks" | "highlights">'
);
expect(tocSource).toContain('role="tab"');
expect(tocSource).toContain("aria-selected");
expect(tocSource).toContain("bookmarks.length");
expect(tocSource).toContain("highlights.length");
expect(tocSource).toContain("onSelectAnnotation");
expect(tocSource).toContain("onDeleteAnnotation");
expect(tocSource).toContain("添加当前页书签");
expect(tocSource).toContain("这本书没有目录信息");
expect(tocSource).toContain("还没有书签");
expect(tocSource).toContain("还没有高亮");
~~~

- [ ] **Step 2: Run tests and verify failure**

~~~powershell
npm.cmd test -- lib/tocAnnotations.test.ts lib/readerMenuIntegration.test.ts
~~~

Expected: FAIL because tabs are static.

- [ ] **Step 3: Add functional tabs and props**

TocDrawer receives bookmarks, highlights, currentPageBookmarked, onToggleBookmark, onSelectAnnotation, and onDeleteAnnotation. Use a typed activeTab state, role tablist, role tab, aria-selected, aria-controls, and one matching tabpanel. Keep incremental rendering only for chapter rows.

- [ ] **Step 4: Render independent jump and delete actions**

Use:

~~~tsx
<li className={styles.annotationRow}>
  <button
    className={styles.annotationJumpButton}
    disabled={!record.locator}
    onClick={() =>
      close(() => onSelectAnnotation(record))
    }
  >
    <span className={styles.annotationExcerpt}>
      {record.text || "书签位置"}
    </span>
    <span className={styles.annotationMeta}>
      {formatAnnotationMeta(record)}
    </span>
  </button>
  <button
    className={styles.annotationDeleteButton}
    onClick={() => onDeleteAnnotation(record.id)}
    aria-label={
      "删除" +
      (record.kind === "bookmark" ? "书签" : "高亮")
    }
  >
    <TrashIcon />
  </button>
</li>
~~~

Bookmark rows show page or progress, excerpt, and date. Highlight rows add a circular color marker, quote, page or progress, and date. Missing locators show 无法定位原文 while deletion remains enabled.

- [ ] **Step 5: Style within the current product system**

Reuse the dark sheet, separators, selected pill, typography, and press tokens. No nested cards, wide shadows, side accent stripes, or gradients. Tab panels crossfade in 150 to 200 milliseconds and become instant in reduced-motion modes.

- [ ] **Step 6: Run tests and commit**

~~~powershell
npm.cmd test -- lib/tocAnnotations.test.ts lib/readerMenuIntegration.test.ts lib/motionCss.test.ts
npm.cmd run lint -- app/TocDrawer.tsx app/AppOverlays.tsx
git add app/TocDrawer.tsx app/AppOverlays.tsx app/page.module.css lib/tocAnnotations.test.ts lib/readerMenuIntegration.test.ts
git commit -m "feat: activate bookmark and highlight tabs"
~~~

Expected: sheet, motion, and lint tests PASS.

## Task 8: Compose cross-format annotation behavior

**Files:**

- Modify: app/page.tsx:1-120,196-240,1160-1172,1316-1320,1580-1630,1844-1905
- Modify: app/AppOverlays.tsx
- Modify: app/ReadingSession.tsx
- Modify: app/ReaderControls.tsx
- Modify: lib/readerAnnotationsIntegration.test.ts
- Modify: lib/surfaceArchitecture.test.ts

- [ ] **Step 1: Add failing orchestration assertions**

Add:

~~~ts
expect(pageSource).toContain("useReaderAnnotations");
expect(pageSource).toContain("annotations.setCurrentSnapshot");
expect(pageSource).toContain("annotations.toggleBookmark");
expect(pageSource).toContain("annotations.saveHighlight");
expect(pageSource).toContain(
  "epubReaderRef.current?.goToAnnotation"
);
expect(pageSource).toContain("navigateToTxtLocator");
expect(overlaysSource).toContain(
  "bookmarks={reader.bookmarks}"
);
expect(overlaysSource).toContain(
  "highlights={reader.highlights}"
);
~~~

- [ ] **Step 2: Run integration tests and verify failure**

~~~powershell
npm.cmd test -- lib/readerAnnotationsIntegration.test.ts lib/surfaceArchitecture.test.ts
~~~

Expected: FAIL on composition while the Home size guard still passes.

- [ ] **Step 3: Compose the hook in Home**

Instantiate useReaderAnnotations with openBook.id. EPUB relocation refreshes getCurrentSnapshot; TXT scroll and bookmark creation refresh captureCurrentTxtLocation. Structured selections update annotations.selection and selectedText. Pass highlights and action props through ReadingSession. Pass bookmark/highlight lists and CRUD/navigation callbacks through AppOverlays into TocDrawer.

- [ ] **Step 4: Implement one navigation dispatcher**

Use:

~~~ts
const handleAnnotationSelect = useCallback(
  async (record: AnnotationRecord) => {
    if (!openBook || !record.locator) return;
    if (openBook.format === "epub") {
      await epubReaderRef.current?.goToAnnotation(
        record.locator
      );
      return;
    }
    const reader = readerRef.current;
    if (!reader) return;
    navigateToTxtLocator(
      reader,
      record.locator,
      readerMode,
      record.progressPercent ?? 0,
      shouldReduceReaderMotion({
        appPreference: appPrefs.reduceMotion,
        systemPreference: window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches,
      })
    );
  },
  [appPrefs.reduceMotion, openBook, readerMode]
);
~~~

Catch display failures and publish 无法定位原文 without crashing the reader.

- [ ] **Step 5: Add one accessible live region**

ReadingSession renders one visually hidden aria-live polite node using annotation status or error. Do not create competing live regions in menu and sheet.

- [ ] **Step 6: Run integration tests and commit**

~~~powershell
npm.cmd test -- lib/readerAnnotationsIntegration.test.ts lib/surfaceArchitecture.test.ts lib/readerChromeIntegration.test.ts lib/readerMenuIntegration.test.ts
npm.cmd run lint -- app/page.tsx app/AppOverlays.tsx app/ReadingSession.tsx app/ReaderControls.tsx
git add app/page.tsx app/AppOverlays.tsx app/ReadingSession.tsx app/ReaderControls.tsx app/page.module.css lib/readerAnnotationsIntegration.test.ts lib/surfaceArchitecture.test.ts
git commit -m "feat: integrate reader annotations end to end"
~~~

Expected: integration tests and lint PASS. If Home would exceed its current line guard, move callbacks into app/useReaderAnnotationNavigation.ts instead of increasing the limit.

## Task 9: Verify persistence and mobile behavior

**Files:**

- Create: e2e/reader-annotations.spec.ts
- Modify: HANDOFF.md

- [ ] **Step 1: Add EPUB and TXT Playwright scenarios**

Use existing import helpers and role or data-attribute locators. Cover:

- EPUB bookmark creation, yellow highlight, reopen, jump, recolor blue, delete.
- TXT multi-paragraph green highlight, bookmark, reopen, jump in paged and scroll modes.
- Empty chapter tab for TXT while bookmark and highlight tabs remain available.
- An init script that makes crypto.randomUUID undefined before import, followed by successful book import and annotation creation.
- No fixed sleeps; wait for visible reader state and IndexedDB-backed UI changes.

The old-Android setup is:

~~~ts
await page.addInitScript(() => {
  Object.defineProperty(
    globalThis.crypto,
    "randomUUID",
    {
      configurable: true,
      value: undefined,
    }
  );
});
~~~

- [ ] **Step 2: Run targeted verification**

~~~powershell
npm.cmd test -- lib/localId.test.ts lib/db.test.ts lib/backup.test.ts lib/readerAnnotations.test.ts lib/txtAnnotations.test.ts lib/epubAnnotations.test.ts lib/readerAnnotationsIntegration.test.ts lib/tocAnnotations.test.ts
npm.cmd run build
npm.cmd run test:e2e -- e2e/reader-annotations.spec.ts
~~~

Expected: targeted tests and mobile scenarios PASS.

- [ ] **Step 3: Run the full verification gate**

~~~powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd run test:e2e
git diff --check
git status -sb
~~~

Expected: full Vitest, lint, build, and Playwright suites PASS; diff check is silent; only intended files are changed.

- [ ] **Step 4: Update handoff and commit evidence**

Record in HANDOFF.md:

- EPUB and TXT behavior.
- Three highlight colors.
- Exact verification commands and passing counts.
- Feature commit hashes.
- Branch divergence and unchanged production status.
- Push and deploy as the next step only if the user requests publication.

Then run:

~~~powershell
git add e2e/reader-annotations.spec.ts HANDOFF.md
git commit -m "test: verify reader annotations"
git status -sb
git log -8 --oneline --decorate
~~~

Expected: clean tree, the branch ahead by the new commits, and no deployment claim.

## Self-review

- Spec coverage: persistence, legacy backups, Android-safe IDs, EPUB CFI, TXT paragraph offsets, three colors, recoloring, bookmark toggling, list navigation, deletion, empty states, unavailable locators, accessibility, reduced motion, persistence, and backup each map to a task.
- Placeholder scan: no deferred implementation markers are present. Code-changing tasks include exact contracts, commands, and expected outcomes.
- Type consistency: AnnotationRecord, ReaderLocationSnapshot, ReaderTextSelection, HighlightColor, the hook result, EpubReaderHandle, and component props keep the same names throughout.

