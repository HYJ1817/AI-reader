# PWA Interaction Fluidity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every page, reader, popup, Workspace, and AI state transition feel immediate and continuous in the iPhone 15 Pro Max home-screen PWA while preserving existing product and data behavior.

**Architecture:** Keep the existing navigation reducer, Motion root, reader presentation, and local-first state. Extend the central motion contract, add a lifecycle epoch for suspension and viewport invalidation, render one persistent outer sheet around an internal page stack, and isolate Workspace viewport following from streaming and persistence. Every phase is test-first, independently committable, and reversible without storage migration.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Motion 12, CSS Modules, Dexie/IndexedDB, Vitest 4, Playwright 1.61, iPhone Safari/PWA.

---

## Governing Specification

Implement against `docs/superpowers/specs/2026-07-28-pwa-interaction-fluidity-design.md` at commit `e12fc66`.

This plan does not authorize pushing, deploying, publishing a release, changing storage schemas, or adding a native wrapper. The implementation remains local until the user explicitly authorizes publication or deployment.

## File and Responsibility Map

### New Files

- `e2e/helpers/interactionMetrics.ts` — one reusable browser-side sampler for click-to-mount, frame cadence, long tasks, and layout shift.
- `e2e/interaction-fluidity.spec.ts` — cross-family interruption, lifecycle, keyboard, focus, and performance acceptance tests.
- `lib/motionLifecycle.ts` — pure lifecycle state transitions for page suspension, resume, and viewport invalidation.
- `lib/motionLifecycle.test.ts` — lifecycle reducer tests.
- `lib/sheetStackMotion.ts` — pure internal-sheet geometry and direction helpers.
- `lib/sheetStackMotion.test.ts` — internal-sheet motion tests.
- `app/SheetPageStack.tsx` — persistent, measured, accessible stack of sheet pages inside one outer panel.
- `app/LibrarySheetPages.tsx` — content-only library, batch, rename, grouping, and destructive sheet pages extracted from `AppOverlays.tsx`.
- `lib/workspaceViewportFollow.ts` — pure bottom-pin, prepend-anchor, and follow-policy calculations.
- `lib/workspaceViewportFollow.test.ts` — Workspace viewport policy tests.
- `app/useWorkspaceViewportFollow.ts` — interruptible 200 ms viewport-only follow controller.
- `docs/qa/2026-07-28-iphone15pm-fluidity-checklist.md` — exact physical-device evidence and acceptance record.

### Existing Files with Focused Changes

- `lib/motionSystem.ts` and `lib/motionSystem.test.ts` — authoritative durations, easing, and semantic role transitions.
- `lib/motionRoleParity.test.ts` and `app/page.module.css` — TypeScript/CSS token parity and component-layer styles.
- `app/AppMotionRoot.tsx` — reactive reduced-motion policy plus lifecycle context.
- `lib/navigationMotion.ts`, `app/NavigationStack.tsx`, and `app/AppNavigation.tsx` — root/push timing, retargeting, and gesture cancellation.
- `lib/navigationGestures.ts` and `lib/navigationGestures.test.ts` — pointer ownership and safe cancellation.
- `lib/appNavigation.ts`, `lib/appNavigation.test.ts`, `app/useAppNavigation.ts`, and `app/NavigationProvider.tsx` — full-sheet dismissal and stable sheet-stack subscription.
- `app/MotionSheet.tsx` and `app/BottomSheet.tsx` — persistent outer presentation, lifecycle settlement, keyboard state, focus trap, and drag.
- `app/AppOverlays.tsx` — render all sheet entries inside one `MotionSheet` instead of only `sheets.at(-1)`.
- `app/ReaderSettingsPanel.tsx`, `app/ReaderCustomSettingsPanel.tsx`, `app/TocDrawer.tsx`, `app/ReadingGoalSheet.tsx`, and `app/ReadingWorkspaceSheet.tsx` — export content-only page bodies for the persistent stack.
- `app/SharedBookTransition.tsx`, `app/ReadingSession.tsx`, and `app/page.tsx` — lifecycle-safe reader presentation and explicit visual-first readiness.
- `app/WorkspaceConversation.tsx`, `app/WorkspaceMaterials.tsx`, `app/WorkspaceArtifactPreview.tsx`, `app/useWorkspaceChat.ts`, and `app/AiSettingsSurface.tsx` — bounded internal state motion and independent streaming/persistence scheduling.
- `lib/uiText.ts` and `lib/uiText.test.ts` — the accessible return-to-latest-message label used by Workspace viewport control.
- `lib/motionCss.test.ts`, `lib/overlayMotionIntegration.test.ts`, `lib/sheetNavigationIsolation.test.ts`, `lib/pushSurfaceMotionIntegration.test.ts`, `lib/readerTransitionMotion.test.ts`, `lib/accessibilityIntegration.test.ts`, and `lib/askAiReaderContextIntegration.test.ts` — focused structural regressions.
- `e2e/native-navigation.spec.ts` and `e2e/reading-workspace.spec.ts` — existing product flows updated to the persistent-sheet and viewport-follow contracts.
- `HANDOFF.md` — verified changes, commands, evidence, remaining device status, and publication status.

## Task 1: Establish Reusable Interaction Instrumentation

**Files:**

- Create: `e2e/helpers/interactionMetrics.ts`
- Create: `e2e/interaction-fluidity.spec.ts`
- Modify: `e2e/native-navigation.spec.ts`
- Test: `e2e/interaction-fluidity.spec.ts`

- [ ] **Step 1: Add a reusable metrics sampler**

Create `e2e/helpers/interactionMetrics.ts` with this public contract and implementation:

```ts
import type { Page, TestInfo } from "@playwright/test";

export type InteractionMetrics = {
  clickToMount: number | null;
  frames: number;
  p95Frame: number;
  maxFrame: number;
  maxLongTask: number;
  layoutShift: number;
};

export type InteractionProbeOptions = {
  durationMs: number;
  clickSelector?: string;
  mountSelector?: string;
};

export function collectInteractionMetrics(
  page: Page,
  options: InteractionProbeOptions
): Promise<InteractionMetrics> {
  return page.evaluate(async (probe) => {
    const intervals: number[] = [];
    const longTasks: number[] = [];
    let layoutShift = 0;
    let clickAt: number | null = null;
    let mountedAt: number | null = null;
    let previous = performance.now();
    const observers: PerformanceObserver[] = [];

    const clickListener = (event: MouseEvent) => {
      if (
        probe.clickSelector &&
        event.target instanceof Element &&
        event.target.closest(probe.clickSelector)
      ) {
        clickAt = performance.now();
      }
    };
    document.addEventListener("click", clickListener, true);

    const recordMount = () => {
      if (
        mountedAt === null &&
        probe.mountSelector &&
        document.querySelector(probe.mountSelector)
      ) {
        mountedAt = performance.now();
      }
    };
    const mutation = new MutationObserver(recordMount);
    mutation.observe(document.body, { childList: true, subtree: true });
    recordMount();

    const collectEntries = (entries: PerformanceEntry[]) => {
      for (const entry of entries) {
        if (entry.entryType === "longtask") longTasks.push(entry.duration);
        if (entry.entryType === "layout-shift") {
          layoutShift += (entry as PerformanceEntry & { value: number }).value;
        }
      }
    };

    for (const entryType of ["longtask", "layout-shift"] as const) {
      if (!PerformanceObserver.supportedEntryTypes.includes(entryType)) continue;
      const observer = new PerformanceObserver((list) => {
        collectEntries(list.getEntries());
      });
      observer.observe({ entryTypes: [entryType] });
      observers.push(observer);
    }

    const startedAt = performance.now();
    await new Promise<void>((resolve) => {
      const sample = (now: number) => {
        intervals.push(now - previous);
        previous = now;
        if (now - startedAt >= probe.durationMs) {
          resolve();
          return;
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });

    mutation.disconnect();
    document.removeEventListener("click", clickListener, true);
    for (const observer of observers) {
      collectEntries(observer.takeRecords());
      observer.disconnect();
    }

    const sampled = intervals.slice(2);
    const sorted = [...sampled].sort((left, right) => left - right);
    return {
      clickToMount:
        clickAt === null || mountedAt === null ? null : mountedAt - clickAt,
      frames: sampled.length,
      p95Frame: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
      maxFrame: sampled.length > 0 ? Math.max(...sampled) : 0,
      maxLongTask: longTasks.length > 0 ? Math.max(...longTasks) : 0,
      layoutShift,
    };
  }, options);
}

export async function attachInteractionMetrics(
  testInfo: TestInfo,
  name: string,
  metrics: InteractionMetrics
) {
  await testInfo.attach(`${name}.json`, {
    body: JSON.stringify(
      { project: testInfo.project.name, ...metrics },
      null,
      2
    ),
    contentType: "application/json",
  });
}
```

- [ ] **Step 2: Refactor existing performance cases to use the sampler**

Import the helper in `e2e/native-navigation.spec.ts`:

```ts
import {
  attachInteractionMetrics,
  collectInteractionMetrics,
} from "./helpers/interactionMetrics";
```

Replace the duplicated browser-side samplers in the book-sheet, root-tab, and push-transition tests with `collectInteractionMetrics`. Keep their current gates unchanged during this instrumentation-only commit. A representative call is:

```ts
const metricsPromise = collectInteractionMetrics(page, {
  durationMs: 800,
  clickSelector: '[data-library-book-more="true"]',
  mountSelector:
    '[data-sheet-route="book-actions"] [data-motion-sheet="panel"]',
});
await page.waitForTimeout(40);
await more.click();
const metrics = await metricsPromise;
await attachInteractionMetrics(testInfo, "book-sheet-performance", metrics);
```

- [ ] **Step 3: Add a smoke test for the helper and current destination state**

