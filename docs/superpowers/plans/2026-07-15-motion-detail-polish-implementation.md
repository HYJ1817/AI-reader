# Motion Detail Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the five motion-detail friction points identified in the approved critique while preserving AI Reader's quiet native product vocabulary and reduced-motion behavior.

**Architecture:** `MotionSheet` becomes the single modal accessibility owner; shared duration roles live in `motionSystem.ts`; pure helpers own reader-control discovery persistence and swipe-settle timing. The existing reader, Library, navigation, and Motion components consume those contracts without new dependencies or navigation state.

**Tech Stack:** TypeScript, React 19, Next.js 16 App Router, Motion for React, CSS Modules, Vitest, Playwright, localStorage, IndexedDB/Dexie.

---

## File Map

- Modify `app/MotionSheet.tsx`: focus capture, initial focus, Tab containment, app-shell sibling inert ownership, and focus restoration.
- Modify `app/ReadingGoalSheet.tsx`: provide the close button through `initialFocusRef` and remove the duplicate modal focus implementation.
- Modify `app/SharedBookTransition.tsx`: consume explicit enter/exit timing so exit has no inherited delay.
- Modify `app/ReaderControls.tsx`: use shared chrome duration roles.
- Modify `app/page.tsx`: initialize/persist first-use control discovery and consume shared swipe timing.
- Modify `app/EpubReader.tsx`: consume shared swipe timing.
- Modify `app/NavigationStack.tsx`: consume the gesture-settle role.
- Modify `app/page.module.css`: align duration variables and animate Library progress width.
- Modify `lib/motionSystem.ts`: add the complete duration role table and reader transition timing builder.
- Modify `lib/readerChromeState.ts`: keep first-use controls visible until the first explicit toggle.
- Create `lib/readerControlDiscovery.ts`: resilient localStorage access.
- Modify `lib/readerSwipe.ts`: add the pure settle-duration owner.
- Modify focused Vitest contracts and `e2e/native-navigation.spec.ts` before their corresponding production changes.
- Modify `HANDOFF.md` only after the final local verification gate.

### Task 1: Centralize modal focus and background isolation

**Files:**
- Modify: `lib/overlayMotionIntegration.test.ts`
- Modify: `lib/readingGoalOverlayIntegration.test.ts`
- Modify: `app/MotionSheet.tsx`
- Modify: `app/ReadingGoalSheet.tsx`

- [ ] **Step 1: Write failing shared-focus contracts**

Add these expectations to `overlayMotionIntegration.test.ts`:

```ts
expect(motionSheetSource).toContain("FOCUSABLE_SELECTOR");
expect(motionSheetSource).toContain("previousFocusRef");
expect(motionSheetSource).toContain("backgroundSiblingsRef");
expect(motionSheetSource).toContain('[data-app-shell="true"]');
expect(motionSheetSource).toContain("initialFocusRef?.current");
expect(motionSheetSource).toContain('event.key !== "Tab"');
expect(motionSheetSource).toContain("tabIndex={-1}");
expect(motionSheetSource).toContain("sibling.inert = true");
expect(motionSheetSource).toContain("previousFocusRef.current?.isConnected");
```

Replace the Reading Goal one-off focus assertions with:

```ts
expect(goalSource).toContain("initialFocusRef={closeButtonRef}");
expect(goalSource).not.toContain("previousFocusRef");
expect(goalSource).not.toContain("querySelectorAll<HTMLElement>");
expect(goalSource).not.toContain("document.addEventListener");
```

- [ ] **Step 2: Run the contracts and verify RED**

```powershell
npm.cmd test -- lib/overlayMotionIntegration.test.ts lib/readingGoalOverlayIntegration.test.ts
```

Expected: FAIL because `MotionSheet` does not yet own focus/inert behavior and Reading Goal still owns a private trap.

- [ ] **Step 3: Implement the shared focus lifecycle**

Extend `MotionSheetProps` with:

```ts
initialFocusRef?: RefObject<HTMLElement | null>;
```

Add one focusable selector covering enabled buttons, links, inputs, textareas, selects, contenteditable elements, and non-negative tabindex elements. On mount:

```ts
previousFocusRef.current =
  document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

const overlay = panelRef.current?.closest<HTMLElement>(
  '[data-sheet-route]'
);
const appShell = overlay?.closest<HTMLElement>('[data-app-shell="true"]');
backgroundSiblingsRef.current = appShell
  ? Array.from(appShell.children)
      .filter((child): child is HTMLElement =>
        child instanceof HTMLElement && child !== overlay
      )
      .map((sibling) => ({ sibling, wasInert: sibling.inert }))
  : [];
for (const { sibling } of backgroundSiblingsRef.current) {
  sibling.inert = true;
}

const target =
  initialFocusRef?.current ??
  panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
  panelRef.current;
target?.focus({ preventScroll: true });
```

