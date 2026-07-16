# Reader Annotation Tabs Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build fixed-height Chapters, Bookmarks, and Highlights pages that respond to tab taps and native horizontal swipes, targeting 90+ FPS on ProMotion hardware.

**Architecture:** `TocDrawer` uses one native horizontal scroll-snap viewport with three always-mounted panels and independent vertical scrollers. Pure helpers map offsets to tabs, and `MotionSheet` excludes the horizontal viewport from sheet-dismiss gesture capture. Only native scroll and a transform-based active capsule move.

**Tech Stack:** React 19, TypeScript, Motion for React, CSS scroll snap, Vitest, Playwright, Next.js 16, Cloudflare OpenNext.

---

### Task 1: Pure Tab Geometry

**Files:**
- Create: `lib/readerTocTabs.ts`
- Create: `lib/readerTocTabs.test.ts`

- [ ] **Step 1: Write failing tests for stable order, clamped offsets, and nearest pages**

```ts
expect(READER_TOC_TABS).toEqual(["chapters", "bookmarks", "highlights"]);
expect(getReaderTocTabScrollLeft(2, 390)).toBe(780);
expect(getReaderTocTabScrollLeft(8, 390)).toBe(780);
expect(getReaderTocTabScrollLeft(-2, 390)).toBe(0);
expect(getNearestReaderTocTabIndex(210, 390)).toBe(1);
expect(getNearestReaderTocTabIndex(760, 390)).toBe(2);
```

- [ ] **Step 2: Run RED**

Run: `npm.cmd test -- lib/readerTocTabs.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the helpers**

```ts
export const READER_TOC_TABS = ["chapters", "bookmarks", "highlights"] as const;
export type ReaderTocTab = (typeof READER_TOC_TABS)[number];

function clampTabIndex(index: number): number {
  return Math.min(READER_TOC_TABS.length - 1, Math.max(0, Math.round(index)));
}

export function getReaderTocTabScrollLeft(index: number, width: number): number {
  return clampTabIndex(index) * Math.max(0, width);
}

