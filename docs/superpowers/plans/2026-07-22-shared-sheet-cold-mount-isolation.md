# Shared Sheet Cold-Mount Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the cold first-open hitch by preventing sheet-only navigation from reconciling the full app and by removing mount-time forced layout from `MotionSheet`.

**Architecture:** Keep one navigation reducer/history model, but publish core and sheet subscriptions separately through a small external store. `Home` consumes only the core snapshot; `AppOverlays` selects the sheet stack. Initialize sheet geometry without synchronous layout reads and let `ResizeObserver` refine it after layout.

**Tech Stack:** Next.js 16, React 19, TypeScript, `useSyncExternalStore`, Motion for React, Vitest, Playwright Chromium mobile profiles.

---

## File Map

- Create `lib/appNavigationStore.ts`: state holder with core/full subscriptions.
- Modify `app/useAppNavigation.ts`: preserve actions/history while using the store and exposing `getState`/`subscribe`.
- Modify `app/NavigationProvider.tsx`: expose `useNavigationSheets()` without rerendering core consumers.
- Modify `app/page.tsx`: remove sheet-state reads from `Home`, add a small pending-navigation coordinator, and pass book ids to group actions.
- Modify `app/AppOverlays.tsx`: subscribe to sheets directly and pass the active book id to group actions.
- Modify `app/MotionSheet.tsx`: remove mount-time forced measurement and redundant viewport update.
- Modify/add focused Vitest files for red-green store, source, and motion contracts.
- Extend the permanent performance evidence and `HANDOFF.md` only after fresh verification.

### Task 1: Lock and implement split navigation subscriptions

**Files:**
- Create: `lib/appNavigationStore.test.ts`
- Create: `lib/appNavigationStore.ts`
- Modify: `lib/appNavigationHookIntegration.test.ts`
- Modify: `app/useAppNavigation.ts`
- Modify: `app/NavigationProvider.tsx`

- [ ] **Step 1: Write failing store and source-contract tests**

Test a wished-for `createAppNavigationStore()` API with `getState`,
`getCoreSnapshot`, `setState`, `subscribe`, and `subscribeCore`. Dispatch state
transitions through the existing reducer in the test and assert:

```ts
const initial = createAppNavigationState();
const store = createAppNavigationStore(initial);
const initialCoreSnapshot = store.getCoreSnapshot();
let coreNotifications = 0;
let allNotifications = 0;
store.subscribeCore(() => coreNotifications++);
store.subscribe(() => allNotifications++);

const sheetState = reduceAppNavigation(initial, {
  type: "present-sheet",
  entry: { key: "sheet-1", kind: "sheet", route: "book-actions" },
});
store.setState(sheetState);
expect(coreNotifications).toBe(0);
expect(allNotifications).toBe(1);
expect(store.getCoreSnapshot()).toBe(initialCoreSnapshot);
```

Then set a `select-tab`, `push`, or reader transition and require both the core
snapshot and core notification to change. Update the integration contract to
require `useSyncExternalStore`, `createAppNavigationStore`, `getState`,
`subscribe`, and `useNavigationSheets`, and to reject direct `useReducer` state
ownership in `useAppNavigation`.

- [ ] **Step 2: Run RED**

Run:

```powershell
npm.cmd test -- lib/appNavigationStore.test.ts lib/appNavigationHookIntegration.test.ts
```

Expected: fail because the store and sheet selector do not exist and the hook
still owns a reducer subscription.

- [ ] **Step 3: Implement the minimal store-backed hook**

Create a store whose core snapshot contains only `activeTab`, `pushes`, and
`reader`. `setState(next)` always notifies full subscribers, but updates/notifies
the core snapshot only when one of those three references/values changes.
Refactor the hook's `commit`, `restore`, traversal, key generation, and history
effects to read/write the store. Use `useSyncExternalStore` only for the core
snapshot. Return stable navigation actions plus `getState` and `subscribe`.
Implement `useNavigationSheets()` with `useSyncExternalStore` over the full
subscription and `getState().sheets`.

- [ ] **Step 4: Run GREEN and full navigation units**

```powershell
npm.cmd test -- lib/appNavigationStore.test.ts lib/appNavigationHookIntegration.test.ts lib/appNavigation.test.ts lib/navigationHistory.test.ts
```

Expected: all pass with no sheet-only core notification.

- [ ] **Step 5: Commit**

```powershell
git add -- lib/appNavigationStore.ts lib/appNavigationStore.test.ts lib/appNavigationHookIntegration.test.ts app/useAppNavigation.ts app/NavigationProvider.tsx
git commit -m "perf: split sheet navigation subscriptions"
```

### Task 2: Remove `Home` from the sheet subscription path

**Files:**
- Create: `lib/sheetNavigationIsolation.test.ts`
- Modify: `app/page.tsx`
- Modify: `app/AppOverlays.tsx`
- Modify: existing overlay/group integration tests if their action signatures change.

- [ ] **Step 1: Write the failing isolation contract**

Require `page.tsx` not to contain `navigation.state.sheets`, require
`AppOverlays` to call `useNavigationSheets()`, and require a small
`PendingNavigationCoordinator` to own the effect that reacts to sheet-stack
changes. Require group mutation actions to receive `bookId` explicitly rather
than deriving `groupSheetBook` from `Home`'s active sheet.

- [ ] **Step 2: Run RED**