On cleanup restore every recorded `wasInert` value, then restore the connected opener. Extend the existing keydown handler so Escape closes and Tab/Shift+Tab wrap between the first and last focusable descendants. Add `tabIndex={-1}` to the dialog panel.

- [ ] **Step 4: Remove the Reading Goal duplicate trap**

Keep `closeButtonRef`, pass it as `initialFocusRef`, and remove `dialogRef`, `previousFocusRef`, `FOCUSABLE_SELECTOR`, and the focus/Tab `useEffect`. Keep the existing `closeGoal` draft reset and its Escape handling only if needed for that local reset; it must not own focus containment or restoration.

- [ ] **Step 5: Run focused modal tests and verify GREEN**

```powershell
npm.cmd test -- lib/overlayMotionIntegration.test.ts lib/readingGoalOverlayIntegration.test.ts lib/motionCss.test.ts lib/navigationGestures.test.ts
```

Expected: all focused modal and gesture tests pass.

- [ ] **Step 6: Commit the shared modal contract**

```powershell
git add -- app/MotionSheet.tsx app/ReadingGoalSheet.tsx lib/overlayMotionIntegration.test.ts lib/readingGoalOverlayIntegration.test.ts
git commit -m "fix: centralize sheet focus ownership"
```

### Task 2: Make reader close fast and progress return continuous

**Files:**
- Modify: `lib/motionSystem.test.ts`
- Create: `lib/readerTransitionMotion.test.ts`
- Modify: `lib/libraryFeaturedReadingIntegration.test.ts`
- Modify: `lib/motionSystem.ts`
- Modify: `app/SharedBookTransition.tsx`
- Modify: `app/page.module.css`

- [ ] **Step 1: Write failing reader timing tests**

Add to `motionSystem.test.ts`:

```ts
expect(MOTION_DURATION.readerEnter).toBe(0.3);
expect(MOTION_DURATION.readerExit).toBe(0.22);
expect(getReaderTransitionTiming(false)).toEqual({
  contentEnter: { duration: 0.2, delay: 0.072 },
  contentExit: { duration: 0.22, delay: 0 },
  coverEnterOpacity: { duration: 0.2, delay: 0.126 },
  coverExitOpacity: { duration: 0.22, delay: 0 },
});
```

Create `readerTransitionMotion.test.ts` to read `SharedBookTransition.tsx` and assert:

```ts
expect(source).toContain("getReaderTransitionTiming");
expect(source).toContain("transition: timing.contentExit");
expect(source).toContain("transition: timing.coverExitOpacity");
expect(source).not.toMatch(/exit[\s\S]{0,240}readerEnter \* 0\.24/);
```

Extend the Library integration test:

```ts
expect(rule(".libraryFeaturedProgress > span > span")).toContain(
  "width var(--motion-standard) var(--ease-standard)"
);
expect(rule(".bookListProgressTrack span")).toContain(
  "width var(--motion-standard) var(--ease-standard)"
);
```

- [ ] **Step 2: Run the timing tests and verify RED**

```powershell
npm.cmd test -- lib/motionSystem.test.ts lib/readerTransitionMotion.test.ts lib/libraryFeaturedReadingIntegration.test.ts
```

Expected: FAIL on the old 460/340ms reader roles, inherited exit delay, and missing progress-width transition.

- [ ] **Step 3: Add explicit reader transition timing**

Set `readerEnter: 0.3` and `readerExit: 0.22`. Export:

```ts
export function getReaderTransitionTiming(reduceMotion: boolean) {
  const reduced = { duration: MOTION_DURATION.reduced, delay: 0 };
  if (reduceMotion) {
    return {
      contentEnter: reduced,
      contentExit: reduced,
      coverEnterOpacity: reduced,
      coverExitOpacity: reduced,
    };
  }
  return {
    contentEnter: {
      duration: MOTION_DURATION.state,
      delay: MOTION_DURATION.readerEnter * 0.24,
    },
    contentExit: { duration: MOTION_DURATION.readerExit, delay: 0 },
    coverEnterOpacity: {
      duration: MOTION_DURATION.state,
      delay: MOTION_DURATION.readerEnter * 0.42,
    },
    coverExitOpacity: { duration: MOTION_DURATION.readerExit, delay: 0 },
  };
}
```

