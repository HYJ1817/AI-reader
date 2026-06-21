# Navigation Motion And Reader Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify primary-tab motion, simplify reader chrome into progressive floating tools, and add per-book scroll/paginated reading modes for TXT and EPUB without breaking existing positions or backups.

**Architecture:** Add small pure helpers for navigation state, mode sanitization, TXT pagination math, and epub.js rendition options. Keep the current IndexedDB stores and make `readingMode` an optional field on existing reading-position records. Refactor only the visible tab surfaces and reader controls needed by the feature; keep `Home` as the orchestration owner.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS Modules, Dexie, epub.js, Vitest.

---

### Task 1: Navigation State And Shared Indicator

**Files:**
- Create: `lib/navigationMotion.ts`
- Create: `lib/navigationMotion.test.ts`
- Modify: `app/page.tsx`
- Modify: `app/page.module.css`
- Modify: `lib/motionCss.test.ts`
- Modify: `lib/persistentSurfaces.test.ts`

- [ ] **Step 1: Write failing navigation helper tests**

Test fixed tab ordering, active index, and before/active/after surface states:

```ts
expect(getNavigationTabIndex("library")).toBe(0);
expect(getNavigationTabIndex("reading")).toBe(1);
expect(getNavigationTabIndex("settings")).toBe(2);
expect(getNavigationSurfaceState("library", "reading")).toBe("before");
expect(getNavigationSurfaceState("reading", "reading")).toBe("active");
expect(getNavigationSurfaceState("settings", "reading")).toBe("after");
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm.cmd run test -- lib/navigationMotion.test.ts
```

Expected: FAIL because `lib/navigationMotion.ts` does not exist.

- [ ] **Step 3: Implement the pure navigation helpers**

Create:

```ts
export const NAVIGATION_TABS = ["library", "reading", "settings"] as const;
export type NavigationTab = (typeof NAVIGATION_TABS)[number];
export type NavigationSurfaceState = "before" | "active" | "after";

export function getNavigationTabIndex(tab: NavigationTab): number {
  return NAVIGATION_TABS.indexOf(tab);
}

export function getNavigationSurfaceState(
  tab: NavigationTab,
  activeTab: NavigationTab
): NavigationSurfaceState {
  const difference = getNavigationTabIndex(tab) - getNavigationTabIndex(activeTab);
  if (difference === 0) return "active";
  return difference < 0 ? "before" : "after";
}
```

- [ ] **Step 4: Keep all three primary surfaces mounted**

Replace library `display` switching and conditional Reading/Settings mounts with three absolute surface containers. Give each container a state class from `getNavigationSurfaceState`. Each surface owns vertical scrolling; the root `.content` no longer scrolls.

- [ ] **Step 5: Add one shared tab indicator**

Add a non-interactive indicator inside `.tabBar`:

```tsx
<span
  className={styles.tabIndicator}
  style={{ "--tab-index": getNavigationTabIndex(activeTab) } as React.CSSProperties}
  aria-hidden="true"
/>
```

Remove selected backgrounds and shadows from `.activeTab`; keep only active icon/text styling.

- [ ] **Step 6: Add CSS regression tests and verify GREEN**

Update CSS/source tests to require:

- no `.tabPageInactive { display: none; }`;
- no mount-only `.pageFade`;
- all three primary surfaces present without conditional root mounts;
- tab indicator uses `translate3d`;
- surface travel is at most 8 px.

Run:

```powershell
npm.cmd run test -- lib/navigationMotion.test.ts lib/motionCss.test.ts lib/persistentSurfaces.test.ts
```

Expected: PASS.

### Task 2: Reading Mode Data Compatibility

**Files:**
- Create: `lib/readerMode.ts`
- Create: `lib/readerMode.test.ts`
- Modify: `lib/db.ts`
- Modify: `lib/backup.test.ts`

- [ ] **Step 1: Write failing mode sanitation tests**