Create `e2e/interaction-fluidity.spec.ts` with this deterministic book fixture:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  attachInteractionMetrics,
  collectInteractionMetrics,
} from "./helpers/interactionMetrics";

const sampleText = readFileSync(
  path.resolve(process.cwd(), "e2e/fixtures/sample.txt"),
  "utf8"
);
const libraryRoot =
  '[data-navigation-root="library"][aria-hidden="false"]';

async function importBook(page: Page) {
  const covers = page.locator(`${libraryRoot} [data-book-cover-origin]`);
  const previousCount = await covers.count();
  await page.locator('input[type="file"][accept*=".txt"]').setInputFiles({
    name: "interaction-fluidity-sample.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(sampleText),
  });
  await expect(covers).toHaveCount(previousCount + 1);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(libraryRoot)).toBeVisible();
  await expect(
    page.locator(`${libraryRoot} [data-library-loading="false"]`)
  ).toHaveCount(1);
  await importBook(page);
});
```

Then add:

```ts
test("interaction probe records root retargeting without layout shift", async ({
  page,
}, testInfo) => {
  const metricsPromise = collectInteractionMetrics(page, { durationMs: 700 });
  await page.locator('[data-navigation-tab="reading"]').click();
  await page.waitForTimeout(100);
  await page.locator('[data-navigation-tab="settings"]').click();
  const metrics = await metricsPromise;

  await attachInteractionMetrics(testInfo, "root-retarget-baseline", metrics);
  expect(metrics.frames).toBeGreaterThan(20);
  expect(metrics.maxLongTask).toBe(0);
  expect(metrics.layoutShift).toBe(0);
  await expect(page.locator('[data-navigation-root="settings"]')).toHaveAttribute(
    "aria-hidden",
    "false"
  );
});
```

- [ ] **Step 4: Run instrumentation against the production build**

Run:

```powershell
npx.cmd playwright test e2e/native-navigation.spec.ts e2e/interaction-fluidity.spec.ts --project=iphone-15-pro-max --grep "performance|probe records"
```

Expected: all selected tests pass, JSON evidence is written under `test-results/native-navigation`, and the command uses Playwright's build plus `next start` server rather than `next dev`.

- [ ] **Step 5: Commit instrumentation only**

```powershell
git add -- e2e/helpers/interactionMetrics.ts e2e/interaction-fluidity.spec.ts e2e/native-navigation.spec.ts
git commit -m "test: centralize interaction performance probes"
```

## Task 2: Replace Ad Hoc Timing with the Approved Motion Contract

**Files:**

- Modify: `lib/motionSystem.test.ts`
- Modify: `lib/motionSystem.ts`
- Modify: `lib/motionRoleParity.test.ts`
- Modify: `app/page.module.css`
- Test: `lib/motionSystem.test.ts`
- Test: `lib/motionRoleParity.test.ts`

- [ ] **Step 1: Change duration tests to the approved roles**

Replace the duration-table expectation in `lib/motionSystem.test.ts` with:

```ts
expect(MOTION_DURATION).toMatchObject({
  press: 0.12,
  state: 0.16,
  stateExit: 0.12,
  tab: 0.22,
  rootTab: 0.16,
  pushEnter: 0.28,
  pushExit: 0.2,
  readerEnter: 0.28,
  readerExit: 0.21,
  sheetEnter: 0.28,
  sheetExit: 0.22,
  popoverEnter: 0.18,
  popoverExit: 0.12,
  chromeEnter: 0.16,
  chromeExit: 0.12,
  gestureSettle: 0.22,
  reduced: 0.1,
});

expect(ROOT_TAB_CONTENT_TRANSITION).toEqual({
  type: "tween",
  duration: 0.16,
  ease: [0.22, 1, 0.36, 1],
});
expect(ROOT_TAB_TRANSITION).toEqual({
  type: "tween",
  duration: 0.22,
  ease: [0.22, 1, 0.36, 1],
});
```

Replace the full-motion reader timing expectation with:

```ts
expect(getReaderTransitionTiming(false)).toEqual({
  contentEnter: {
    duration: 0.16,
    delay: MOTION_DURATION.readerEnter * 0.24,
  },
  contentExit: { duration: 0.21, delay: 0 },
  coverEnterOpacity: {
    duration: 0.16,
    delay: MOTION_DURATION.readerEnter * 0.42,
  },
  coverExitOpacity: { duration: 0.21, delay: 0 },
});
```

The reduced expectation uses `{ duration: 0.1, delay: 0 }` for all four fields. Rename the old “slow root indicator” test so its description reflects the new short indicator contract.

- [ ] **Step 2: Run the focused tests and verify RED**

```powershell
npm.cmd test -- lib/motionSystem.test.ts lib/motionRoleParity.test.ts
```

Expected: failure reports the old 420/340/300/250/120 ms values and the missing `ROOT_TAB_CONTENT_TRANSITION`, `stateExit`, and popover roles.

- [ ] **Step 3: Implement the central TypeScript roles**

Update the top of `lib/motionSystem.ts` to export:

```ts
export const MOTION_DURATION = {
  press: 0.12,
  state: 0.16,
  stateExit: 0.12,
  tab: 0.22,
  rootTab: 0.16,
  pushEnter: 0.28,
  pushExit: 0.2,
  readerEnter: 0.28,
  readerExit: 0.21,
  sheetEnter: 0.28,
  sheetExit: 0.22,
  popoverEnter: 0.18,
  popoverExit: 0.12,
  chromeEnter: 0.16,
  chromeExit: 0.12,
  gestureSettle: 0.22,
  reduced: 0.1,
} as const;

export const MOTION_EASE = {
  enter: [0.22, 1, 0.36, 1] as const,
  exit: [0.4, 0, 1, 1] as const,
  settle: [0.32, 0.72, 0, 1] as const,
} as const;

export const ROOT_TAB_CONTENT_TRANSITION = {
  type: "tween" as const,
  duration: MOTION_DURATION.rootTab,
  ease: MOTION_EASE.enter,
} as const;

export const ROOT_TAB_TRANSITION = {
  type: "tween" as const,
  duration: MOTION_DURATION.tab,
  ease: MOTION_EASE.enter,
} as const;

export function getRoleTransition(
  role: "push-enter" | "push-exit" | "sheet-enter" | "sheet-exit" | "popover-enter" | "popover-exit" | "state-enter" | "state-exit",
  reduceMotion: boolean
) {
  const duration = reduceMotion
    ? MOTION_DURATION.reduced
    : {
        "push-enter": MOTION_DURATION.pushEnter,
        "push-exit": MOTION_DURATION.pushExit,
        "sheet-enter": MOTION_DURATION.sheetEnter,
        "sheet-exit": MOTION_DURATION.sheetExit,
        "popover-enter": MOTION_DURATION.popoverEnter,
        "popover-exit": MOTION_DURATION.popoverExit,
        "state-enter": MOTION_DURATION.state,
        "state-exit": MOTION_DURATION.stateExit,
      }[role];

  return {
    type: "tween" as const,
    duration,
    ease: role.endsWith("exit") ? MOTION_EASE.exit : MOTION_EASE.enter,
  };
}
```

Keep the existing zero-bounce springs for interactive gesture settlement and shared-cover projection.

- [ ] **Step 4: Mirror every CSS duration**

Replace the duration variables at the top of `app/page.module.css` with:

```css
--motion-fast: 120ms;
--motion-standard: 160ms;
--motion-state-exit: 120ms;
--motion-root: 160ms;
--motion-tab-indicator: 220ms;
--motion-navigation: 280ms;
--motion-navigation-exit: 200ms;
--motion-sheet: 280ms;
--motion-sheet-settle: 220ms;
--motion-sheet-exit: 220ms;
--motion-popover: 180ms;
--motion-popover-exit: 120ms;
--motion-chrome-enter: 160ms;
--motion-chrome-exit: 120ms;
--motion-reduced: 100ms;
```

Extend `lib/motionRoleParity.test.ts` so each new CSS variable equals the matching TypeScript token.

- [ ] **Step 5: Run focused and full motion tests**

```powershell
npm.cmd test -- lib/motionSystem.test.ts lib/motionRoleParity.test.ts lib/motionCss.test.ts
```

Expected: all focused tests pass with no remaining assertion for the old role durations.

- [ ] **Step 6: Commit the motion contract**

```powershell
git add -- lib/motionSystem.ts lib/motionSystem.test.ts lib/motionRoleParity.test.ts app/page.module.css
git commit -m "refactor: define interaction motion roles"
```

## Task 3: Add Suspension, Resume, and Viewport Invalidation Semantics

**Files:**

- Create: `lib/motionLifecycle.ts`
- Create: `lib/motionLifecycle.test.ts`
- Modify: `app/AppMotionRoot.tsx`
- Modify: `lib/motionSystem.test.ts`
- Test: `lib/motionLifecycle.test.ts`

- [ ] **Step 1: Write lifecycle reducer tests**

Create `lib/motionLifecycle.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  createMotionLifecycleState,
  reduceMotionLifecycle,
} from "./motionLifecycle";