export function getNearestReaderTocTabIndex(scrollLeft: number, width: number): number {
  return width <= 0 ? 0 : clampTabIndex(scrollLeft / width);
}
```

- [ ] **Step 4: Run GREEN and commit**

Run: `npm.cmd test -- lib/readerTocTabs.test.ts`

Expected: all new tests pass.

```powershell
git add lib/readerTocTabs.ts lib/readerTocTabs.test.ts
git commit -m "feat: add reader tab geometry"
```

### Task 2: Horizontal Gesture Ownership

**Files:**
- Modify: `app/MotionSheet.tsx`
- Modify: `lib/navigationGestures.test.ts`

- [ ] **Step 1: Add a failing source integration test**

```ts
expect(motionSheetSource).toContain("[data-sheet-horizontal-gesture='true']");
```

- [ ] **Step 2: Run RED**

Run: `npm.cmd test -- lib/navigationGestures.test.ts`

Expected: FAIL because the exclusion selector is absent.

- [ ] **Step 3: Add the declarative exclusion to `isInteractiveControl`**

Append `[data-sheet-horizontal-gesture='true']` to its existing `closest(...)`
selector. The parent sheet then leaves horizontal and nested vertical scrolling
to the tab viewport; dismissal remains available from the grabber.

- [ ] **Step 4: Run GREEN and commit**

```powershell
npm.cmd test -- lib/navigationGestures.test.ts
git add app/MotionSheet.tsx lib/navigationGestures.test.ts
git commit -m "fix: isolate reader tab swipe gestures"
```

### Task 3: Swipeable Fixed-Height Drawer

**Files:**
- Modify: `app/TocDrawer.tsx`
- Modify: `app/page.module.css`
- Modify: `lib/tocAnnotations.test.ts`

- [ ] **Step 1: Add failing integration assertions**

```ts
expect(tocSource).toContain("READER_TOC_TABS");
expect(tocSource).toContain('data-sheet-horizontal-gesture="true"');
expect(tocSource).toContain('data-toc-swipe-viewport="true"');
expect(tocSource).toContain('layoutId="toc-active-tab-indicator"');
expect(tocSource).toContain("getNearestReaderTocTabIndex");
expect(tocSource).toContain("aria-hidden={activeTab !== tab.id}");
expect(css).toMatch(/\.tocSheet\s*\{[^}]*height:\s*min\(92dvh, 760px\)/s);
expect(css).toContain("scroll-snap-type: x mandatory");
expect(css).toContain("scroll-snap-align: start");
```

- [ ] **Step 2: Run RED**

Run: `npm.cmd test -- lib/tocAnnotations.test.ts`

Expected: FAIL on the missing viewport, indicator, and fixed height.

- [ ] **Step 3: Implement synchronization without per-frame React progress**

Add `viewportRef`, `chapterScrollRootRef`, and one rAF-debounced nearest-page
check. Tab clicks set the active tab and call:

```ts
viewport.scrollTo({
  left: getReaderTocTabScrollLeft(index, viewport.clientWidth),
  behavior: reduceMotion ? "auto" : "smooth",
});
```

On native scroll, call `getNearestReaderTocTabIndex` and update state only if
the nearest tab changed. Cancel the frame on unmount and resnap after resize.

- [ ] **Step 4: Render the moving indicator and all three panels**

```tsx
{activeTab === tab.id && !reduceMotion && (
  <m.span
    layoutId="toc-active-tab-indicator"
    className={styles.tocTabIndicator}
    transition={MOTION_SPRING.navigation}
  />
)}
<span className={styles.tocTabLabel}>{tab.label}</span>
```

Keep all panels mounted inside `data-toc-swipe-viewport`. Each panel keeps its
tab linkage, `aria-hidden`, and `inert`. Move existing chapter and annotation
branches into `renderPanel(tab)`. Use the chapter panel scroller as the existing
`IntersectionObserver` root.

- [ ] **Step 5: Add fixed-height native snap CSS**

```css
.tocSheet {
  height: min(92dvh, 760px);
  max-height: min(92dvh, 760px);
}
.tocSwipeViewport {
  display: flex;
  min-height: 0;
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
}
.tocSwipePanel {
  min-width: 100%;
  min-height: 0;
  flex: 0 0 100%;
  scroll-snap-align: start;
  scroll-snap-stop: always;
}
.tocPanelScroller {
  height: 100%;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
}
```

Add indicator/label layering, hide horizontal scrollbars, remove the old panel
entrance keyframes, and retain a static active fill for reduced motion. Do not
add permanent `will-change` or animate layout properties.

- [ ] **Step 6: Verify and commit**

```powershell
npm.cmd test -- lib/readerTocTabs.test.ts lib/tocAnnotations.test.ts lib/navigationGestures.test.ts lib/readerMenuIntegration.test.ts
npm.cmd run lint -- app/TocDrawer.tsx app/MotionSheet.tsx lib/readerTocTabs.ts lib/readerTocTabs.test.ts lib/tocAnnotations.test.ts lib/navigationGestures.test.ts
git add app/TocDrawer.tsx app/page.module.css lib/tocAnnotations.test.ts
git commit -m "feat: add swipeable annotation tabs"
```

### Task 4: Mobile Swipe and Height Coverage

**Files:**
- Modify: `e2e/reader-annotations.spec.ts`

- [ ] **Step 1: Add failing browser coverage**

Record the motion-panel height, click Bookmarks, and assert the height remains
equal. Drag the horizontal viewport with `page.mouse.down/move/up`, assert the
next tab is selected, then switch rapidly and assert the last tab and snapped
offset agree.

```ts
const sheet = page.locator('[data-sheet-route="toc"] [data-motion-sheet="panel"]');
const height = await sheet.evaluate((el) => el.getBoundingClientRect().height);
await page.locator("#toc-tab-bookmarks").click();
expect(await sheet.evaluate((el) => el.getBoundingClientRect().height)).toBe(height);
await expect(page.locator("#toc-tab-bookmarks")).toHaveAttribute("aria-selected", "true");
```

- [ ] **Step 2: Run RED**

Run: `npm.cmd run test:e2e -- e2e/reader-annotations.spec.ts --project=iphone-14`

Expected: FAIL because the swipe viewport does not exist.

- [ ] **Step 3: Verify both mobile projects after implementation**

```powershell
npm.cmd run test:e2e -- e2e/reader-annotations.spec.ts --project=iphone-14
npm.cmd run test:e2e -- e2e/reader-annotations.spec.ts --project=iphone-15-pro-max
```

Keep native scrolling if synchronization needs adjustment; use `scrollend` when
available plus the nearest-page rAF fallback, not a JavaScript drag loop.

- [ ] **Step 4: Commit**

```powershell
git add e2e/reader-annotations.spec.ts
git commit -m "test: cover reader tab swipe motion"
```

### Task 5: Full Verification and Deployment

**Files:**
- Modify: `HANDOFF.md`

- [ ] **Step 1: Run the full gate**

Run `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`,
`npm.cmd run test:e2e`, `git diff --check`, and `git status -sb`.

Expected: zero failures and only intentional handoff edits uncommitted.

- [ ] **Step 2: Update and commit the handoff**

Record native snap architecture, stable height, reduced motion, test counts,
the physical ProMotion 90+ FPS acceptance target, GitHub credential status, and
deployment version.

```powershell
git add HANDOFF.md
git commit -m "docs: hand off reader tab motion"
```

- [ ] **Step 3: Build and deploy through the documented Windows path**

Resolve `C:\aaa\ai-reader-pwa`; verify `.next` and `.open-next` are allowlisted
direct children before removing only those generated directories. Then run the
standalone build, OpenNext `build --skipNextBuild`, and OpenNext `deploy`.

- [ ] **Step 4: Verify production and push if authenticated**

Verify root, JS/CSS, `/sw.js`, `/BUILD_ID`, manifest, Asset Links, and APK return
200. Confirm assets contain the swipe viewport, scroll-snap, indicator, and
`ai-reader-v6`; run production iPhone 14 annotation E2E. Run `gh auth status`:
push only if valid, otherwise keep the clean local branch ahead and report the
exact unpushed commits without altering credentials or remotes.