Use the returned entrance transitions for normal `transition` values and put the exit transitions directly inside the `exit` targets so Motion cannot reuse an entrance delay during close.

- [ ] **Step 4: Animate Library progress width**

Add to both progress fill rules:

```css
transition: width var(--motion-standard) var(--ease-standard);
```

The existing app-level and OS reduced-motion rules reduce this transition to the established near-instant duration.

- [ ] **Step 5: Run focused reader/Library tests and verify GREEN**

```powershell
npm.cmd test -- lib/motionSystem.test.ts lib/readerTransitionMotion.test.ts lib/libraryFeaturedReadingIntegration.test.ts lib/sharedBookTransition.test.ts lib/libraryMotionIntegration.test.ts
```

Expected: all focused transition and Library tests pass.

- [ ] **Step 6: Commit the reader-return loop**

```powershell
git add -- lib/motionSystem.ts lib/motionSystem.test.ts lib/readerTransitionMotion.test.ts app/SharedBookTransition.tsx app/page.module.css lib/libraryFeaturedReadingIntegration.test.ts
git commit -m "feat: tighten reader return motion"
```

### Task 3: Keep first-use reader controls discoverable

**Files:**
- Create: `lib/readerControlDiscovery.ts`
- Create: `lib/readerControlDiscovery.test.ts`
- Modify: `lib/readerChromeState.ts`
- Modify: `lib/readerChromeState.test.ts`
- Create: `lib/readerControlDiscoveryIntegration.test.ts`
- Modify: `app/page.tsx`

- [ ] **Step 1: Write failing storage and reducer tests**

Create storage tests proving that an empty store requires discovery, a stored `true` value skips it, marking writes `true`, and throwing storage methods degrade to `false` without throwing.

Extend the reducer tests with:

```ts
const pending = reduceReaderChromeState(createReaderChromeState(false), {
  type: "require-discovery",
});
expect(pending).toMatchObject({ visible: true, discoveryPending: true });
expect(
  reduceReaderChromeState(pending, { type: "scroll", at: 500 })
).toBe(pending);
expect(reduceReaderChromeState(pending, { type: "hide" })).toBe(pending);
expect(
  reduceReaderChromeState(pending, { type: "tap", at: 600 })
).toMatchObject({ visible: false, discoveryPending: false });
```

Create a page source contract asserting `shouldDiscoverReaderControls`, `markReaderControlsDiscovered`, the mount effect, `readerChromeState.discoveryPending`, and `onReaderTap={toggleReaderChrome}`.

- [ ] **Step 2: Run discovery tests and verify RED**

```powershell
npm.cmd test -- lib/readerControlDiscovery.test.ts lib/readerChromeState.test.ts lib/readerControlDiscoveryIntegration.test.ts
```

Expected: FAIL because the persistence module, reducer event, and page integration do not exist.

- [ ] **Step 3: Implement resilient persistence**

Create `readerControlDiscovery.ts` with key `ai-reader-reader-controls-discovered-v1` and these APIs:

```ts
export type ReaderControlDiscoveryStorage = Pick<
  Storage,
  "getItem" | "setItem"
>;

export function shouldDiscoverReaderControls(
  storage: ReaderControlDiscoveryStorage | undefined =
    typeof window === "undefined" ? undefined : window.localStorage
): boolean;

export function markReaderControlsDiscovered(
  storage: ReaderControlDiscoveryStorage | undefined =
    typeof window === "undefined" ? undefined : window.localStorage
): void;
```

Both functions catch storage exceptions. Missing or throwing storage returns `false` from the query.

- [ ] **Step 4: Extend the reader chrome state machine**

Add `discoveryPending: boolean` to state and a `require-discovery` event. That event sets `visible` and `discoveryPending` true. While pending, `scroll` and `hide` return the current object. The first `tap` performs the normal toggle and clears `discoveryPending`.

- [ ] **Step 5: Integrate discovery into the page**

On mount, dispatch `require-discovery` only when the storage query returns true. In `toggleReaderChrome`, mark discovery before dispatching the first pending tap. Pass that callback to `ReadingSession` instead of an inline tap dispatch. Automatic scroll and page-turn events remain unchanged because the reducer now guards them.

- [ ] **Step 6: Run focused discovery and reader tests**