describe("motion lifecycle", () => {
  it("suspends once and resumes into a new epoch", () => {
    const initial = createMotionLifecycleState();
    const hidden = reduceMotionLifecycle(initial, { type: "suspend" });
    const duplicate = reduceMotionLifecycle(hidden, { type: "suspend" });
    const visible = reduceMotionLifecycle(duplicate, { type: "resume" });

    expect(hidden).toEqual({ epoch: 1, suspended: true });
    expect(duplicate).toBe(hidden);
    expect(visible).toEqual({ epoch: 2, suspended: false });
  });

  it("invalidates obsolete geometry without suspending", () => {
    expect(
      reduceMotionLifecycle(createMotionLifecycleState(), {
        type: "viewport-change",
      })
    ).toEqual({ epoch: 1, suspended: false });
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

```powershell
npm.cmd test -- lib/motionLifecycle.test.ts
```

Expected: failure reports that `./motionLifecycle` does not exist.

- [ ] **Step 3: Implement the pure lifecycle state**

Create `lib/motionLifecycle.ts`:

```ts
export type MotionLifecycleState = {
  epoch: number;
  suspended: boolean;
};

export type MotionLifecycleEvent =
  | { type: "suspend" }
  | { type: "resume" }
  | { type: "viewport-change" };

export function createMotionLifecycleState(): MotionLifecycleState {
  return { epoch: 0, suspended: false };
}

export function reduceMotionLifecycle(
  state: MotionLifecycleState,
  event: MotionLifecycleEvent
): MotionLifecycleState {
  if (event.type === "suspend") {
    return state.suspended
      ? state
      : { epoch: state.epoch + 1, suspended: true };
  }
  if (event.type === "resume") {
    return state.suspended
      ? { epoch: state.epoch + 1, suspended: false }
      : state;
  }
  return { epoch: state.epoch + 1, suspended: state.suspended };
}
```

- [ ] **Step 4: Expose lifecycle state from the existing Motion root**

In `app/AppMotionRoot.tsx`, add a second context and export:

```ts
export function useAppMotionLifecycle(): MotionLifecycleState {
  const lifecycle = useContext(AppMotionLifecycleContext);
  if (lifecycle === null) {
    throw new Error("useAppMotionLifecycle must be used within AppMotionRoot");
  }
  return lifecycle;
}
```

Inside `AppMotionRoot`, use `useReducer(reduceMotionLifecycle, createMotionLifecycleState())` and register `pagehide`, `pageshow`, `visibilitychange`, and `orientationchange`. Hidden/pagehide dispatch `suspend`; visible/pageshow dispatch `resume`; orientation dispatches `viewport-change`. Wrap the existing provider tree with `AppMotionLifecycleContext.Provider` without adding a key to `MotionConfig` or `LayoutGroup`.

- [ ] **Step 5: Add source-level runtime assertions and run GREEN**

Extend the AppMotionRoot test in `lib/motionSystem.test.ts` to require all four event names, `useAppMotionLifecycle`, and the absence of keyed root remounts.

```powershell
npm.cmd test -- lib/motionLifecycle.test.ts lib/motionSystem.test.ts
```

Expected: lifecycle and Motion-root tests pass.

- [ ] **Step 6: Commit lifecycle authority**

```powershell
git add -- lib/motionLifecycle.ts lib/motionLifecycle.test.ts app/AppMotionRoot.tsx lib/motionSystem.test.ts
git commit -m "feat: settle motion across app lifecycle changes"
```

## Task 4: Make Root and Push Navigation Short, Interruptible, and Unambiguous

**Files:**

- Modify: `lib/navigationMotion.test.ts`
- Modify: `lib/navigationMotion.ts`
- Modify: `app/NavigationStack.tsx`
- Modify: `app/AppNavigation.tsx`
- Modify: `lib/pushSurfaceMotionIntegration.test.ts`
- Modify: `e2e/interaction-fluidity.spec.ts`
- Modify: `app/page.module.css`
- Test: `e2e/interaction-fluidity.spec.ts`

- [ ] **Step 1: Write failing root and push contract tests**

Add expectations to `lib/navigationMotion.test.ts`:

```ts
expect(getRootTabOffsets("library", "settings")).toEqual({
  outgoing: -6,
  incoming: 10,
});
expect(getRootTabOffsets("settings", "library")).toEqual({
  outgoing: 6,
  incoming: -10,
});
expect(getPushTransition("enter", false).duration).toBe(0.28);
expect(getPushTransition("exit", false).duration).toBe(0.2);
expect(getPushTransition("enter", true).duration).toBe(0.1);
```

Replace the existing test that equates root travel with `COMPACT_PUSH_OFFSETS` with:

```ts
it("keeps root travel independent from compact pushed pages", () => {
  expect(COMPACT_PUSH_OFFSETS).toEqual({ incoming: 22, covered: -12 });
  expect(ROOT_TAB_OFFSETS).toEqual({ incoming: 10, outgoing: 6 });
});
```

Add a source assertion to `lib/pushSurfaceMotionIntegration.test.ts` requiring `onLostPointerCapture={handlePointerCancel}` and `ROOT_TAB_CONTENT_TRANSITION`.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm.cmd test -- lib/navigationMotion.test.ts lib/pushSurfaceMotionIntegration.test.ts
```

Expected: old 12/22 px offsets fail, `getPushTransition` is missing, and the lost-capture handler is absent.

- [ ] **Step 3: Implement bounded root geometry and directional push timing**

In `lib/navigationMotion.ts`, change `COMPACT_PUSH_OFFSETS` and add:

```ts
export const ROOT_TAB_OFFSETS = {
  outgoing: 6,
  incoming: 10,
} as const;

export function getPushTransition(
  phase: "enter" | "exit",
  reduceMotion: boolean
) {
  return getRoleTransition(
    phase === "enter" ? "push-enter" : "push-exit",
    reduceMotion
  );
}
```

`getRootTabOffsets` must use `ROOT_TAB_OFFSETS` while `COMPACT_PUSH_OFFSETS` remains dedicated to compact pushed pages.

- [ ] **Step 4: Apply the new roles in `NavigationStack` and `AppNavigation`**

In `NavigationRoot`, replace the navigation spring on the root section with `ROOT_TAB_CONTENT_TRANSITION`; keep the inner parallax layer on the navigation spring for push depth. Set `data-motion-role="root-content"` on the section.

In `PushLayer`, use `getPushTransition("enter", reduceMotion)` for normal animation and attach `transition: getPushTransition("exit", reduceMotion)` to the exit target. Keep `MOTION_DURATION.gestureSettle` only for an actual interactive release. Add:

```tsx
onPointerCancel={handlePointerCancel}
onLostPointerCapture={handlePointerCancel}
```

Use `useAppMotionLifecycle()` to clear the pointer owner, stop `edgeBackX`, and set it to `0` whenever the lifecycle epoch changes. No navigation action fires during this safety settlement.

In `AppNavigation.tsx`, keep the existing shared indicator but use `ROOT_TAB_TRANSITION` and add `data-motion-role="root-indicator"`.

- [ ] **Step 5: Add ten-intent and midpoint evidence tests**

Add this shape to `e2e/interaction-fluidity.spec.ts`:

```ts
test("ten root intents settle on the last tab without ghost surfaces", async ({
  page,
}, testInfo) => {
  const sequence = [
    "reading",
    "settings",
    "library",
    "settings",
    "reading",
    "library",
    "reading",
    "settings",
    "library",
    "settings",
  ] as const;
  const metricsPromise = collectInteractionMetrics(page, { durationMs: 800 });
  for (const tab of sequence) {
    await page.locator(`[data-navigation-tab="${tab}"]`).click();
    await page.waitForTimeout(18);
  }
  const metrics = await metricsPromise;
  await attachInteractionMetrics(testInfo, "ten-root-intents", metrics);

  await expect(page.locator('[data-navigation-root="settings"]')).toHaveAttribute(
    "aria-hidden",
    "false"
  );
  await expect(page.locator('[data-navigation-root][aria-hidden="false"]')).toHaveCount(1);
  expect(metrics.p95Frame).toBeLessThanOrEqual(17);
  expect(metrics.maxLongTask).toBe(0);
  expect(metrics.layoutShift).toBe(0);
});
```

Add push interruption coverage that starts edge back, fires `pointercancel`, and verifies the pushed page returns to `translateX(0px)` and remains interactive.

- [ ] **Step 6: Run focused unit and iPhone 15 Pro Max tests**

```powershell
npm.cmd test -- lib/navigationMotion.test.ts lib/pushSurfaceMotionIntegration.test.ts lib/navigationGestures.test.ts
npx.cmd playwright test e2e/interaction-fluidity.spec.ts --project=iphone-15-pro-max --grep "root intents|pointercancel"
```

Expected: all tests pass; only one root surface is accessible after rapid input, and cancellation leaves the push layer stable.

- [ ] **Step 7: Commit root and push motion**

```powershell
git add -- lib/navigationMotion.ts lib/navigationMotion.test.ts app/NavigationStack.tsx app/AppNavigation.tsx app/page.module.css lib/pushSurfaceMotionIntegration.test.ts e2e/interaction-fluidity.spec.ts
git commit -m "feat: retarget root and push navigation motion"
```

## Task 5: Extend Navigation State for One Persistent Sheet Presentation

**Files:**

- Modify: `lib/appNavigation.test.ts`
- Modify: `lib/appNavigation.ts`
- Modify: `lib/appNavigationStore.test.ts`
- Modify: `app/useAppNavigation.ts`
- Modify: `app/NavigationProvider.tsx`
- Modify: `lib/navigationHistory.test.ts`
- Test: `lib/appNavigation.test.ts`

- [ ] **Step 1: Write reducer tests for full dismissal and invalid ancestors**

Add to `lib/appNavigation.test.ts`:

```ts
it("dismisses an entire sheet presentation without changing its parent layers", () => {
  const state: AppNavigationState = {
    ...createAppNavigationState(),
    sheets: [
      { key: "sheet-1", kind: "sheet", route: "book-actions" },
      { key: "sheet-2", kind: "sheet", route: "book-rename" },
    ],
  };
  const next = reduceAppNavigation(state, { type: "dismiss-sheet-stack" });
  expect(next.sheets).toEqual([]);
  expect(next.pushes).toBe(state.pushes);
  expect(next.reader).toBe(state.reader);
  expect(next.direction).toBe("backward");
});

it("removes an invalid sheet and every descendant that depends on it", () => {
  const state: AppNavigationState = {
    ...createAppNavigationState(),
    sheets: [
      { key: "sheet-1", kind: "sheet", route: "book-actions" },
      { key: "sheet-2", kind: "sheet", route: "book-rename" },
      { key: "sheet-3", kind: "sheet", route: "book-delete" },
    ],
  };
  const next = reduceAppNavigation(state, {
    type: "remove-invalid",
    key: "sheet-2",
  });
  expect(next.sheets.map((entry) => entry.key)).toEqual(["sheet-1"]);
});
```

- [ ] **Step 2: Run reducer tests and verify RED**

```powershell
npm.cmd test -- lib/appNavigation.test.ts
```

Expected: `dismiss-sheet-stack` is not assignable, and invalid removal leaves `sheet-3` behind.

- [ ] **Step 3: Implement the reducer action and descendant removal**

Extend `AppNavigationAction` with:

```ts
| { type: "dismiss-sheet-stack" }
```

Handle it before `restore`:

```ts
case "dismiss-sheet-stack":
  if (state.sheets.length === 0) return state;
  return next(state, { sheets: [] }, "backward");
```

For `remove-invalid`, find the entry index in `sheets` and use `slice(0, invalidSheetIndex)` so dependent descendants cannot survive without their parent. Apply the same prefix rule to a pushed entry found in the middle of `pushes`. Update the existing “removes an invalid entry from every possible layer” assertion so an invalid first sheet produces `[]`, not `["sheet-keep"]`.

- [ ] **Step 4: Add a full-state subscription and history-aware stack dismissal**

In `app/NavigationProvider.tsx`, export:

```ts
export function useNavigationState(): AppNavigationState {
  const value = useNavigation();
  return useSyncExternalStore(
    value.subscribe,
    value.getState,
    value.getState
  );
}
```

In `UseAppNavigationResult`, add `dismissSheetStack: () => void`. Implement it in `app/useAppNavigation.ts` by calculating the current sheet depth before starting dismissal:

```ts
const dismissSheetStack = useCallback(() => {
  const depth = store.getState().sheets.length;
  if (depth === 0) return;
  const action: AppNavigationAction = { type: "dismiss-sheet-stack" };
  const nextState = reduceAppNavigation(store.getState(), action);

  if (
    typeof window !== "undefined" &&
    decodeNavigationHistory(window.history.state)
  ) {
    store.setState(nextState);
    window.history.go(-depth);
    return;
  }

  store.setState(nextState);
  if (typeof window !== "undefined") {
    window.history.replaceState(
      mergeNavigationHistory(window.history.state, nextState),
      ""
    );
  }
}, [store]);
```

Keep `dismissSheet()` as the one-page back command used by browser back and visible internal Back.

- [ ] **Step 5: Verify reducer, store, and history compatibility**

```powershell
npm.cmd test -- lib/appNavigation.test.ts lib/appNavigationStore.test.ts lib/navigationHistory.test.ts lib/appNavigationHookIntegration.test.ts
```

Expected: all tests pass, History version remains `1`, and no storage or URL migration is introduced.

- [ ] **Step 6: Commit sheet navigation semantics**

```powershell
git add -- lib/appNavigation.ts lib/appNavigation.test.ts lib/appNavigationStore.test.ts app/useAppNavigation.ts app/NavigationProvider.tsx lib/navigationHistory.test.ts
git commit -m "feat: add persistent sheet stack navigation"
```

## Task 6: Build the Measured Internal Sheet Page Stack

**Files:**

- Create: `lib/sheetStackMotion.ts`
- Create: `lib/sheetStackMotion.test.ts`
- Create: `app/SheetPageStack.tsx`
- Modify: `app/page.module.css`
- Create: `lib/sheetStackIntegration.test.ts`
- Test: `lib/sheetStackMotion.test.ts`

- [ ] **Step 1: Write pure geometry tests**

Create `lib/sheetStackMotion.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  getSheetPageBoundary,
  getSheetPageTarget,
} from "./sheetStackMotion";

describe("sheet page stack motion", () => {
  it("keeps the active page at rest and the parent mounted behind it", () => {
    expect(getSheetPageTarget(0, false)).toEqual({ opacity: 1, x: 0 });
    expect(getSheetPageTarget(1, false)).toEqual({ opacity: 0.92, x: -12 });
  });

  it("removes spatial movement under reduced motion", () => {
    expect(getSheetPageTarget(0, true)).toEqual({ opacity: 1, x: 0 });
    expect(getSheetPageTarget(1, true)).toEqual({ opacity: 0, x: 0 });
  });

  it("uses opposite boundaries for push and back", () => {
    expect(getSheetPageBoundary("forward", "enter", false)).toEqual({
      opacity: 0,
      x: 24,
    });
    expect(getSheetPageBoundary("backward", "exit", false)).toEqual({
      opacity: 0,
      x: 24,
    });
    expect(getSheetPageBoundary("replace", "enter", false)).toEqual({
      opacity: 0,
      x: 0,
    });
  });
});
```

- [ ] **Step 2: Run the pure test and verify RED**

```powershell
npm.cmd test -- lib/sheetStackMotion.test.ts
```

Expected: failure reports that `./sheetStackMotion` does not exist.

- [ ] **Step 3: Implement the pure sheet target helper**

Create `lib/sheetStackMotion.ts`:

```ts
import type { NavigationDirection } from "./appNavigation";

export function getSheetPageTarget(
  distanceFromTop: number,
  reduceMotion: boolean
): { opacity: number; x: number } {
  if (distanceFromTop <= 0) return { opacity: 1, x: 0 };
  if (reduceMotion) return { opacity: 0, x: 0 };
  return { opacity: 0.92, x: -12 };
}

export function getSheetPageBoundary(
  direction: NavigationDirection,
  phase: "enter" | "exit",
  reduceMotion: boolean
): { opacity: number; x: number } {
  if (reduceMotion || direction === "replace") return { opacity: 0, x: 0 };
  const forward = direction === "forward";
  const x = phase === "enter"
    ? forward ? 24 : -12
    : forward ? -12 : 24;
  return { opacity: 0, x };
}
```

- [ ] **Step 4: Create the persistent `SheetPageStack` component**

Create `app/SheetPageStack.tsx` with these public types:

```ts
export type SheetPageRenderControls = {
  back: CloseSheet;
  dismiss: CloseSheet;
  depth: number;
  isRoot: boolean;
};

export type SheetPageStackProps = {
  entries: SheetEntry[];
  direction: NavigationDirection;
  renderPage: (
    entry: SheetEntry,
    controls: SheetPageRenderControls
  ) => ReactNode;
  onBack: () => void;
  dismiss: CloseSheet;
};
```

Render every entry, not only the top entry. Each page gets a stable key, `data-sheet-page`, and `data-sheet-page-active`. Only the top page may have pointer events; every covered page has `aria-hidden="true"` and `inert`. Use `AnimatePresence initial={false} mode="sync"`, `getSheetPageTarget`, and `getSheetPageBoundary`. Use `getRoleTransition("push-enter", reduceMotion)` for incoming pages and `getRoleTransition("push-exit", reduceMotion)` for exiting pages.

Implement `back(afterBack)` by storing the callback under the active entry key, calling `onBack()` immediately, and invoking the callback only from that entry's exit completion. A generation/key guard discards the callback if a newer sheet intent retargets the stack first. This gives internal pages the same `CloseSheet` semantics as the outer panel without dismissing the whole presentation.

Each page reports its `ResizeObserver` height into `Map<entry.key, number>`. Animate the stack viewport to the active height when motion is not reduced; otherwise set the height immediately. Task 9 adds the keyboard-visible exception after the outer sheet exposes that state. On completion, focus `[data-sheet-autofocus="true"]`, then the first focusable control, then the active page itself.

The stack root must have:

```tsx
<m.div
  className={styles.sheetPageViewport}
  data-sheet-stack-depth={entries.length}
  data-sheet-stack-direction={direction}
  animate={{ height: activeHeight || "auto" }}
  transition={heightTransition}
>
```

- [ ] **Step 5: Add CSS for isolated internal pages**

Add to `app/page.module.css`:

```css
.sheetPageViewport {
  position: relative;
  width: 100%;
  min-height: 0;
  overflow: hidden;
}

.sheetPage {
  width: 100%;
  min-height: 0;
  transform: translateZ(0);
}

.sheetPage[data-sheet-page-active="false"] {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.sheetPage[data-sheet-page-active="true"] {
  position: relative;
}
```

Do not add permanent `will-change` to page layers.

- [ ] **Step 6: Add structural integration assertions**

Create `lib/sheetStackIntegration.test.ts` to require that `SheetPageStack.tsx` maps `entries`, uses `ResizeObserver`, marks covered pages inert, uses `mode="sync"`, and never calls `sheets.at(-1)` internally.

```powershell
npm.cmd test -- lib/sheetStackMotion.test.ts lib/sheetStackIntegration.test.ts
```

Expected: both files pass.

- [ ] **Step 7: Commit the internal page stack**

```powershell
git add -- lib/sheetStackMotion.ts lib/sheetStackMotion.test.ts app/SheetPageStack.tsx app/page.module.css lib/sheetStackIntegration.test.ts
git commit -m "feat: add measured internal sheet page stack"
```

## Task 7: Extract Content-Only Sheet Pages Without Changing Behavior

**Files:**

- Create: `app/LibrarySheetPages.tsx`
- Modify: `app/ReaderSettingsPanel.tsx`
- Modify: `app/ReaderCustomSettingsPanel.tsx`
- Modify: `app/TocDrawer.tsx`
- Modify: `app/ReadingGoalSheet.tsx`
- Modify: `app/ReadingWorkspaceSheet.tsx`
- Modify: `app/AppOverlays.tsx`
- Modify: `lib/overlayMotionIntegration.test.ts`
- Modify: `lib/readingGoalOverlayIntegration.test.ts`
- Modify: `lib/readerMenuIntegration.test.ts`
- Test: `lib/overlayMotionIntegration.test.ts`

- [ ] **Step 1: Write source tests for content-only exports**

Require named exports `ReaderSettingsPage`, `ReaderCustomSettingsPage`, `TocPage`, `ReadingGoalPage`, and `ReadingWorkspacePage`. Require each page's source body to omit `<BottomSheet`; keep existing default wrappers temporarily so this extraction commit does not change runtime behavior.

Require `app/LibrarySheetPages.tsx` to export:

```ts
export {
  BatchDeletePage,
  BatchGroupPage,
  BookActionPage,
  BookDeletePage,
  BookGroupPage,
  BookRenamePage,
  CollectionCreatePage,
};
```

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm.cmd test -- lib/overlayMotionIntegration.test.ts lib/readingGoalOverlayIntegration.test.ts lib/readerMenuIntegration.test.ts
```

Expected: named content exports and `LibrarySheetPages.tsx` are missing.

- [ ] **Step 3: Split each reusable sheet into wrapper and page body**

Use this exact pattern in each existing component:

```tsx
export type ReaderSettingsPageProps = Omit<Props, "onClose"> & {
  close: CloseSheet;
};

export default function ReaderSettingsPanel(props: Props) {
  return (
    <BottomSheet
      onClose={props.onClose}
      ariaLabel="主题与设置"
      className={styles.readerSettingsSheet}
    >
      {(close) => (
        <ReaderSettingsPage
          preferences={props.preferences}
          mode={props.mode}
          onChange={props.onChange}
          onModeChange={props.onModeChange}
          onOpenCustomSettings={props.onOpenCustomSettings}
          close={close}
        />
      )}
    </BottomSheet>
  );
}
```

Move the current render-prop JSX beginning with `<div className={styles.readerSettingsHeader}>` into the new named `ReaderSettingsPage` and move the state/ref declarations it uses with it. Apply the same mechanical extraction to the other four files without changing their JSX or event behavior. Mark rename inputs and other initial-focus controls with `data-sheet-autofocus="true"`.

- [ ] **Step 4: Extract the library page bodies from `AppOverlays.tsx`**

Move `AskAiSheet` only if needed for type isolation; move all library/batch/local sheet functions and `SheetHeader` into `app/LibrarySheetPages.tsx`. Replace their `onClose` props with a `close: CloseSheet` prop and remove their outer `BottomSheet` elements. Keep form state, validation, async save failure, and destructive callbacks unchanged.

For rename, preserve this failure behavior exactly:

```ts
try {
  await onRename(book.id, trimmed);
  close();
} catch {
  setError(UI_TEXT.RENAME_BOOK_FAILED);
  setSaving(false);
  inputRef.current?.focus({ preventScroll: true });
}
```

- [ ] **Step 5: Keep the current runtime composition green**

Until Task 8 activates `SheetPageStack`, have `AppOverlays.tsx` wrap the extracted content page for the active route with the same `BottomSheet` metadata and pass its render-prop `close`. This intermediate state must look and behave identically to the current release.

- [ ] **Step 6: Run focused and full unit verification**

```powershell
npm.cmd test -- lib/overlayMotionIntegration.test.ts lib/readingGoalOverlayIntegration.test.ts lib/readerMenuIntegration.test.ts lib/bookRenameIntegration.test.ts lib/surfaceArchitecture.test.ts
npm.cmd test
```

Expected: focused tests and the full Vitest suite pass with no product behavior change.

- [ ] **Step 7: Commit page extraction**

```powershell
git add -- app/LibrarySheetPages.tsx app/ReaderSettingsPanel.tsx app/ReaderCustomSettingsPanel.tsx app/TocDrawer.tsx app/ReadingGoalSheet.tsx app/ReadingWorkspaceSheet.tsx app/AppOverlays.tsx lib/overlayMotionIntegration.test.ts lib/readingGoalOverlayIntegration.test.ts lib/readerMenuIntegration.test.ts
git commit -m "refactor: extract sheet page content"
```

## Task 8: Activate One Persistent Outer Sheet for Every Route

**Files:**

- Modify: `app/MotionSheet.tsx`
- Modify: `app/BottomSheet.tsx`
- Modify: `app/AppOverlays.tsx`
- Modify: `app/page.module.css`
- Modify: `lib/overlayMotionIntegration.test.ts`
- Modify: `lib/sheetNavigationIsolation.test.ts`
- Modify: `lib/sheetStackIntegration.test.ts`
- Modify: `e2e/native-navigation.spec.ts`
- Modify: `e2e/interaction-fluidity.spec.ts`
- Test: `e2e/interaction-fluidity.spec.ts`

- [ ] **Step 1: Replace the old top-only assertions with a persistent-shell contract**

Update tests to require:

```ts
expect(overlaysSource).toContain("<MotionSheet");
expect(overlaysSource).toContain("<SheetPageStack");
expect(overlaysSource).toContain("entries={navigationState.sheets}");
expect(overlaysSource).not.toContain("const sheet = sheets.at(-1)");
expect(overlaysSource).not.toMatch(/case [\s\S]*?<BottomSheet/);
```

Add reducer-backed browser coverage: open `book-actions`, push `book-rename`, and assert there is still exactly one panel and one backdrop while two `data-sheet-page` elements exist.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm.cmd test -- lib/overlayMotionIntegration.test.ts lib/sheetNavigationIsolation.test.ts lib/sheetStackIntegration.test.ts
```

Expected: `AppOverlays` still selects only the last sheet and each route still owns the outer panel.

- [ ] **Step 3: Make `MotionSheet` a stack-aware outer presentation**

Extend `MotionSheetProps` with controlled presentation callbacks:

```ts
open: boolean;
stackDepth?: number;
onRequestClose: () => void;
onExitComplete?: () => void;
```

`CloseSheet(afterClose)` stores the callback and immediately calls `onRequestClose`; `open={false}` from browser history must trigger the same outer exit even when no close button ran. After the visual exit, call the stored callback and `onExitComplete` exactly once. If `open` becomes true during exit, stop the current controller, discard the stale completion, and settle from the current `y` value back to zero.

Add `data-sheet-stack-depth={stackDepth}` to the panel. Use `getRoleTransition("sheet-exit", reduceMotion)` for programmatic exit and a 100 ms opacity-only entry/exit when reduced. Read `useAppMotionLifecycle`; whenever its epoch changes, stop the active animation and increment `animationGenerationRef`. If an exit is requested, snap to the exited position and finish it exactly once; if the presentation remains open, set `y` to `0`. Never replay an entrance on resume.

Remove permanent CSS `will-change` from `.motionSheetBackdrop` and `.motionSheetPanel`. Set it through Motion style only while entering, dragging, settling, or closing, then clear it on completion.

- [ ] **Step 4: Render one shell around all navigation sheet entries**

In `AppOverlays.tsx`, subscribe with `useNavigationState()` and keep `visualEntries` as the last non-empty sheet array. When logical `sheets` becomes empty through browser Back, retain `visualEntries` until the controlled outer exit completes. When a new sheet arrives during that exit, replace `visualEntries` and let `MotionSheet` retarget to open.

Compute `renderedEntries = navigationState.sheets.length > 0 ? navigationState.sheets : visualEntries` and `topSheet = renderedEntries.at(-1)`. Return `null` only when `renderedEntries.length === 0`; otherwise return one stable structure:

```tsx
return (
  <div
    className={styles.sheetRouteHost}
    data-sheet-route={topSheet.route}
    data-sheet-stack-root={renderedEntries[0]?.route}
  >
    <MotionSheet
      open={navigationState.sheets.length > 0}
      onRequestClose={navigation.dismissSheetStack}
      onExitComplete={() => setVisualEntries([])}
      ariaLabel={presentation.ariaLabel}
      className={presentation.className}
      showGrabber={presentation.showGrabber}
      stackDepth={renderedEntries.length}
      onBeforeClose={presentation.onBeforeDismiss}
    >
      {(dismiss) => (
        <SheetPageStack
          entries={renderedEntries}
          direction={navigationState.direction}
          onBack={navigation.dismissSheet}
          dismiss={dismiss}
          renderPage={renderSheetPage}
        />
      )}
    </MotionSheet>
  </div>
);
```

Define `presentation` from a typed route metadata record containing `ariaLabel`, optional panel class, grabber visibility, and the Reading Goal before-dismiss callback. `renderSheetPage` must render every entry by its own `entityId`, not by `topSheet.entityId`.

Use this exact metadata mapping:

| Route | Accessible label | Panel class | Grabber |
| --- | --- | --- | --- |
| `reader-settings` | `主题与设置` | `readerSettingsSheet` | yes |
| `reader-custom-settings` | `自定义设置` | `readerCustomSettingsSheet` | no |
| `toc` | `目录与标记` | `tocSheet` | yes |
| `ask-ai` | `UI_TEXT.ASK_AI` | `askBottomSheet` | yes |
| `reading-goal` | `UI_TEXT.READING_GOAL` | `goalMotionSheet` | no |
| `book-actions` | `UI_TEXT.BOOK_ACTIONS` | `bookActionSheet` | yes |
| `book-rename` | `UI_TEXT.RENAME_BOOK` | none | yes |
| `book-delete` | `UI_TEXT.DELETE_BOOK_CONFIRM_TITLE` | none | yes |
| `book-groups` | `UI_TEXT.MANAGE_GROUPS` | none | yes |
| `reading-workspace` | `UI_TEXT.READING_WORKSPACE` plus book title | `readingWorkspaceSheet` | yes |
| `batch-groups` | `UI_TEXT.ADD_SELECTED_TO_GROUP` | none | yes |
| `batch-delete` | `UI_TEXT.BATCH_DELETE_CONFIRM_TITLE` | none | yes |
| `collection-create` | `新建藏书` | none | yes |

Only `reading-goal` supplies `onBeforeDismiss`, calling `actions.setGoalInputValue(reader.targetMinutes)`. Inside `renderSheetPage`, derive the page close command once:

```ts
const closePage = controls.isRoot ? controls.dismiss : controls.back;
```

Pass `closePage` to every content-only page. This makes Close on a root page dismiss the outer presentation, while Cancel/Done/Save on a nested page performs an internal back and runs its callback after the internal exit.

- [ ] **Step 5: Validate all book-backed entries, not only the top page**

Replace the current top-only effect with:

```ts
useEffect(() => {
  if (library.booksLoading) return;
  const invalidEntry = renderedEntries.find(
    (entry) =>
      BOOK_ROUTES.has(entry.route) &&
      (!entry.entityId ||
        !library.books.some((book) => book.id === entry.entityId))
  );
  if (invalidEntry) navigation.removeInvalid(invalidEntry.key);
}, [library.books, library.booksLoading, navigation, renderedEntries]);
```

- [ ] **Step 6: Prove continuity, history, and rapid reversal in the browser**

Add tests that assert:

- root sheet to nested page keeps the same `data-motion-sheet="panel"` DOM node via an element identity token stored in the page;
- the backdrop remains mounted and does not restart opacity from zero;
- browser Back pops one internal page;
- visible Back pops one internal page;
- downward outer dismissal clears the full stack;
- ten alternating nested push/back commands end at the last requested page with one panel and no stale route;
- deletion of the owning book removes the invalid page and descendants without an empty animated frame.

Run:

```powershell
npm.cmd test -- lib/appNavigation.test.ts lib/overlayMotionIntegration.test.ts lib/sheetNavigationIsolation.test.ts lib/sheetStackIntegration.test.ts
npx.cmd playwright test e2e/native-navigation.spec.ts e2e/interaction-fluidity.spec.ts --project=iphone-15-pro-max --grep "sheet stack|nested sheet|invalid sheet"
```

Expected: all focused tests pass; the DOM contains one panel/backdrop through nested navigation.

- [ ] **Step 7: Commit the persistent sheet integration**

```powershell
git add -- app/MotionSheet.tsx app/BottomSheet.tsx app/AppOverlays.tsx app/page.module.css lib/overlayMotionIntegration.test.ts lib/sheetNavigationIsolation.test.ts lib/sheetStackIntegration.test.ts e2e/native-navigation.spec.ts e2e/interaction-fluidity.spec.ts
git commit -m "feat: preserve one sheet across nested navigation"
```

## Task 9: Coordinate Sheet Focus, Keyboard, Drag, and Viewport Changes

**Files:**

- Modify: `app/MotionSheet.tsx`
- Modify: `app/SheetPageStack.tsx`
- Modify: `lib/navigationGestures.ts`
- Modify: `lib/navigationGestures.test.ts`
- Modify: `lib/accessibilityIntegration.test.ts`
- Modify: `e2e/interaction-fluidity.spec.ts`
- Modify: `app/page.module.css`
- Test: `e2e/interaction-fluidity.spec.ts`

- [ ] **Step 1: Add failing gesture and focus assertions**

Extend `lib/navigationGestures.test.ts`:

```ts
expect(
  canSheetClaimGesture({
    fromHeader: false,
    scrollTop: 0,
    deltaY: 18,
    interactiveTarget: true,
    keyboardVisible: false,
  })
).toBe(false);

expect(
  canSheetClaimGesture({
    fromHeader: true,
    scrollTop: 0,
    deltaY: 18,
    interactiveTarget: false,
    keyboardVisible: true,
  })
).toBe(false);
```

Add browser assertions that a rename input remains visible above a mocked visual viewport, Back restores focus to the originating Book Action row, and only the active page is exposed to accessibility.

- [ ] **Step 2: Run the focused tests and verify RED**

```powershell
npm.cmd test -- lib/navigationGestures.test.ts lib/accessibilityIntegration.test.ts
npx.cmd playwright test e2e/interaction-fluidity.spec.ts --project=iphone-15-pro-max --grep "keyboard|focus|active sheet page"
```

Expected: the pure gesture signature lacks the two flags and focus moves before internal-page settlement.

- [ ] **Step 3: Make gesture arbitration explicit**

Update `canSheetClaimGesture` to accept `interactiveTarget` and `keyboardVisible` and return false for either condition. In `MotionSheet.handleDragPointerDown`, pass the existing `isInteractiveControl(target)` result plus the current keyboard state.

Add `onLostPointerCapture` with the same safe settlement path as `onPointerCancel`. A cancelled drag returns to `y = 0`; it never calls navigation dismissal.

- [ ] **Step 4: Derive keyboard state once in `MotionSheet`**

During visual viewport synchronization, compute:

```ts
const keyboardVisible =
  window.innerHeight - viewport.height - viewport.offsetTop >= 120;
```

Expose it through `SheetPresentationContext`; `SheetPageStack` reads it through `useSheetPresentationMotion()`. While true:

- disable page-height animation;
- disable new drag ownership;
- use `element.scrollIntoView({ block: "nearest" })` after focus;
- keep the composer or form input visible without translating the entire overlay.

- [ ] **Step 5: Delay page focus until the destination owns the screen**

In `SheetPageStack`, focus only from the active page's `onAnimationComplete`, guarded by its entry key and current lifecycle epoch. Internal Back restores focus to the previous page's matching `[data-sheet-return-focus]`; outer exit retains `MotionSheet`'s original-trigger restoration.

Keep one `role="dialog"` and `aria-modal="true"` on the outer panel. Internal pages are regions, not nested modal dialogs. Convert Workspace memory review to a labelled in-sheet region or popover so it does not create a second modal boundary.

- [ ] **Step 6: Run focus, keyboard, and dismissal coverage**

```powershell
npm.cmd test -- lib/navigationGestures.test.ts lib/accessibilityIntegration.test.ts lib/overlayMotionIntegration.test.ts
npx.cmd playwright test e2e/interaction-fluidity.spec.ts e2e/native-navigation.spec.ts --project=iphone-15-pro-max --grep "keyboard|focus|drag|outside-tap|Escape"
```

Expected: all tests pass; no input is obscured, drag never steals an interactive control, and focus is restored at the correct hierarchy level.

- [ ] **Step 7: Commit sheet input coordination**

```powershell
git add -- app/MotionSheet.tsx app/SheetPageStack.tsx lib/navigationGestures.ts lib/navigationGestures.test.ts lib/accessibilityIntegration.test.ts e2e/interaction-fluidity.spec.ts app/page.module.css
git commit -m "fix: coordinate sheet focus keyboard and gestures"
```

## Task 10: Make Reader Presentation Visual-First and Lifecycle-Safe

**Files:**

- Modify: `lib/readerTransitionMotion.test.ts`
- Modify: `app/SharedBookTransition.tsx`
- Modify: `app/ReadingSession.tsx`
- Modify: `app/page.tsx`
- Modify: `app/page.module.css`
- Modify: `e2e/native-navigation.spec.ts`
- Modify: `e2e/interaction-fluidity.spec.ts`
- Test: `lib/readerTransitionMotion.test.ts`

- [ ] **Step 1: Write failing reader timing and lifecycle tests**

Require 280 ms entry, 210 ms exit, 100 ms reduced crossfade, a `data-reader-content-ready` state, and `useAppMotionLifecycle` consumption in `SharedBookTransition`.

Add an e2e case that opens a book, backgrounds/resumes through `pagehide` plus `pageshow`, and verifies the reader is at its final transform/opacity rather than replaying an entrance.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm.cmd test -- lib/readerTransitionMotion.test.ts lib/sharedBookTransitionIntegration.test.ts
```

Expected: current source lacks lifecycle settlement and the explicit readiness marker.

- [ ] **Step 3: Mark a meaningful reader first frame**

In `ReadingSession.tsx`, set:

```tsx
data-reader-content-ready={
  book && (book.format === "epub" || !loading) ? "true" : "false"
}
```

Keep the existing loading state mounted inside the reader presentation. `page.tsx` must continue calling `prepareReaderBook` before `presentReader` and awaiting completion afterward; this preserves the already-correct parallel visual-first flow.

- [ ] **Step 4: Settle obsolete reader geometry on lifecycle change**

In `SharedBookTransition`, read `{ epoch, suspended }`. When the epoch changes, disable shared layout projection for that render and use the fallback settled geometry. When suspended, use zero-duration state completion; when resumed, show the current reader directly rather than changing its key or replaying its entry.

The close path remains non-blocking:

```ts
void positionCoordinator.flush().catch(() => {
  setImportError(UI_TEXT.ERROR_READ_FILE);
});
navigation.dismissReader();
```

- [ ] **Step 5: Add reader interruption, gesture ownership, and visual evidence**

Test shared and fallback openings, close after origin removal, close during content preparation, pagehide/pageshow, orientationchange, reduced motion, EPUB horizontal ownership, TXT scroll, selection, and reader controls. Capture start/midpoint/end images at 70 ms and after final settlement; assert no white frame and no two readable reader layers.

Run:

```powershell
npm.cmd test -- lib/readerTransitionMotion.test.ts lib/sharedBookTransitionIntegration.test.ts lib/readerSwipeOwnership.test.ts
npx.cmd playwright test e2e/native-navigation.spec.ts e2e/interaction-fluidity.spec.ts --project=iphone-15-pro-max --grep "reader presentation|reader lifecycle|reader gesture"
```

Expected: all focused tests pass and reader logical state survives every interruption.

- [ ] **Step 6: Commit reader presentation hardening**

```powershell
git add -- lib/readerTransitionMotion.test.ts app/SharedBookTransition.tsx app/ReadingSession.tsx app/page.tsx app/page.module.css e2e/native-navigation.spec.ts e2e/interaction-fluidity.spec.ts
git commit -m "feat: make reader presentation lifecycle safe"
```

## Task 11: Isolate Workspace Streaming, Persistence, and Viewport Following

**Files:**

- Create: `lib/workspaceViewportFollow.ts`
- Create: `lib/workspaceViewportFollow.test.ts`
- Create: `app/useWorkspaceViewportFollow.ts`
- Modify: `app/WorkspaceConversation.tsx`
- Modify: `app/useWorkspaceChat.ts`
- Modify: `lib/uiText.ts`
- Modify: `lib/uiText.test.ts`
- Modify: `lib/askAiReaderContextIntegration.test.ts`
- Modify: `e2e/reading-workspace.spec.ts`
- Modify: `app/page.module.css`
- Test: `lib/workspaceViewportFollow.test.ts`

- [ ] **Step 1: Write pure bottom-pin and prepend-anchor tests**

Create `lib/workspaceViewportFollow.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  getAnchoredPrependScrollTop,
  isWorkspaceNearBottom,
  shouldFollowWorkspaceViewport,
} from "./workspaceViewportFollow";

describe("workspace viewport following", () => {
  it("uses a bounded bottom threshold", () => {
    expect(isWorkspaceNearBottom(1000, 500, 452)).toBe(true);
    expect(isWorkspaceNearBottom(1000, 500, 400)).toBe(false);
  });

  it("never follows while the user owns scrolling", () => {
    expect(
      shouldFollowWorkspaceViewport({
        nearBottom: true,
        userInteracting: true,
        visible: true,
      })
    ).toBe(false);
  });

  it("preserves the visible anchor when older rows prepend", () => {
    expect(getAnchoredPrependScrollTop(800, 1200, 1800)).toBe(1400);
  });
});
```

- [ ] **Step 2: Run the policy test and verify RED**

```powershell
npm.cmd test -- lib/workspaceViewportFollow.test.ts
```

Expected: failure reports that `./workspaceViewportFollow` does not exist.

- [ ] **Step 3: Implement pure viewport policy**

Create `lib/workspaceViewportFollow.ts`:

```ts
export function isWorkspaceNearBottom(
  scrollHeight: number,
  clientHeight: number,
  scrollTop: number,
  threshold = 48
): boolean {
  return scrollHeight - scrollTop - clientHeight <= threshold;
}

export function shouldFollowWorkspaceViewport(input: {
  nearBottom: boolean;
  userInteracting: boolean;
  visible: boolean;
}): boolean {
  return input.nearBottom && !input.userInteracting && input.visible;
}

export function getAnchoredPrependScrollTop(
  previousScrollTop: number,
  previousScrollHeight: number,
  nextScrollHeight: number
): number {
  return previousScrollTop + Math.max(0, nextScrollHeight - previousScrollHeight);
}
```

- [ ] **Step 4: Implement one interruptible viewport-follow controller**

Create `app/useWorkspaceViewportFollow.ts` using `animate` from `motion/react`. Its public result is:

```ts
export type WorkspaceViewportFollow = {
  threadRef: RefObject<HTMLDivElement | null>;
  showReturnToBottom: boolean;
  onScroll: (event: UIEvent<HTMLDivElement>) => void;
  onUserInteractionStart: () => void;
  preservePrependAnchor: (load: () => Promise<void> | void) => Promise<void>;
  returnToBottom: () => void;
};
```

On content revision, if the thread is visible, bottom-pinned, and not user-owned, stop the current controller and animate only `scrollTop` from its rendered value to `scrollHeight - clientHeight` over `MOTION_DURATION.pushExit` with `MOTION_EASE.enter`. `pointerdown`, `touchstart`, and `wheel` stop the controller immediately. A manual scroll away from the 48 px threshold sets `showReturnToBottom` to true and disables follow until `returnToBottom` or the user naturally reaches the bottom.

- [ ] **Step 5: Use the hook in `WorkspaceConversation`**

Replace the direct `[loading, messages]` `scrollTop = scrollHeight` effect and manual prepend frame with the hook. Derive a stable revision:

```ts
const lastMessage = messages.at(-1);
const contentRevision = lastMessage
  ? `${lastMessage.id}:${lastMessage.state}:${lastMessage.content.length}`
  : `empty:${loading}`;
```

Attach `onPointerDown`, `onTouchStart`, and `onWheel` to the thread. Do not add layout animation to a streaming message row; only a newly inserted message may fade once.

Add `WORKSPACE_RETURN_TO_LATEST: "回到最新消息"` to `lib/uiText.ts`, cover it in `lib/uiText.test.ts`, and render this control between the thread and composer when `showReturnToBottom` is true:

```tsx
<button
  type="button"
  className={styles.workspaceReturnToLatest}
  onClick={returnToBottom}
>
  {UI_TEXT.WORKSPACE_RETURN_TO_LATEST}
</button>
```

- [ ] **Step 6: Move persistence out of the streaming loop's immediate lane**

In `app/useWorkspaceChat.ts`, add `startTransition` and a `checkpointQueueRef = useRef(Promise.resolve())`. Wrap only rAF streaming publication in `startTransition`. Replace the awaited checkpoint write inside the stream loop with:

```ts
checkpointQueueRef.current = checkpointQueueRef.current
  .catch(() => undefined)
  .then(() => putWorkspaceMessage(checkpoint));
lastCheckpointAt = nowMs;
checkpointLength = checkpoint.content.length;
```

Before the final complete/error record is persisted, await `checkpointQueueRef.current.catch(() => undefined)` so an older checkpoint cannot overwrite the final state. Reset the queue only after request cleanup.

- [ ] **Step 7: Add user-scroll and composer responsiveness coverage**

Extend `e2e/reading-workspace.spec.ts` to stream a deterministic long response, scroll 300 px away from the bottom, and verify the scroll position changes by no more than 1 px while chunks continue. Then click an explicit return-to-bottom control and verify following resumes. Type into the composer during the stream and require each keystroke to appear without waiting for completion.

Run:

```powershell
npm.cmd test -- lib/workspaceViewportFollow.test.ts lib/askAiReaderContextIntegration.test.ts lib/workspaceChat.test.ts lib/uiText.test.ts
npx.cmd playwright test e2e/reading-workspace.spec.ts --project=iphone-15-pro-max --grep "streaming|scroll|composer"
```

Expected: viewport and persistence tests pass; streaming never pulls a user who is reading older content.

- [ ] **Step 8: Commit Workspace scheduling and follow behavior**

```powershell
git add -- lib/workspaceViewportFollow.ts lib/workspaceViewportFollow.test.ts app/useWorkspaceViewportFollow.ts app/WorkspaceConversation.tsx app/useWorkspaceChat.ts lib/uiText.ts lib/uiText.test.ts lib/askAiReaderContextIntegration.test.ts e2e/reading-workspace.spec.ts app/page.module.css
git commit -m "perf: isolate workspace streaming and viewport follow"
```

## Task 12: Complete Workspace, Popover, List, and Inline-State Motion Coverage

**Files:**

- Modify: `app/ReadingWorkspaceSheet.tsx`
- Modify: `app/WorkspaceConversation.tsx`
- Modify: `app/WorkspaceMaterials.tsx`
- Modify: `app/WorkspaceArtifactPreview.tsx`
- Modify: `app/AiSettingsSurface.tsx`
- Modify: `app/ReaderSettingsPanel.tsx`
- Modify: `app/TocDrawer.tsx`
- Modify: `app/page.module.css`
- Modify: `lib/motionCss.test.ts`
- Modify: `lib/accessibilityIntegration.test.ts`
- Modify: `e2e/interaction-fluidity.spec.ts`
- Modify: `e2e/reading-workspace.spec.ts`
- Test: `lib/motionCss.test.ts`

- [ ] **Step 1: Add failing semantic-role coverage**

Require these markers in source tests:

```ts
expect(workspaceSource).toContain('data-motion-role="inline-state"');
expect(workspaceSource).toContain('data-motion-role="popover"');
expect(materialsSource).toContain("layout");
expect(aiSettingsSource).toContain('data-motion-role="inline-state"');
expect(readerSettingsSource).toContain('data-motion-role="popover"');
expect(tocSource).toContain('data-motion-role="inline-state"');
```

Require every popover to use 180/120 ms roles, every local state to use 160/120 ms roles, and reduced motion to remove transform while retaining state/focus semantics.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm.cmd test -- lib/motionCss.test.ts lib/accessibilityIntegration.test.ts lib/askAiReaderContextIntegration.test.ts
```

Expected: Workspace and settings still hard-replace several conditional branches and lack semantic role markers.

- [ ] **Step 3: Animate Workspace tabs and anchored session menu**

In `ReadingWorkspacePage`, use a shared `layoutId="workspace-segment-indicator"` for the selected segment and `AnimatePresence initial={false} mode="sync"` for the two tab panels. Use a 10 px bounded horizontal offset based on direction and `getRoleTransition("state-enter" | "state-exit", reduceMotion)`.

Wrap the session menu in `AnimatePresence`. Its origin is `100% 0%`; use `{ opacity: 0, scale: 0.96 }` to `{ opacity: 1, scale: 1 }` with popover roles. Close on Escape and outside pointer-down, return focus to the menu trigger, and never change the outer sheet backdrop.

- [ ] **Step 4: Animate lists and local status without moving streaming geometry**

Use `m.article layout="position"` plus `AnimatePresence initial={false}` for completed material, annotation, and memory rows. Deletion uses opacity plus at most 6 px vertical movement. Loading/error/empty/retry/save states share one fixed semantic region and 160/120 ms opacity transitions.

Workspace messages receive one entrance fade when their ID first appears. A message whose state is `streaming` does not use layout projection or token-level animation.

- [ ] **Step 5: Apply the same roles to settings and TOC state**

- Reader settings mode/theme popovers use the popover role and trigger-aligned origin.
- TOC tab panels use the inline role while preserving the existing horizontal swipe ownership.
- AI provider refresh status, empty/models list, selected preset, and manual-model rows use inline/list motion; provider fetch and save remain asynchronous.
- Switches, rows, chips, and destructive actions use the shared press duration and 44 px target floor.

CSS selectors must consume central variables; do not add literal transition durations in component-specific rules.

- [ ] **Step 6: Test rapid state reversal, failure retention, and reduced motion**

Add browser cases that:

- alternate Workspace tabs ten times and end on the last requested tab;
- open/close the session menu rapidly without leaving a transparent click blocker;
- fail rename/save and preserve input plus focus;
- add/remove a material without shifting the header or composer;
- switch TOC tabs during a swipe cancellation;
- switch AI provider states while a model refresh is pending;
- repeat representative cases with reduced motion and 200 percent text.

Run:

```powershell
npm.cmd test -- lib/motionCss.test.ts lib/accessibilityIntegration.test.ts lib/askAiReaderContextIntegration.test.ts lib/aiSettingsSheetIntegration.test.ts lib/tocAnnotations.test.ts
npx.cmd playwright test e2e/interaction-fluidity.spec.ts e2e/reading-workspace.spec.ts --project=iphone-15-pro-max --grep "inline state|popover|materials|reduced motion|200 percent"
```

Expected: all focused tests pass, active state is unique, input is retained on failure, and no hidden layer intercepts input.

- [ ] **Step 7: Commit complete internal-state coverage**

```powershell
git add -- app/ReadingWorkspaceSheet.tsx app/WorkspaceConversation.tsx app/WorkspaceMaterials.tsx app/WorkspaceArtifactPreview.tsx app/AiSettingsSurface.tsx app/ReaderSettingsPanel.tsx app/TocDrawer.tsx app/page.module.css lib/motionCss.test.ts lib/accessibilityIntegration.test.ts e2e/interaction-fluidity.spec.ts e2e/reading-workspace.spec.ts
git commit -m "feat: complete inline interaction motion coverage"
```

## Task 13: Enforce Performance, Theme, Accessibility, and Recovery Gates

**Files:**

- Modify: `e2e/interaction-fluidity.spec.ts`
- Modify: `e2e/native-navigation.spec.ts`
- Modify: `e2e/reading-workspace.spec.ts`
- Modify: `playwright.config.ts`
- Modify: `lib/motionCss.test.ts`
- Test: `e2e/interaction-fluidity.spec.ts`

- [ ] **Step 1: Add the final shared automated gate helper**

In `e2e/helpers/interactionMetrics.ts`, export:

```ts
export function expectInteractionBudget(
  metrics: InteractionMetrics,
  options: { requireMount?: boolean } = {}
) {
  if (options.requireMount) {
    expect(metrics.clickToMount).not.toBeNull();
    expect(metrics.clickToMount ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(50);
  }
  expect(metrics.frames).toBeGreaterThan(20);
  expect(metrics.p95Frame).toBeLessThanOrEqual(17);
  expect(metrics.maxLongTask).toBe(0);
  expect(metrics.layoutShift).toBe(0);
}
```

Import `expect` from `@playwright/test` in that helper.

- [ ] **Step 2: Apply gates to every transition family**

Use the helper for root, push, reader, sheet, nested sheet, Workspace tab, Workspace streaming, popover, and representative inline-state changes. For mount-bearing destinations, require click-to-mount at most 50 ms. Keep the existing stricter book-sheet cold gate if it remains stable.

For press feedback, hold pointer-down on a representative root tab, book row, sheet row, reader control, and Workspace action. Poll computed style once per animation frame and require the first opacity/transform/background change within 80 ms.

- [ ] **Step 3: Add interruption and environment matrices**

Run each applicable family through:

- ten rapid operations;
- reverse during entry and reverse during exit;
- `pointercancel` and lost pointer capture;
- pagehide/pageshow;
- orientationchange;
- visual viewport keyboard resize;
- missing entity;
- offline and failed save;
- reduced motion;
- light, dark, sepia, and custom background.

Each case asserts the final logical route, one interactive surface, no stuck `inert`, no duplicate accessible dialog, no unhandled page error, and no layout shift.

- [ ] **Step 4: Run both automated iPhone profiles**

Run with port 3010 free so Playwright owns the production server:

```powershell
npx.cmd playwright test e2e/interaction-fluidity.spec.ts e2e/native-navigation.spec.ts e2e/reading-workspace.spec.ts --project=iphone-14
npx.cmd playwright test e2e/interaction-fluidity.spec.ts e2e/native-navigation.spec.ts e2e/reading-workspace.spec.ts --project=iphone-15-pro-max
```

Expected: every selected test passes on both profiles; JSON metrics and screenshots are saved only under ignored test-results directories.

- [ ] **Step 5: Inspect transition evidence at original resolution**

Open the start/midpoint/end/reversal captures for root, push, reader, outer sheet, nested sheet, Workspace tab, popover, and streaming. Verify no readable double text, white frame, backdrop restart, stale page, clipped safe area, end jump, or transparent input blocker. Record each reviewed filename in the later QA document; do not commit screenshots.

- [ ] **Step 6: Commit the acceptance matrix**

```powershell
git add -- e2e/helpers/interactionMetrics.ts e2e/interaction-fluidity.spec.ts e2e/native-navigation.spec.ts e2e/reading-workspace.spec.ts playwright.config.ts lib/motionCss.test.ts
git commit -m "test: enforce interaction fluidity budgets"
```

## Task 14: Full Verification, Physical iPhone Closeout, and Handoff

**Files:**

- Create: `docs/qa/2026-07-28-iphone15pm-fluidity-checklist.md`
- Modify: `HANDOFF.md`
- Verify: all implementation and test files from Tasks 1–13

- [ ] **Step 1: Run focused correctness suites**

```powershell
npm.cmd test -- lib/motionLifecycle.test.ts lib/motionSystem.test.ts lib/motionRoleParity.test.ts lib/navigationMotion.test.ts lib/navigationGestures.test.ts lib/appNavigation.test.ts lib/appNavigationStore.test.ts lib/navigationHistory.test.ts lib/sheetStackMotion.test.ts lib/sheetStackIntegration.test.ts lib/workspaceViewportFollow.test.ts lib/overlayMotionIntegration.test.ts lib/accessibilityIntegration.test.ts lib/readerTransitionMotion.test.ts lib/askAiReaderContextIntegration.test.ts
```

Expected: all focused files pass with zero failed tests.

- [ ] **Step 2: Run repository-wide quality gates**

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Expected: all discovered Vitest files pass, ESLint exits 0, and the Next.js webpack production build plus TypeScript/static generation exits 0.

- [ ] **Step 3: Run the complete browser matrix**

```powershell
npx.cmd playwright test --project=iphone-14
npx.cmd playwright test --project=iphone-15-pro-max
```

Expected: the complete Playwright suite passes against the production server on both profiles.

- [ ] **Step 4: Run design and repository hygiene checks**

```powershell
node ..\.agents\skills\impeccable\scripts\detect.mjs --json app\AppMotionRoot.tsx app\NavigationStack.tsx app\MotionSheet.tsx app\SheetPageStack.tsx app\SharedBookTransition.tsx app\ReadingWorkspaceSheet.tsx app\WorkspaceConversation.tsx app\WorkspaceMaterials.tsx app\AiSettingsSurface.tsx app\TocDrawer.tsx app\page.module.css
git diff --check
git status -sb
```

Expected: Impeccable returns `[]`, whitespace check is silent, and only the QA/handoff files intended for this task remain uncommitted.

- [ ] **Step 5: Create the physical-device acceptance record**

Create `docs/qa/2026-07-28-iphone15pm-fluidity-checklist.md` with:

- device model, iOS version, Safari version, build ID, commit SHA, date, and standalone-display confirmation;
- normal-speed and frame-by-frame results for each motion family;
- light/dark/sepia/custom-background results;
- keyboard open/close, draft retention, background/resume, rotation, offline, weak network, reduced motion, VoiceOver, 200 percent text, rapid tap, drag cancellation, and user-scroll-during-streaming results;
- observed refresh cadence and any thermal/power condition without claiming guaranteed 120 Hz;
- exact screenshot/video/JSON evidence filenames;
- a pass/fail statement for every acceptance criterion in the governing specification.

If a physical device or installable candidate is unavailable, stop before marking the project complete. Record the automated evidence as passing and state exactly which physical checks remain; do not convert missing device evidence into a pass.

- [ ] **Step 6: Request publication authority only if device testing needs a hosted candidate**

Show the clean candidate commit and automated evidence to the user. Ask separately whether to push and deploy a preview/production build for home-screen PWA testing. Do not run `git push`, `npm run deploy:cf`, create a release, or update production without explicit authorization.

- [ ] **Step 7: Update `HANDOFF.md` with exact verified evidence**

Record:

- governing spec and plan paths;
- implementation commit SHAs by phase;
- the persistent-sheet architecture and removal of top-only remounting;
- final durations and semantic roles;
- automated mount/frame/long-task/layout-shift/rapid-operation metrics;
- focused/full Vitest, lint, build, both Playwright profiles, Impeccable, and whitespace results;
- physical iPhone evidence or the exact remaining physical block;
- branch, upstream divergence, push, deployment, tag, release, and production status without assumptions.

- [ ] **Step 8: Commit verified documentation**

```powershell
git add -- docs/qa/2026-07-28-iphone15pm-fluidity-checklist.md HANDOFF.md
git diff --cached --check
git commit -m "docs: record interaction fluidity verification"
```

- [ ] **Step 9: Present integration options without mutating remote state**

```powershell
git status -sb
git log -8 --oneline --decorate
```

Expected: the worktree is clean and the new commits are local. Use the finishing-a-development-branch workflow to offer local integration, push/PR, or continued device verification. Do not reset, clean, overwrite existing work, push, deploy, tag, or publish until the user selects the corresponding action.
