# Surface Architecture and Visual System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the oversized application page into focused presentational surfaces, unify component-facing visual tokens, flatten the reading dashboard, and replace generic fallback book tiles with typographic paper covers.

**Architecture:** `Home` remains the stateful orchestration boundary and passes derived values plus callbacks into four client components. The extraction is behavior-preserving: storage, reader lifecycle, AI, gestures, and persistence stay in `app/page.tsx`; visual changes are applied only after structural tests prove the extracted boundaries.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS Modules, Dexie, Vitest, ESLint.

---

## File Map

**Create**

- `app/LibrarySurface.tsx`: library and collections presentation.
- `app/ReadingDashboard.tsx`: reading summary, continue-reading row, seven-day activity.
- `app/SettingsSurface.tsx`: application, AI, backup, reading, and privacy settings presentation.
- `app/AppOverlays.tsx`: non-reader overlay and sheet presentation.
- `lib/bookCoverStyle.ts`: deterministic fallback-cover style model.
- `lib/bookCoverStyle.test.ts`: fallback-cover style behavior.
- `lib/surfaceArchitecture.test.ts`: structural extraction guards.
- `lib/semanticTokens.test.ts`: theme/token and content-surface guards.
- `lib/readingDashboardCss.test.ts`: unframed dashboard style guards.

**Modify**

- `app/page.tsx`: replace inline surfaces and overlays with component calls.
- `app/BookCover.tsx`: render real covers or typographic fallback covers.
- `app/globals.css`: define semantic tokens and compatibility aliases for every theme.
- `app/page.module.css`: migrate surface styles, flatten dashboard, style fallback covers.
- `lib/persistentSurfaces.test.ts`: recognize extracted persistent surfaces.
- `lib/motionCss.test.ts`: retain navigation and reader motion guards after extraction.

## Task 1: Add Structural Extraction Guards

**Files:**

- Create: `lib/surfaceArchitecture.test.ts`
- Modify: `lib/persistentSurfaces.test.ts`

- [ ] **Step 1: Write the failing structural test**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8"
);