```powershell
npm.cmd test -- lib/readerControlDiscovery.test.ts lib/readerChromeState.test.ts lib/readerControlDiscoveryIntegration.test.ts lib/readerChromeIntegration.test.ts lib/readerMenuIntegration.test.ts
```

Expected: all first-use, existing chrome, and menu contracts pass.

- [ ] **Step 7: Commit first-use discovery**

```powershell
git add -- lib/readerControlDiscovery.ts lib/readerControlDiscovery.test.ts lib/readerChromeState.ts lib/readerChromeState.test.ts lib/readerControlDiscoveryIntegration.test.ts app/page.tsx
git commit -m "feat: keep first reader controls discoverable"
```

### Task 4: Give timing roles and swipe settle one owner

**Files:**
- Modify: `lib/motionSystem.ts`
- Modify: `lib/motionSystem.test.ts`
- Create: `lib/motionRoleParity.test.ts`
- Modify: `lib/readerSwipe.ts`
- Modify: `lib/readerSwipe.test.ts`
- Create: `lib/readerSwipeOwnership.test.ts`
- Modify: `app/ReaderControls.tsx`
- Modify: `app/NavigationStack.tsx`
- Modify: `app/page.tsx`
- Modify: `app/EpubReader.tsx`
- Modify: `app/page.module.css`

- [ ] **Step 1: Write failing role, parity, and ownership tests**

Lock these roles in `motionSystem.test.ts`:

```ts
expect(MOTION_DURATION).toMatchObject({
  press: 0.12,
  state: 0.2,
  pushEnter: 0.34,
  pushExit: 0.24,
  readerEnter: 0.3,
  readerExit: 0.22,
  sheetEnter: 0.3,
  sheetExit: 0.25,
  chromeEnter: 0.2,
  chromeExit: 0.16,
  gestureSettle: 0.22,
  reduced: 0.12,
});
```

Create a CSS parity test that extracts the variables and compares them with `MOTION_DURATION * 1000`:

```ts
expect(cssDuration("--motion-fast")).toBe(MOTION_DURATION.press * 1000);
expect(cssDuration("--motion-standard")).toBe(MOTION_DURATION.state * 1000);
expect(cssDuration("--motion-navigation")).toBe(MOTION_DURATION.pushEnter * 1000);
expect(cssDuration("--motion-sheet")).toBe(MOTION_DURATION.sheetEnter * 1000);
expect(cssDuration("--motion-sheet-settle")).toBe(MOTION_DURATION.gestureSettle * 1000);
expect(cssDuration("--motion-sheet-exit")).toBe(MOTION_DURATION.sheetExit * 1000);
expect(cssDuration("--motion-chrome-enter")).toBe(MOTION_DURATION.chromeEnter * 1000);
expect(cssDuration("--motion-chrome-exit")).toBe(MOTION_DURATION.chromeExit * 1000);
```

Add swipe helper tests:

```ts
expect(getReaderSwipeSettleDuration("next", false)).toBe(160);
expect(getReaderSwipeSettleDuration("prev", false)).toBe(160);
expect(getReaderSwipeSettleDuration("none", false)).toBe(180);
expect(getReaderSwipeSettleDuration("next", true)).toBe(0);
```

Create an ownership source test asserting both `page.tsx` and `EpubReader.tsx` import/use the helper and neither contains `action === "none" ? 180 : 160`.

- [ ] **Step 2: Run the timing ownership tests and verify RED**

```powershell
npm.cmd test -- lib/motionSystem.test.ts lib/motionRoleParity.test.ts lib/readerSwipe.test.ts lib/readerSwipeOwnership.test.ts
```

Expected: FAIL on missing roles, mismatched CSS values, and duplicated swipe literals.

- [ ] **Step 3: Complete the shared duration roles**

Add `chromeEnter`, `chromeExit`, and `gestureSettle`; align push and sheet roles to the values above. Replace ReaderControls 0.20/0.16 literals with chrome roles and NavigationStack 0.22 literals with `gestureSettle`.

Align the CSS role variables to 120, 200, 340, 300, 220, 250, 200, and 160ms respectively. Do not change easing curves.

- [ ] **Step 4: Centralize swipe settle duration**

Export from `readerSwipe.ts`:

```ts
export function getReaderSwipeSettleDuration(
  action: ReaderSwipeAction,
  reducedMotion: boolean
): number {
  if (reducedMotion) return 0;
  return action === "none" ? 180 : 160;
}
```

Use it in both `page.tsx` and `EpubReader.tsx` and retain the existing timeout buffer and transition-end completion path.