```powershell
npm.cmd test -- lib/sheetNavigationIsolation.test.ts lib/libraryBookActionsIntegration.test.ts lib/appNavigationHookIntegration.test.ts
```

Expected: fail on every old `Home` sheet-state dependency.

- [ ] **Step 3: Implement the isolation**

Use `navigation.getState().sheets` only for imperative checks. Move the pending
reader/settings effect into `PendingNavigationCoordinator`, which subscribes
through `useNavigationSheets()` and renders `null`. In `AppOverlays`, select the
active sheet with the dedicated hook. Change create/toggle group actions to
accept the active `book.id`, and remove `activeSheet`/`groupSheetBook` from
`Home`. Preserve every reducer action and history/back behavior.

- [ ] **Step 4: Run GREEN and browser navigation focus tests**

```powershell
npm.cmd test -- lib/sheetNavigationIsolation.test.ts lib/libraryBookActionsIntegration.test.ts lib/appNavigationHookIntegration.test.ts lib/overlayMotionIntegration.test.ts
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-14 --grep "all sheet routes|sheet destination|book action sheet|shared sheet preserves"
```

Expected: units pass; all selected real sheet routes, focus, dismissal, and
book-action tests pass on the production-managed server.

- [ ] **Step 5: Commit**

```powershell
git add -- app/page.tsx app/AppOverlays.tsx lib/sheetNavigationIsolation.test.ts lib/libraryBookActionsIntegration.test.ts lib/appNavigationHookIntegration.test.ts lib/overlayMotionIntegration.test.ts
git commit -m "perf: isolate sheet presentation from app surfaces"
```

### Task 3: Remove mount-time forced sheet layout

**Files:**
- Modify: `lib/overlayMotionIntegration.test.ts`
- Modify: `app/MotionSheet.tsx`

- [ ] **Step 1: Add the failing cold-mount motion contract**

Require a viewport-derived initial `sheetHeight`, exact height updates from
`ResizeObserverEntry.borderBoxSize` (with a callback-time fallback), and an
initial visual viewport state initializer. Reject `panel.getBoundingClientRect()`
from the mount effect and reject an unconditional `syncViewport();` call in the
viewport effect. Retain the existing focus/inert/drag/interruption assertions.

- [ ] **Step 2: Run RED**

```powershell
npm.cmd test -- lib/overlayMotionIntegration.test.ts lib/motionCss.test.ts lib/motionRoleParity.test.ts
```

Expected: only the new cold-mount assertions fail.

- [ ] **Step 3: Implement the asynchronous measurement path**

Initialize the working height to `window.innerHeight` on the client (SSR-safe
fallback `900`). Observe the panel immediately, then set exact border-box height
from the observer callback; a callback-time DOM fallback is allowed only when
`borderBoxSize` is unavailable. Initialize visual viewport geometry once and
let the effect respond only to later `resize`/`scroll`. Do not defer focus or
inert behavior.

- [ ] **Step 4: Run GREEN and focused browser behavior**

```powershell
npm.cmd test -- lib/overlayMotionIntegration.test.ts lib/motionCss.test.ts lib/motionRoleParity.test.ts
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-14 --grep "all sheet routes|reduced motion|shared sheet preserves"
```

Expected: all pass with unchanged motion timing and interaction behavior.

- [ ] **Step 5: Commit**

```powershell
git add -- app/MotionSheet.tsx lib/overlayMotionIntegration.test.ts
git commit -m "perf: defer shared sheet geometry measurement"
```

### Task 4: Confirm cold distribution, matched traces, and full quality gates

**Files:**
- Modify: `docs/performance/*` with fresh machine-readable baseline/candidate evidence.
- Modify: `HANDOFF.md`
- Use: `scripts/shared-sheet-trace-probe.cjs`
- Test: complete unit and E2E suites.

- [ ] **Step 1: Run the no-trace cold distribution**

Against one exclusive production build and browser, run at least thirty fresh
iPhone 14 contexts using the real More button and the same observers as the E2E
gate. Preserve a machine-readable summary. Required: every sample
click-to-mount `<=34ms`, P95 `<=20ms`, maximum frame `<=34ms`, no long task, and
zero CLS. Do not discard or retry failed samples.

- [ ] **Step 2: Run committed matched traces**

With the same recorded Chromium version and committed probe hash, run three
baseline traces at `fa1fc21` and three candidate traces at current HEAD. Apply
the predeclared per-category median and maximum duration rules. Preserve both
JSON outputs and the evaluated comparison.

- [ ] **Step 3: Run complete verification**

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-14
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-15-pro-max
node C:\aaa\.agents\skills\impeccable\scripts\detect.mjs --json app\MotionSheet.tsx app\page.module.css app\useAppNavigation.ts app\NavigationProvider.tsx app\AppOverlays.tsx app\page.tsx
git diff --check
```

Expected: all tests/builds pass, detector returns `[]`, and port `3010` is free
after each Playwright-managed run.

- [ ] **Step 4: Update evidence and commit**

Record the new navigation/layout architecture, exact distribution and trace
results, any failures, full test totals, current branch state, and the physical
120Hz boundary in `HANDOFF.md`. Never call failed evidence passing.

```powershell
git add -- docs/performance HANDOFF.md
git diff --cached --check
git commit -m "docs: verify shared sheet cold mount isolation"
```

- [ ] **Step 5: Present branch-finishing options**

Keep the feature worktree and branch until the user chooses local merge, PR,
keep-as-is, or discard. Do not push or deploy without separate authorization.