describe("surface architecture", () => {
  it("renders focused application surfaces from Home", () => {
    for (const component of [
      "LibrarySurface",
      "ReadingDashboard",
      "SettingsSurface",
      "AppOverlays",
    ]) {
      expect(pageSource).toContain(`<${component}`);
    }
  });

  it("keeps large surface markup out of the orchestration page", () => {
    expect(pageSource).not.toContain('className={styles.collectionList}');
    expect(pageSource).not.toContain('className={styles.readingGoalCard}');
    expect(pageSource).not.toContain('className={styles.settingsNativeList}');
    expect(pageSource).not.toContain('className={styles.bookActionHero}');
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm.cmd run test -- lib/surfaceArchitecture.test.ts
```

Expected: FAIL because the four surface components do not exist in `page.tsx`.

- [ ] **Step 3: Update the persistent-surface test expectation**

Replace direct inline reading/settings markup expectations with component usage:

```ts
expect(pageSource).toContain("<LibrarySurface");
expect(pageSource).toContain("<ReadingDashboard");
expect(pageSource).toContain("<SettingsSurface");
expect(pageSource).not.toContain('activeTab === "reading" && !openBook');
expect(pageSource).not.toContain('activeTab === "settings" &&');
```

- [ ] **Step 4: Run both tests and keep them RED for the missing components**

Run:

```powershell
npm.cmd run test -- lib/surfaceArchitecture.test.ts lib/persistentSurfaces.test.ts
```

Expected: FAIL only on missing extracted-component assertions.

- [ ] **Step 5: Commit the red tests**

```powershell
git add lib/surfaceArchitecture.test.ts lib/persistentSurfaces.test.ts
git commit -m "test: define application surface boundaries"
```

## Task 2: Extract the Reading Dashboard

**Files:**

- Create: `app/ReadingDashboard.tsx`
- Modify: `app/page.tsx`
- Test: `lib/surfaceArchitecture.test.ts`

- [ ] **Step 1: Create the dashboard prop contract**

```ts
"use client";

import type { CSSProperties } from "react";
import type { BookRecord } from "@/lib/db";

export type ReadingInsight = {
  date: string;
  label: string;
  minutes: number;
  progress: number;
  isToday: boolean;
};

export type ReadingDashboardProps = {
  className: string;
  ariaHidden: boolean;
  todayMinutes: number;
  targetMinutes: number;
  goalRingBackground: CSSProperties["background"];
  totalMinutes: number;
  insights: ReadingInsight[];
  latestBook: BookRecord | null;
  latestBookProgress: number;
  onOpenGoal: () => void;
  onOpenBook: (book: BookRecord) => void;
  onImport: () => void;
};
```

- [ ] **Step 2: Move the complete reading-dashboard JSX**

Move `app/page.tsx:2157-2245` into `ReadingDashboard`. Change only the
identifier mapping below:

```ts
const identifierMapping = {
  handleOpenGoalSheet: onOpenGoal,
  todayMinutesValue: todayMinutes,
  readingGoalTargetMinutes: targetMinutes,
  weeklyReadingInsights: insights,
  totalMinutesValue: totalMinutes,
  openBookForReading: onOpenBook,
  importFromFileInput: onImport,
};
```

The root wrapper becomes:

```tsx
<div className={className} aria-hidden={ariaHidden}>
```

The goal ring keeps:

```tsx
style={{ background: goalRingBackground }}
```

Use `formatBookSize`, `formatLibraryProgressLabel`, and `BookCover` from their
existing modules. Export formatting helpers from `lib/libraryPresentation.ts`
only if importing from `page.tsx` would create a cycle.

- [ ] **Step 3: Replace inline markup in Home**

```tsx
<ReadingDashboard
  className={`${styles.readingDashboard} ${getNavigationSurfaceClass("reading")}`}
  ariaHidden={activeTab !== "reading" || Boolean(openBook)}
  todayMinutes={todayMinutesValue}
  targetMinutes={readingGoal.targetMinutes}
  goalRingBackground={goalRingBackground}
  totalMinutes={totalMinutesValue}
  insights={weeklyReadingInsights}
  latestBook={latestBook ?? null}
  latestBookProgress={latestBookProgress}
  onOpenGoal={handleOpenGoalSheet}
  onOpenBook={(book) => void openBookForReading(book)}
  onImport={() => fileInputRef.current?.click()}
/>
```

- [ ] **Step 4: Run structural and focused dashboard tests**

```powershell
npm.cmd run test -- lib/surfaceArchitecture.test.ts lib/persistentSurfaces.test.ts lib/readingInsights.test.ts
```

Expected: dashboard-related structural assertions PASS; remaining surface assertions still FAIL.

- [ ] **Step 5: Commit**

```powershell
git add app/ReadingDashboard.tsx app/page.tsx
git commit -m "refactor: extract reading dashboard"
```

## Task 3: Extract SettingsSurface

**Files:**

- Create: `app/SettingsSurface.tsx`
- Modify: `app/page.tsx`
- Test: `lib/surfaceArchitecture.test.ts`

- [ ] **Step 1: Define a narrow settings contract**

```ts
import type { AppPreferences } from "@/lib/appPreferences";

export type SettingsSurfaceProps = {
  className: string;
  ariaHidden: boolean;
  appPreferences: AppPreferences;
  activeProviderLabel: string | null;
  readerThemeLabel: string;
  todayMinutes: number;
  targetMinutes: number;
  backupStatus: string | null;
  backupError: string | null;
  backupInputRef: React.RefObject<HTMLInputElement | null>;
  onPreferencesChange: (next: Partial<AppPreferences>) => void;
  onOpenAiSettings: () => void;
  onExportBackup: () => void;
  onImportBackup: React.ChangeEventHandler<HTMLInputElement>;
  onOpenReaderSettings: () => void;
  onOpenGoal: () => void;
};
```

- [ ] **Step 2: Move the existing settings sections without behavior edits**

Move `app/page.tsx:2246-2407` into `SettingsSurface`. The root wrapper becomes:

```tsx
<div className={className} aria-hidden={ariaHidden}>
```

Map all state-changing controls through the prop contract:

```ts
const settingsCallbacks = {
  autoOpenLastBook: (checked: boolean) =>
    onPreferencesChange({ autoOpenLastBook: checked }),
  keepScreenAwake: (checked: boolean) =>
    onPreferencesChange({ keepScreenAwake: checked }),
  reduceMotion: (checked: boolean) =>
    onPreferencesChange({ reduceMotion: checked }),
  swipeToTurn: (checked: boolean) =>
    onPreferencesChange({ swipeToTurn: checked }),
};
```

Use `activeProviderLabel` directly:

```tsx
<small>{activeProviderLabel ?? "未配置"}</small>
```

- [ ] **Step 3: Replace settings markup in Home**

```tsx
<SettingsSurface
  className={`${styles.settingsPage} ${getNavigationSurfaceClass("settings")}`}
  ariaHidden={activeTab !== "settings"}
  appPreferences={appPrefs}
  activeProviderLabel={
    activeAiProvider
      ? `${activeAiProvider.label} · ${activeAiProvider.model}`
      : null
  }
  readerThemeLabel={readerThemeLabel}
  todayMinutes={todayMinutesValue}
  targetMinutes={readingGoal.targetMinutes}
  backupStatus={backupStatus}
  backupError={backupError}
  backupInputRef={backupInputRef}
  onPreferencesChange={handleAppPreferencesChange}
  onOpenAiSettings={() => setAiSettingsSheetOpen(true)}
  onExportBackup={handleExportBackup}
  onImportBackup={handleImportBackup}
  onOpenReaderSettings={() => setReaderSettingsOpen(true)}
  onOpenGoal={handleOpenGoalSheet}
/>
```

- [ ] **Step 4: Run focused tests**

```powershell
npm.cmd run test -- lib/surfaceArchitecture.test.ts lib/appPreferences.test.ts
```

Expected: settings extraction assertions PASS; library/overlay assertions remain RED.

- [ ] **Step 5: Commit**

```powershell
git add app/SettingsSurface.tsx app/page.tsx
git commit -m "refactor: extract settings surface"
```

## Task 4: Extract LibrarySurface

**Files:**

- Create: `app/LibrarySurface.tsx`
- Create: `lib/libraryPresentation.ts`
- Create: `lib/libraryPresentation.test.ts`
- Modify: `app/page.tsx`
- Test: `lib/surfaceArchitecture.test.ts`

- [ ] **Step 1: Write failing presentation-helper tests**

```ts
import { describe, expect, it } from "vitest";
import {
  formatBookDate,
  formatBookSize,
} from "./libraryPresentation";

describe("library presentation", () => {
  it("formats bytes for compact book metadata", () => {
    expect(formatBookSize(1024)).toBe("1 KB");
    expect(formatBookSize(1572864)).toBe("1.5 MB");
  });

  it("uses stable labels for missing and invalid dates", () => {
    expect(formatBookDate()).toBe("从未");
    expect(formatBookDate("invalid")).toBe("未知");
  });
});
```

- [ ] **Step 2: Run helper tests and verify RED**

```powershell
npm.cmd run test -- lib/libraryPresentation.test.ts
```

Expected: FAIL because `libraryPresentation.ts` does not exist.

- [ ] **Step 3: Move formatting helpers into the focused module**

```ts
export function formatBookSize(size: number): string {
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

export function formatBookDate(value?: string): string {
  if (!value) return "从未";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知";
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
```

- [ ] **Step 4: Define the LibrarySurface contract**

Group props by responsibility to keep call sites readable:

```ts
export type LibrarySurfaceProps = {
  className: string;
  ariaHidden: boolean;
  data: {
    books: BookRecord[];
    visibleBooks: BookRecord[];
    filteredBookCount: number;
    groups: BookGroup[];
    collectionItems: CollectionListItem[];
    progressMap: ReadingProgressMap;
    loading: boolean;
    importError: string | null;
  };
  view: {
    screen: "library" | "collections";
    searchQuery: string;
    mode: LibraryViewMode;
    activeCollectionName: string;
    groupFilter: string | null;
    visibleBookCount: number;
  };
  editing: {
    library: boolean;
    collections: boolean;
    selectedBookIds: string[];
    selectedCountLabel: string;
    allVisibleSelected: boolean;
    editingGroupId: string | null;
    editingGroupName: string;
  };
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  actions: LibrarySurfaceActions;
};
```

`LibrarySurfaceActions` contains the event boundaries:

```ts
export type LibrarySurfaceActions = {
  importBooks: () => void;
  setScreen: (screen: "library" | "collections") => void;
  setSearchQuery: (query: string) => void;
  setViewMode: (mode: LibraryViewMode) => void;
  setGroupFilter: (filter: string | null) => void;
  enterEditing: () => void;
  exitEditing: () => void;
  toggleCollectionsEditing: () => void;
  selectAllVisible: () => void;
  openBook: (book: BookRecord) => void;
  openBookActions: (book: BookRecord) => void;
  setEditingGroup: (id: string | null, name: string) => void;
  setEditingGroupName: (name: string) => void;
  renameGroup: (id: string) => void;
  deleteGroup: (id: string) => void;
  openCreateCollection: () => void;
};
```

- [ ] **Step 5: Move the full library and collections JSX**

Move `app/page.tsx:1646-2074` into `LibrarySurface`. Replace direct setter calls
with `actions` and preserve the following rendering invariants:

```ts
const renderingInvariants = {
  realAndFallbackCovers: true,
  progressInGridAndList: true,
  multiGroupLabels: true,
  selectionBadges: true,
  incrementalLoadSentinel: true,
  collectionRenameOnEnter: true,
};
```

- [ ] **Step 6: Replace the library markup in Home**

Pass current derived values and existing handlers. Do not create new state in
`LibrarySurface`; all state updates flow through `actions`.

- [ ] **Step 7: Run focused tests**

```powershell
npm.cmd run test -- lib/libraryPresentation.test.ts lib/surfaceArchitecture.test.ts lib/libraryFilters.test.ts lib/collectionList.test.ts lib/persistentSurfaces.test.ts
```

Expected: all listed tests PASS except the final overlay extraction assertion.

- [ ] **Step 8: Commit**

```powershell
git add app/LibrarySurface.tsx app/page.tsx lib/libraryPresentation.ts lib/libraryPresentation.test.ts
git commit -m "refactor: extract library surface"
```

## Task 5: Extract AppOverlays

**Files:**

- Create: `app/AppOverlays.tsx`
- Modify: `app/page.tsx`
- Test: `lib/surfaceArchitecture.test.ts`

- [ ] **Step 1: Define grouped overlay props**

```ts
export type AppOverlaysProps = {
  reader: {
    preferencesOpen: boolean;
    preferences: ReaderPreferences;
    tocOpen: boolean;
    tocItems: EpubTocItem[];
    askOpen: boolean;
    selectedText: string | null;
    question: string;
    answer: string | null;
    askLoading: boolean;
    askError: string | null;
    aiUsable: boolean;
    bookTitle: string | null;
    goalOpen: boolean;
    todayMinutes: number;
    targetMinutes: number;
    goalInputValue: number;
  };
  ai: {
    settingsOpen: boolean;
    settings: AiProviderSettings;
  };
  library: {
    groups: BookGroup[];
    selectedBookIds: string[];
    selectedCountLabel: string;
    newGroupName: string;
    editingGroupId: string | null;
    editingGroupName: string;
    batchGroupOpen: boolean;
    batchDeleteOpen: boolean;
    createCollectionOpen: boolean;
    actionBook: BookRecord | null;
    actionBookProgress: number;
    deleteConfirmOpen: boolean;
    groupSheetOpen: boolean;
    groupSheetBook: BookRecord | null;
  };
  actions: AppOverlayActions;
};
```

Define `AppOverlayActions` with the callbacks used by `app/page.tsx:2491-3024`:

```ts
export type AppOverlayActions = {
  closeReaderSettings: () => void;
  changeReaderPreferences: (next: ReaderPreferences) => void;
  closeToc: () => void;
  selectTocItem: (href: string) => void;
  closeAiSettings: () => void;
  saveAiSettings: (next: AiProviderSettings) => void;
  closeAsk: () => void;
  setQuestion: (question: string) => void;
  ask: () => void;
  clearSelection: () => void;
  openAiSettingsFromAsk: (close: (after?: () => void) => void) => void;
  closeGoal: () => void;
  setGoalInputValue: (value: number) => void;
  saveGoal: () => void;
  closeBatchGroup: () => void;
  addSelectedBooksToGroup: (groupId: string) => void;
  createBatchGroup: () => void;
  closeBatchDelete: () => void;
  deleteSelectedBooks: () => void;
  closeCreateCollection: () => void;
  createCollection: () => void;
  closeBookActions: () => void;
  openBook: (book: BookRecord) => void;
  openGroupSheet: (book: BookRecord) => void;
  exportBook: (book: BookRecord) => void;
  setDeleteConfirmOpen: (open: boolean) => void;
  deleteBook: (book: BookRecord) => void;
  closeGroupSheet: () => void;
  toggleBookGroup: (groupId: string) => void;
  setEditingGroup: (groupId: string | null, name: string) => void;
  setEditingGroupName: (name: string) => void;
  renameGroup: (groupId: string) => void;
  deleteGroup: (groupId: string) => void;
  setNewGroupName: (name: string) => void;
  createGroup: () => void;
};
```

No business logic moves into the component. Sheet close callbacks continue to
use the `BottomSheet` completion function before mutating state or opening
another surface.

- [ ] **Step 2: Move overlay JSX from Home**

Move `app/page.tsx:2491-3024`, containing:

- `ReaderSettingsPanel`
- `TocDrawer`
- `AiSettingsSheet`
- AI question sheet
- `ReadingGoalSheet`
- batch group and batch delete sheets
- collection creation sheet
- book action sheet
- group membership sheet

Keep the bottom tab bar and library batch bar in `Home`; they are application
navigation, not overlays.

- [ ] **Step 3: Render AppOverlays once**

```tsx
<AppOverlays
  reader={readerOverlayState}
  ai={aiOverlayState}
  library={libraryOverlayState}
  actions={overlayActions}
/>
```

Memoize the three grouped state objects and `overlayActions` only if React or
lint identifies unstable dependencies as a measurable problem. Do not add
memoization preemptively.

- [ ] **Step 4: Run structural and overlay regressions**

```powershell
npm.cmd run test -- lib/surfaceArchitecture.test.ts lib/readerChromeIntegration.test.ts lib/backup.test.ts lib/aiProviders.test.ts
```

Expected: PASS.

- [ ] **Step 5: Confirm page-size target**

```powershell
(Get-Content app\page.tsx).Count
```

Expected: between 1,600 and 1,900 lines. If above 1,900, inspect for duplicated
markup before extracting more behavior.

- [ ] **Step 6: Commit**

```powershell
git add app/AppOverlays.tsx app/page.tsx lib/surfaceArchitecture.test.ts lib/persistentSurfaces.test.ts
git commit -m "refactor: extract application overlays"
```

## Task 6: Introduce Semantic Tokens

**Files:**

- Create: `lib/semanticTokens.test.ts`
- Modify: `app/globals.css`
- Modify: `app/page.module.css`

- [ ] **Step 1: Write failing token tests**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const globals = readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8"
);
const moduleCss = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);

const semanticTokens = [
  "--app-bg",
  "--surface-primary",
  "--surface-secondary",
  "--text-primary",
  "--text-secondary",
  "--text-tertiary",
  "--separator",
  "--tint",
  "--control-fill",
  "--overlay-fill",
  "--sheet-fill",
];

describe("semantic visual tokens", () => {
  it("defines the full token set for root and reader themes", () => {
    for (const token of semanticTokens) {
      expect(globals.match(new RegExp(`${token}:`, "g"))?.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("keeps ordinary reading dashboard styles free of liquid glass", () => {
    for (const selector of [
      ".readingGoalCard",
      ".featureBookCard",
      ".readingWeekCard",
    ]) {
      const start = moduleCss.indexOf(`${selector} {`);
      const end = moduleCss.indexOf("}", start);
      expect(moduleCss.slice(start, end)).not.toContain("liquid-glass");
      expect(moduleCss.slice(start, end)).not.toContain("backdrop-filter");
    }
  });
});
```

- [ ] **Step 2: Run and verify RED**

```powershell
npm.cmd run test -- lib/semanticTokens.test.ts
```

Expected: FAIL because semantic tokens are not yet defined in all themes.

- [ ] **Step 3: Define semantic tokens in root**

```css
:root {
  --app-bg: #f5f5f7;
  --surface-primary: #ffffff;
  --surface-secondary: rgba(118, 118, 128, 0.14);
  --text-primary: #050505;
  --text-secondary: #6e6e73;
  --text-tertiary: #9a9aa0;
  --separator: rgba(60, 60, 67, 0.18);
  --tint: #007aff;
  --control-fill: rgba(118, 118, 128, 0.14);
  --overlay-fill: rgba(255, 255, 255, 0.78);
  --sheet-fill: rgba(255, 255, 255, 0.96);
}
```

Define corresponding values in system dark, light, sepia, and explicit dark.
Then map compatibility aliases:

```css
--ios-bg: var(--app-bg);
--ios-bg-elevated: var(--surface-primary);
--ios-text: var(--text-primary);
--ios-secondary: var(--text-secondary);
--ios-tertiary: var(--text-tertiary);
--ios-separator: var(--separator);
--ios-tint: var(--tint);
--ios-pill: var(--control-fill);
--ios-sheet-bg: var(--sheet-fill);
```

- [ ] **Step 4: Migrate ordinary content rules**

Replace direct generic/`--ios-*` usage in extracted surface rules with semantic
tokens. Leave reader controls, tab bar, and sheets on overlay/liquid-glass
tokens.

- [ ] **Step 5: Run token and motion tests**

```powershell
npm.cmd run test -- lib/semanticTokens.test.ts lib/motionCss.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add app/globals.css app/page.module.css lib/semanticTokens.test.ts
git commit -m "refactor: unify semantic visual tokens"
```

## Task 7: Redesign Fallback Book Covers

**Files:**

- Create: `lib/bookCoverStyle.ts`
- Create: `lib/bookCoverStyle.test.ts`
- Modify: `app/BookCover.tsx`
- Modify: `app/page.module.css`

- [ ] **Step 1: Write failing cover-style tests**

```ts
import { describe, expect, it } from "vitest";
import {
  createFallbackCoverStyle,
  normalizeCoverTitle,
} from "./bookCoverStyle";

describe("fallback cover style", () => {
  it("returns a stable paper and spine combination", () => {
    const first = createFallbackCoverStyle("百年孤独", "epub");
    const second = createFallbackCoverStyle("百年孤独", "epub");
    expect(first).toEqual(second);
    expect(first.paper).toMatch(/^#[0-9a-f]{6}$/i);
    expect(first.spine).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("normalizes whitespace without losing the title", () => {
    expect(normalizeCoverTitle("  很长的   书名  ")).toBe("很长的 书名");
    expect(normalizeCoverTitle("")).toBe("未命名");
  });
});
```

- [ ] **Step 2: Run and verify RED**

```powershell
npm.cmd run test -- lib/bookCoverStyle.test.ts
```

Expected: FAIL because `bookCoverStyle.ts` does not exist.

- [ ] **Step 3: Implement deterministic cover styles**

```ts
const PAPER_COLORS = [
  "#f1eee7",
  "#e9edf0",
  "#eee9e3",
  "#e8ece7",
  "#ece8ed",
];

const SPINE_COLORS = [
  "#385f71",
  "#715244",
  "#516a55",
  "#66547a",
  "#7a4f5b",
];

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export function normalizeCoverTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ") || "未命名";
}

export function createFallbackCoverStyle(title: string, format: string) {
  const hash = hashString(`${title}:${format}`);
  return {
    paper: PAPER_COLORS[hash % PAPER_COLORS.length],
    spine: SPINE_COLORS[hash % SPINE_COLORS.length],
  };
}
```

- [ ] **Step 4: Render the typographic fallback**

```tsx
const fallbackStyle = createFallbackCoverStyle(title, format);
const normalizedTitle = normalizeCoverTitle(title);

<div
  ref={coverRef}
  className={`${styles.bookCover} ${coverUrl ? styles.bookCoverReal : styles.bookCoverFallback}`}
  style={
    {
      "--cover-paper": fallbackStyle.paper,
      "--cover-spine": fallbackStyle.spine,
    } as React.CSSProperties
  }
>
  {coverUrl ? (
    <span
      className={styles.bookCoverImage}
      style={{ backgroundImage: `url(${coverUrl})` }}
      aria-hidden="true"
    />
  ) : (
    <>
      <span className={styles.bookCoverSpine} aria-hidden="true" />
      <span className={styles.bookCoverTitle}>{normalizedTitle}</span>
      <span className={styles.bookCoverFormat}>{format.toUpperCase()}</span>
    </>
  )}
</div>
```

- [ ] **Step 5: Add constrained cover styles**

```css
.bookCoverFallback {
  position: relative;
  overflow: hidden;
  padding: 14% 10% 12% 18%;
  background: var(--cover-paper);
  border: 0.5px solid color-mix(in srgb, var(--text-primary) 18%, transparent);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
}

.bookCoverSpine {
  position: absolute;
  inset: 0 auto 0 0;
  width: 10%;
  background: var(--cover-spine);
}

.bookCoverTitle {
  display: -webkit-box;
  overflow: hidden;
  color: #252525;
  font-size: clamp(10px, 0.9em, 15px);
  font-weight: 700;
  line-height: 1.28;
  text-align: left;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.bookCoverFormat {
  position: absolute;
  right: 10%;
  bottom: 9%;
  color: var(--cover-spine);
  font-size: 8px;
  font-weight: 800;
}
```

Do not use viewport-based font sizing. If `clamp()` is unsuitable under the
project rule, replace it with fixed size plus container-specific overrides.

- [ ] **Step 6: Run cover tests and existing cover regressions**

```powershell
npm.cmd run test -- lib/bookCoverStyle.test.ts lib/bookCoverLoading.test.ts lib/blobUrlCache.test.ts lib/bookCoverBackfill.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add app/BookCover.tsx app/page.module.css lib/bookCoverStyle.ts lib/bookCoverStyle.test.ts
git commit -m "feat: add typographic fallback covers"
```

## Task 8: Flatten the Reading Dashboard

**Files:**

- Create: `lib/readingDashboardCss.test.ts`
- Modify: `app/ReadingDashboard.tsx`
- Modify: `app/page.module.css`

- [ ] **Step 1: Write failing dashboard CSS tests**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);

function rule(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  const end = css.indexOf("}", start);
  return css.slice(start, end);
}

describe("reading dashboard composition", () => {
  it("uses unframed content sections", () => {
    for (const selector of [
      ".readingGoalCard",
      ".featureBookCard",
      ".readingWeekCard",
    ]) {
      expect(rule(selector)).not.toContain("linear-gradient");
      expect(rule(selector)).not.toContain("box-shadow");
      expect(rule(selector)).not.toContain("border-radius: 20px");
    }
  });

  it("keeps section separation through spacing or hairlines", () => {
    expect(css).toContain(".readingDashboardSection");
    expect(css).toContain("var(--separator)");
  });
});
```

- [ ] **Step 2: Run and verify RED**

```powershell
npm.cmd run test -- lib/readingDashboardCss.test.ts
```

Expected: FAIL because the existing dashboard uses gradient/card styling.

- [ ] **Step 3: Add a shared unframed section class**

Update the three existing wrappers in `ReadingDashboard`:

```tsx
<section className={styles.readingDashboardSection}>
  <button className={styles.readingGoalCard} onClick={onOpenGoal}>
    {goalSummary}
  </button>
</section>

<section className={styles.readingDashboardSection}>
  <div className={styles.sectionHeader}>
    <h2>{UI_TEXT.CONTINUE_READING}</h2>
  </div>
  {continueReadingContent}
</section>

<section className={styles.readingDashboardSection}>
  <div className={styles.sectionHeader}>
    <h2>{UI_TEXT.LAST_SEVEN_DAYS}</h2>
    <span>{totalReadingLabel}</span>
  </div>
  {weekBars}
</section>
```

Here `goalSummary`, `continueReadingContent`, `totalReadingLabel`, and
`weekBars` are the JSX expressions moved unchanged in Task 2; they are local
expressions, not new components or props.

- [ ] **Step 4: Replace card treatment**

```css
.readingDashboardSection {
  padding: 18px 0;
  border-bottom: 0.5px solid var(--separator);
}

.readingDashboardSection:last-child {
  border-bottom: 0;
}

.readingGoalCard,
.featureBookCard,
.readingWeekCard {
  width: 100%;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}
```

Preserve tap feedback with opacity or a restrained background on active state.
Do not add new containers around the sections.

- [ ] **Step 5: Run dashboard and motion tests**

```powershell
npm.cmd run test -- lib/readingDashboardCss.test.ts lib/semanticTokens.test.ts lib/motionCss.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add app/ReadingDashboard.tsx app/page.module.css lib/readingDashboardCss.test.ts
git commit -m "style: flatten reading dashboard"
```

## Task 9: Full Verification and Visual Acceptance

**Files:**

- Modify only files required by failures found during verification.

- [ ] **Step 1: Run the full automated suite**

```powershell
npm.cmd run test
npm.cmd run lint
npm.cmd run build
npm.cmd audit --json
git diff --check
```

Expected:

- All Vitest files PASS.
- ESLint exits 0 with no warnings.
- Next.js production build succeeds.
- Audit reports zero vulnerabilities.
- No whitespace errors.

- [ ] **Step 2: Start the development server**

```powershell
npm.cmd run dev
```

Expected: local URL is printed and the server remains running.

- [ ] **Step 3: Verify desktop**

Check:

- Library list and grid.
- Collections navigation and editing.
- Reading dashboard hierarchy.
- Settings controls.
- Book action and group sheets.
- Real and fallback covers.

- [ ] **Step 4: Verify 390 x 844 mobile**

Check:

- No title or button overflow.
- Fallback titles remain within three lines.
- Bottom navigation does not overlap content.
- Reading dashboard is visibly section-based rather than card-based.
- Light, dark, and sepia themes retain readable contrast.
- Reader controls and paged/scroll modes still work.

- [ ] **Step 5: Confirm architecture target**

```powershell
(Get-Content app\page.tsx).Count
git status --short
```

Expected:

- `app/page.tsx` is 1,600-1,900 lines.
- Only intended files are modified.

- [ ] **Step 6: Commit verification fixes**

```powershell
git add app lib
git commit -m "fix: finish surface visual regression checks"
```

Skip this commit if verification requires no code changes.