- [ ] **Step 5: Run all timing, swipe, navigation, and reader contracts**

```powershell
npm.cmd test -- lib/motionSystem.test.ts lib/motionRoleParity.test.ts lib/readerSwipe.test.ts lib/readerSwipeOwnership.test.ts lib/navigationMotion.test.ts lib/navigationGestures.test.ts lib/readerMenuIntegration.test.ts lib/readerChromeIntegration.test.ts lib/epubTapInteractions.test.ts
```

Expected: all focused timing and interaction tests pass.

- [ ] **Step 6: Commit timing ownership**

```powershell
git add -- lib/motionSystem.ts lib/motionSystem.test.ts lib/motionRoleParity.test.ts lib/readerSwipe.ts lib/readerSwipe.test.ts lib/readerSwipeOwnership.test.ts app/ReaderControls.tsx app/NavigationStack.tsx app/page.tsx app/EpubReader.tsx app/page.module.css
git commit -m "refactor: unify motion timing ownership"
```

### Task 5: Verify the behavior in both iPhone browser projects

**Files:**
- Modify: `e2e/native-navigation.spec.ts`

- [ ] **Step 1: Make the reader-close helper discovery-safe**

Read `aria-expanded` from `[data-reader-menu-toggle="true"]`; click the toggle only when it is `false`, then click the visible close button. This preserves existing close coverage for both fresh and returning sessions.

- [ ] **Step 2: Add modal focus/isolation and first-use cases**

For each injected sheet, assert the active element is contained by the panel and every app-shell sibling outside the active sheet host is inert. Press Tab and Shift+Tab on a sheet with multiple controls and assert focus remains inside.

Add a fresh-reader case asserting the toggle starts expanded, scrolling does not collapse it before discovery, the first explicit tap collapses it, and a reload retains returning-user auto-hide behavior.

- [ ] **Step 3: Run focused browser cases on iPhone 14**

Start Next on port 3065 after confirming that no process is listening there, then run:

```powershell
$env:PLAYWRIGHT_BASE_URL='http://localhost:3065'
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-14 --grep "sheet routes|first reader controls|reader closes"
```

Expected: modal focus/isolation, discovery persistence, and reader close/focus return pass.

- [ ] **Step 4: Run the complete native-navigation suite on both phones**

```powershell
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-14
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-15-pro-max
Remove-Item Env:PLAYWRIGHT_BASE_URL
```

Expected: all native-navigation cases pass on both configured projects with no console failures.

- [ ] **Step 5: Commit browser coverage**

```powershell
git add -- e2e/native-navigation.spec.ts
git commit -m "test: verify motion detail polish"
```

### Task 6: Run the completion gate and refresh the handoff

**Files:**
- Modify: `HANDOFF.md`

- [ ] **Step 1: Run focused Vitest from a fresh command**

```powershell
npm.cmd test -- lib/overlayMotionIntegration.test.ts lib/readingGoalOverlayIntegration.test.ts lib/motionSystem.test.ts lib/readerTransitionMotion.test.ts lib/libraryFeaturedReadingIntegration.test.ts lib/readerControlDiscovery.test.ts lib/readerChromeState.test.ts lib/readerControlDiscoveryIntegration.test.ts lib/motionRoleParity.test.ts lib/readerSwipe.test.ts lib/readerSwipeOwnership.test.ts
```

Expected: all focused files pass with zero failures.

- [ ] **Step 2: Run the full local gate**

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
node C:\aaa\.agents\skills\impeccable\scripts\detect.mjs --json app lib
git diff --check
```

Expected: full Vitest, ESLint, webpack build, detector, and whitespace checks complete without blocking findings.

- [ ] **Step 3: Review the requirements against the diff**

Confirm the diff contains all five approved fixes, no new dependency, no persistence migration, no page-load choreography, no unrelated redesign, and no changes to the unresolved EPUB dark-canvas path.

- [ ] **Step 4: Update and commit `HANDOFF.md`**

Record design/plan paths, implementation commits, exact focused/full test counts, ESLint/build results, both iPhone Playwright counts, detector result, and physical iPhone Safari/VoiceOver as the remaining non-blocking risk. Record that production still serves the prior Worker version until deployment is separately authorized.

```powershell
git add -- HANDOFF.md
git commit -m "docs: complete motion detail polish"
```

- [ ] **Step 5: Report the local branch state**

```powershell
git status -sb
git log -8 --oneline --decorate
```

Expected: the feature branch contains the documented local commits; no reset, clean, deployment, push, or unrelated file mutation was performed.