```ts
expect(sanitizeReaderMode("scroll")).toBe("scroll");
expect(sanitizeReaderMode("paged")).toBe("paged");
expect(sanitizeReaderMode(undefined)).toBe("scroll");
expect(sanitizeReaderMode("invalid")).toBe("scroll");
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
npm.cmd run test -- lib/readerMode.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement mode type and sanitation**

```ts
export type ReaderMode = "scroll" | "paged";
export const DEFAULT_READER_MODE: ReaderMode = "scroll";

export function sanitizeReaderMode(value: unknown): ReaderMode {
  return value === "paged" ? "paged" : "scroll";
}
```

Add `readingMode?: ReaderMode` to `ReadingPosition`. Do not change Dexie schema versions or store keys.

- [ ] **Step 4: Test backup compatibility**

Add tests proving version 1 backups without `readingMode` still validate and that structured reading-position objects with `readingMode: "paged"` round-trip without API keys.

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
npm.cmd run test -- lib/readerMode.test.ts lib/backup.test.ts
```

Expected: PASS.

### Task 3: TXT Pagination Math

**Files:**
- Modify: `lib/txtReader.ts`
- Modify: `lib/txtReader.test.ts`

- [ ] **Step 1: Write failing tests for horizontal progress and pages**

Cover:

```ts
expect(progressFromHorizontalScroll(450, 900, 450)).toBe(100);
expect(scrollLeftFromProgress(50, 1350, 450)).toBe(450);
expect(getHorizontalPageInfo(450, 1350, 450)).toEqual({ current: 2, total: 3 });
expect(getHorizontalPageInfo(0, 300, 450)).toEqual({ current: 1, total: 1 });
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
npm.cmd run test -- lib/txtReader.test.ts
```

Expected: FAIL because the pagination helpers are missing.

- [ ] **Step 3: Implement bounded horizontal helpers**

Use normalized scrollable distance for progress mapping and rounded viewport offsets for page information. Treat invalid or non-positive viewport widths as page 1 of 1.

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
npm.cmd run test -- lib/txtReader.test.ts
```

Expected: PASS.

### Task 4: EPUB Rendition Modes

**Files:**
- Create: `lib/epubReaderMode.ts`
- Create: `lib/epubReaderMode.test.ts`
- Modify: `app/EpubReader.tsx`
- Modify: `types/epubjs.d.ts`

- [ ] **Step 1: Write failing rendition-option tests**

```ts
expect(getEpubRenditionOptions("scroll")).toMatchObject({
  flow: "scrolled",
  manager: "continuous",
  overflow: "auto",
});
expect(getEpubRenditionOptions("paged")).toMatchObject({
  flow: "paginated",
  manager: "default",
  overflow: "hidden",
});
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
npm.cmd run test -- lib/epubReaderMode.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement rendition options**

Return a fresh object with `width`, `height`, and `spread: "none"` shared across both modes.

- [ ] **Step 4: Pass mode through `EpubReader`**

Add `mode: ReaderMode`. Include it in the rendition lifecycle dependency so mode changes destroy and recreate only the rendition/book rendering lifecycle. Preserve the most recent CFI in a ref, display that locator after recreation, then apply preferences.

Every relocated position includes `readingMode: mode`. Guard async initialization with the existing cancelled flag so stale mode creation cannot win.

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
npm.cmd run test -- lib/epubReaderMode.test.ts lib/epubProgress.test.ts lib/epubNavigation.test.ts
```

Expected: PASS.

### Task 5: Progressive Floating Reader Tools

**Files:**
- Modify: `app/ReaderControls.tsx`
- Modify: `app/page.module.css`
- Modify: `lib/motionCss.test.ts`

- [ ] **Step 1: Write failing source/CSS expectations**

Require:

- no `readerTopHint`, `readerPageBadge`, `readerActionPanel`, or `readerGoalMini` markup;
- an unframed back button;
- five floating tool items;
- stagger delays of 0, 35, 70, 105, and 140 ms;
- no shared panel background;
- reduced motion removes stagger.

- [ ] **Step 2: Verify RED**

Run:

```powershell
npm.cmd run test -- lib/motionCss.test.ts
```

Expected: FAIL against the current controls.

- [ ] **Step 3: Implement reader controls**

Replace the current panel with:

- unframed back chevron;
- compact menu button;
- five floating buttons for Contents, Appearance, Reading mode, Ask AI, and Reading goal;
- adjacent `滚动/分页` submenu with `aria-pressed`.

Add `readerMode` and `onReaderModeChange` props. Close menus when chrome hides or a tool action runs.

- [ ] **Step 4: Implement confirmed motion**

Use opacity plus no more than 8 px translation. Open with 35 ms stagger; close faster and in reverse visual order. Preserve 44 px hit areas. Under reduced motion, remove travel and delays.

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
npm.cmd run test -- lib/motionCss.test.ts lib/readerChromeIntegration.test.ts
```

Expected: PASS.

### Task 6: Wire Per-Book Modes Into TXT And EPUB

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/page.module.css`
- Modify: `app/EpubReader.tsx`
- Modify: `lib/readerChromeIntegration.test.ts`

- [ ] **Step 1: Add failing integration/source tests**

Require:

- opening a missing mode defaults to scroll;
- mode changes save a reading position for the open book;
- TXT paged mode uses horizontal overflow and CSS columns;
- paged mode disables paragraph `content-visibility`;
- EPUB receives the current mode;
- later progress saves preserve the selected mode.

- [ ] **Step 2: Verify RED**

Run:

```powershell
npm.cmd run test -- lib/readerChromeIntegration.test.ts lib/persistentSurfaces.test.ts
```

Expected: FAIL until the page orchestration is updated.

- [ ] **Step 3: Load and persist per-book mode**

On book open, sanitize `savedPosition?.readingMode`. Store the current open-book mode in state. On mode change:

1. capture normalized progress;
2. update state;
3. save the current locator/progress plus mode;
4. clear temporary selection;
5. close the mode submenu through `ReaderControls`.

- [ ] **Step 4: Implement TXT paged rendering**

Use the existing text content in a paginated class with:

- `column-width` equal to the measured viewport;
- fixed reader height;
- horizontal scrolling only;
- disabled paragraph content visibility;
- page turns through `scrollLeft`;
- progress restoration on mode, preference, and viewport changes.

Scroll mode keeps existing vertical behavior.

- [ ] **Step 5: Route page-turn behavior by mode**

For TXT:

- scroll mode keeps 0.85-screen vertical stepping;
- paged mode moves one horizontal viewport.

For EPUB, continue using rendition `prev()` and `next()` in both modes.

- [ ] **Step 6: Verify GREEN**

Run:

```powershell
npm.cmd run test -- lib/readerChromeIntegration.test.ts lib/persistentSurfaces.test.ts lib/txtReader.test.ts lib/readerMode.test.ts
```

Expected: PASS.

### Task 7: Full Verification And Phone Preview

**Files:**
- Modify only if verification exposes a defect.

- [ ] **Step 1: Run all automated checks**

```powershell
npm.cmd run test
npm.cmd run lint
npm.cmd run build
npm.cmd audit --json
git diff --check
```

Expected: all commands exit 0 and audit reports zero vulnerabilities.

- [ ] **Step 2: Start production preview**

```powershell
npm.cmd run start -- --hostname 127.0.0.1 --port 3031
```

- [ ] **Step 3: Browser verification at 390 by 844**

Verify:

- all three tabs transition without blank frames;
- one indicator moves between tabs;
- empty Library, Reading, and Settings remain usable;
- reader chrome matches the approved no-frame mockup;
- reduced motion removes tab travel and tool stagger.

- [ ] **Step 4: Real-content acceptance**

Import one TXT and one EPUB locally. Verify scroll and paginated modes, reopening, progress restoration, selection, AI action availability, and repeated taps.

- [ ] **Step 5: Review final diff**

Confirm no IndexedDB version bump, no backup version bump, no API-key export, no full-book AI payload, and no unrelated `.impeccable` files in the implementation commit.
