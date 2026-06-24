# Reading Goal Fullscreen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan.

**Goal:** Replace the reading-goal bottom sheet with the approved full-screen progress view and an accessible 1-1440 minute wheel whose draft is saved only after the user presses `完成`.

**Architecture:** Keep reading-goal persistence and overlay orchestration in their existing owners. Add pure display and wheel helpers under `lib`, put direct-manipulation behavior in a focused `ReadingGoalWheel` client component, and rewrite `ReadingGoalSheet` as a modal full-screen dialog with local editing state and focus management.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS Modules, Vitest, existing local-storage helpers.

---

## Task 1: Add Reading-Goal Display Calculations

**Files:**
- Modify: `lib/readingGoalDisplay.test.ts`
- Modify: `lib/readingGoalDisplay.ts`

### Step 1: Write the failing tests

Replace the continue-button tests with duration, remaining-time, and completion-state coverage:

```ts
import { describe, expect, it } from "vitest";
import {
  formatReadingGoalDuration,
  getReadingGoalArcPercent,
  getReadingGoalDisplay,
} from "./readingGoalDisplay";

describe("formatReadingGoalDuration", () => {
  it.each([
    [0, "0:00"],
    [5, "0:05"],
    [65, "1:05"],
    [1440, "24:00"],
  ])("formats %i minutes as %s", (minutes, expected) => {
    expect(formatReadingGoalDuration(minutes)).toBe(expected);
  });

  it("normalizes invalid and negative input", () => {
    expect(formatReadingGoalDuration(-2)).toBe("0:00");
    expect(formatReadingGoalDuration(Number.NaN)).toBe("0:00");
  });
});

describe("getReadingGoalDisplay", () => {
  it("returns remaining minutes before completion", () => {
    expect(getReadingGoalDisplay(35, 120)).toEqual({
      remainingMinutes: 85,
      completed: false,
    });
  });

  it("clamps remaining minutes and marks completion", () => {
    expect(getReadingGoalDisplay(180, 120)).toEqual({
      remainingMinutes: 0,
      completed: true,
    });
  });
});
```

Keep the current arc-percent tests unchanged.

### Step 2: Run the focused test and verify failure

Run:

```powershell
npm.cmd run test -- lib/readingGoalDisplay.test.ts
```

Expected: Vitest fails because `formatReadingGoalDuration` and `getReadingGoalDisplay` do not exist.

### Step 3: Implement the pure helpers

Update `lib/readingGoalDisplay.ts`:

```ts
export type ReadingGoalDisplay = {
  remainingMinutes: number;
  completed: boolean;
};

function normalizeMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return 0;
  return Math.max(0, Math.floor(minutes));
}

export function formatReadingGoalDuration(minutes: number): string {
  const normalized = normalizeMinutes(minutes);
  const hours = Math.floor(normalized / 60);
  const remainder = normalized % 60;
  return `${hours}:${remainder.toString().padStart(2, "0")}`;
}

export function getReadingGoalDisplay(
  todayMinutes: number,
  targetMinutes: number
): ReadingGoalDisplay {
  const today = normalizeMinutes(todayMinutes);
  const target = normalizeMinutes(targetMinutes);
  const remainingMinutes = Math.max(target - today, 0);

  return {
    remainingMinutes,
    completed: target > 0 && today >= target,
  };
}
```

Remove `getReadingGoalContinueSubtitle`; the redesigned view has no continue-reading action.

### Step 4: Run the focused test

Run:

```powershell
npm.cmd run test -- lib/readingGoalDisplay.test.ts
```

Expected: all display-helper tests pass.

### Step 5: Commit

```powershell
git add lib/readingGoalDisplay.ts lib/readingGoalDisplay.test.ts
git commit -m "test: define reading goal display states"
```

## Task 2: Define Minute-Wheel Range and Keyboard Behavior

**Files:**
- Create: `lib/readingGoalWheel.test.ts`
- Create: `lib/readingGoalWheel.ts`

### Step 1: Write the failing tests

Create tests for clamping, bounded rendering, and keyboard commands:

```ts
import { describe, expect, it } from "vitest";
import {
  clampReadingGoalMinutes,
  getReadingGoalWheelValues,
  getReadingGoalWheelValueForKey,
} from "./readingGoalWheel";

describe("clampReadingGoalMinutes", () => {
  it("clamps and rounds values into the supported range", () => {
    expect(clampReadingGoalMinutes(0)).toBe(1);
    expect(clampReadingGoalMinutes(120.8)).toBe(121);
    expect(clampReadingGoalMinutes(1600)).toBe(1440);
  });
});

describe("getReadingGoalWheelValues", () => {
  it("returns five values centered around ordinary selections", () => {
    expect(getReadingGoalWheelValues(120)).toEqual([118, 119, 120, 121, 122]);
  });

  it("keeps a five-value window at both boundaries", () => {
    expect(getReadingGoalWheelValues(1)).toEqual([1, 2, 3, 4, 5]);
    expect(getReadingGoalWheelValues(1440)).toEqual([
      1436, 1437, 1438, 1439, 1440,
    ]);
  });
});

describe("getReadingGoalWheelValueForKey", () => {
  it.each([
    ["ArrowUp", 119],
    ["ArrowDown", 121],
    ["PageUp", 110],
    ["PageDown", 130],
    ["Home", 1],
    ["End", 1440],
  ])("maps %s to %i", (key, expected) => {
    expect(getReadingGoalWheelValueForKey(120, key)).toBe(expected);
  });

  it("returns null for unrelated keys and clamps boundaries", () => {
    expect(getReadingGoalWheelValueForKey(120, "Enter")).toBeNull();
    expect(getReadingGoalWheelValueForKey(1, "ArrowUp")).toBe(1);
    expect(getReadingGoalWheelValueForKey(1440, "ArrowDown")).toBe(1440);
  });
});
```

### Step 2: Run the focused test and verify failure

Run:

```powershell
npm.cmd run test -- lib/readingGoalWheel.test.ts
```

Expected: Vitest fails because the module does not exist.

### Step 3: Implement the wheel helpers

Create `lib/readingGoalWheel.ts` with:

```ts
export const READING_GOAL_MIN_MINUTES = 1;
export const READING_GOAL_MAX_MINUTES = 1440;

export function clampReadingGoalMinutes(value: number): number {
  const rounded = Number.isFinite(value) ? Math.round(value) : READING_GOAL_MIN_MINUTES;
  return Math.min(
    READING_GOAL_MAX_MINUTES,
    Math.max(READING_GOAL_MIN_MINUTES, rounded)
  );
}

export function getReadingGoalWheelValues(value: number): number[] {
  const selected = clampReadingGoalMinutes(value);
  const maxStart = READING_GOAL_MAX_MINUTES - 4;
  const start = Math.min(maxStart, Math.max(READING_GOAL_MIN_MINUTES, selected - 2));
  return Array.from({ length: 5 }, (_, index) => start + index);
}

export function getReadingGoalWheelValueForKey(
  value: number,
  key: string
): number | null {
  const changes: Record<string, number> = {
    ArrowUp: -1,
    ArrowDown: 1,
    PageUp: -10,
    PageDown: 10,
  };

  if (key === "Home") return READING_GOAL_MIN_MINUTES;
  if (key === "End") return READING_GOAL_MAX_MINUTES;
  if (!(key in changes)) return null;
  return clampReadingGoalMinutes(value + changes[key]);
}
```

### Step 4: Run the focused test

Run:

```powershell
npm.cmd run test -- lib/readingGoalWheel.test.ts
```

Expected: all wheel-helper tests pass.

### Step 5: Commit

```powershell
git add lib/readingGoalWheel.ts lib/readingGoalWheel.test.ts
git commit -m "feat: add reading goal wheel logic"
```

## Task 3: Build the Accessible Minute-Wheel Component

**Files:**
- Create: `app/ReadingGoalWheel.tsx`
- Create: `lib/readingGoalWheelIntegration.test.ts`

### Step 1: Write the failing source integration test

Read `app/ReadingGoalWheel.tsx` and assert that it:

- renders `role="spinbutton"`,
- exposes `aria-valuemin`, `aria-valuemax`, and `aria-valuenow`,
- uses `getReadingGoalWheelValues`,
- handles keyboard, wheel, and pointer input,
- and never maps over a 1440-element array.

Use the existing `readFileSync(new URL(..., import.meta.url), "utf8")` source-test pattern.

### Step 2: Run the test and verify failure

Run:

```powershell
npm.cmd run test -- lib/readingGoalWheelIntegration.test.ts
```

Expected: the test fails because the component file does not exist.

### Step 3: Implement `ReadingGoalWheel`

Create a client component with this contract:

```ts
type ReadingGoalWheelProps = {
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
};
```

Implementation requirements:

- Render only the five values from `getReadingGoalWheelValues(value)`.
- Mark the selected row with `aria-hidden` visual rows while the parent exposes spinbutton semantics.
- On `ArrowUp`, `ArrowDown`, `PageUp`, `PageDown`, `Home`, and `End`, call `getReadingGoalWheelValueForKey`, prevent the default scroll, and emit the new value.
- On mouse-wheel input, change one minute in the direction of `deltaY`.
- On pointer down, store `{ pointerId, startY, startValue }` in a ref and call `setPointerCapture`.
- On pointer move, convert each 34 CSS pixels of vertical movement into one minute; upward drag increases and downward drag decreases.
- On pointer up or cancel, release/reset the drag ref.
- Use `touchAction: "none"` through CSS rather than inline style.
- Expose `aria-valuetext={`${value} 分钟`}`.

### Step 4: Run focused tests and lint

Run:

```powershell
npm.cmd run test -- lib/readingGoalWheel.test.ts lib/readingGoalWheelIntegration.test.ts
npm.cmd exec -- eslint app/ReadingGoalWheel.tsx lib/readingGoalWheel.ts
```

Expected: tests and lint pass.

### Step 5: Commit

```powershell
git add app/ReadingGoalWheel.tsx lib/readingGoalWheelIntegration.test.ts
git commit -m "feat: add accessible reading goal wheel"
```

## Task 4: Rewrite the Goal Presentation as a Full-Screen Dialog

**Files:**
- Modify: `app/ReadingGoalSheet.tsx`
- Create: `lib/readingGoalOverlayIntegration.test.ts`

### Step 1: Write the failing overlay integration test

The source test should verify:

- `ReadingGoalSheet.tsx` no longer imports or renders `BottomSheet`.
- The root uses `role="dialog"` and `aria-modal="true"`.
- The component imports and renders `ReadingGoalWheel`.
- The SVG path is an open upper arc using `A ... 0 0 1`.
- The view contains no share or continue-reading callback/action.
- `onSaveGoal` appears only in the confirm path.
- close and Escape paths restore the draft to `targetMinutes` before calling `onClose`.
- focusable elements are cycled on `Tab` and `Shift+Tab`.

### Step 2: Run the test and verify failure

Run:

```powershell
npm.cmd run test -- lib/readingGoalOverlayIntegration.test.ts
```

Expected: assertions fail against the current bottom-sheet implementation.

### Step 3: Replace the component contract and markup

Use this prop contract:

```ts
type ReadingGoalSheetProps = {
  todayMinutes: number;
  targetMinutes: number;
  goalInputValue: number;
  onGoalInputChange: (value: number) => void;
  onSaveGoal: () => void;
  onClose: () => void;
};
```

Remove `bookTitle` and `onContinue`.

The component should:

- derive `arcPercent`, `formatReadingGoalDuration(todayMinutes)`, and `getReadingGoalDisplay(...)`;
- render a fixed full-screen dialog with a safe-area close button;
- render the SVG path `M22 180 A138 138 0 0 1 298 180` for track and progress;
- hide the progress path when percentage is zero and otherwise use `pathLength="100"` plus `strokeDasharray={`${arcPercent} 100`}`;
- show `（目标 ${targetMinutes} 分钟）`;
- show the incomplete or completed Chinese copy defined in the design spec;
- keep the progress content visible while editing;
- show `调整目标` in default state;
- show the wheel and `完成` in editing state.

### Step 4: Add modal behavior and draft semantics

Use refs and effects inside `ReadingGoalSheet`:

- Capture `document.activeElement` on mount and restore it on unmount.
- Focus the close button after mount.
- Query focusable controls inside the dialog and cycle them on `Tab`.
- On `Escape`, call a shared close handler.
- The shared close handler calls `onGoalInputChange(targetMinutes)` before `onClose()`.
- Opening the editor first calls `onGoalInputChange(targetMinutes)`.
- Pressing `完成` calls `onSaveGoal()` and exits editing.
- Do not save from wheel movement, close, Escape, or editor entry.

### Step 5: Run focused tests and lint

Run:

```powershell
npm.cmd run test -- lib/readingGoalDisplay.test.ts lib/readingGoalWheel.test.ts lib/readingGoalWheelIntegration.test.ts lib/readingGoalOverlayIntegration.test.ts
npm.cmd exec -- eslint app/ReadingGoalSheet.tsx app/ReadingGoalWheel.tsx lib/readingGoalDisplay.ts lib/readingGoalWheel.ts
```

Expected: tests and lint pass.

### Step 6: Commit

```powershell
git add app/ReadingGoalSheet.tsx lib/readingGoalOverlayIntegration.test.ts
git commit -m "feat: redesign reading goal as fullscreen dialog"
```

## Task 5: Update Overlay Orchestration Without Moving Persistence

**Files:**
- Modify: `app/AppOverlays.tsx`
- Modify: `lib/readingGoalOverlayIntegration.test.ts`
- Inspect only unless required: `app/page.tsx`

### Step 1: Add failing orchestration assertions

Extend the overlay source test to verify that `AppOverlays`:

- still mounts the goal component from `reader.goalOpen`,
- passes `todayMinutes`, `targetMinutes`, `goalInputValue`, change, save, and close callbacks,
- and no longer passes `bookTitle` or `onContinue` to the goal component.

Also assert that `page.tsx` still:

- resets `goalInputValue` from the persisted target before opening,
- saves through the existing `saveReadingGoal` flow,
- and does not persist on `setGoalInputValue`.

### Step 2: Run the test and verify failure

Run:

```powershell
npm.cmd run test -- lib/readingGoalOverlayIntegration.test.ts
```

Expected: the obsolete goal props fail the new assertions.

### Step 3: Remove obsolete goal props

In `AppOverlays.tsx`:

- remove `bookTitle={reader.bookTitle}` only from `ReadingGoalSheet`;
- remove `onContinue={actions.closeGoal}`;
- keep `reader.bookTitle` for the other overlays that still use it;
- keep all current page-level persistence state and callbacks.

Change `page.tsx` only if TypeScript reveals a now-unused goal-only field or callback.

### Step 4: Run focused tests and type/build validation

Run:

```powershell
npm.cmd run test -- lib/readingGoalOverlayIntegration.test.ts
npm.cmd run build
```

Expected: the integration test and production build pass.

### Step 5: Commit

```powershell
git add app/AppOverlays.tsx app/page.tsx lib/readingGoalOverlayIntegration.test.ts
git commit -m "refactor: update reading goal overlay contract"
```

## Task 6: Replace Bottom-Sheet Styling With the Approved Full-Screen Layout

**Files:**
- Modify: `app/page.module.css`
- Create: `lib/readingGoalCss.test.ts`

### Step 1: Write the failing CSS source test

Assert that the CSS contains:

- a fixed `.goalOverlay` with `inset: 0` and `z-index: 100`;
- safe-area padding using `var(--safe-top)` and `var(--safe-bottom)`;
- a circular close target at least `44px`;
- stable arc dimensions and responsive short-height rules;
- wheel selection-band, row, faded-neighbor, and pointer/touch styles;
- a reduced-motion rule for the overlay/editor;
- no obsolete `.goalSheet` or `.goalContinueButton` rules;
- no hard-coded white full-screen surface.

### Step 2: Run the test and verify failure

Run:

```powershell
npm.cmd run test -- lib/readingGoalCss.test.ts
```

Expected: the new selector assertions fail and obsolete selector assertions fail.

### Step 3: Replace the goal CSS block

Remove `.goalSheet` through `.goalActions` and add styles for:

- `.goalOverlay`: fixed viewport, `z-index: 100`, theme background, centered screen;
- `.goalScreen`: full-height 430px maximum content column with safe-area padding;
- `.goalCloseButton`: 44px circular control in the top-right safe area;
- `.goalProgressRegion`, `.goalArcWrap`, `.goalArc`, `.goalArcCenter`;
- `.goalDuration`, `.goalTargetText`, `.goalDivider`;
- `.goalProgressHeading`, `.goalRemaining`, `.goalStatus`;
- `.goalBottomAction`: stable 52px command area above the bottom safe area;
- `.goalEditor`, `.goalEditorHeading`, `.goalEditorUnit`;
- `.goalWheel`, `.goalWheelBand`, `.goalWheelRows`, `.goalWheelRow`;
- selected, neighboring, and edge-row states;
- focus-visible outlines using the current tint token.

Use theme tokens such as `var(--app-bg)`, `var(--surface-primary)`,
`var(--text-primary)`, `var(--text-secondary)`, `var(--separator)`, and
`var(--tint)`. Use a subtle `0 4px 8px` editor shadow only if the editor also
keeps its hairline border.

Add:

- `@media (max-height: 760px)` to reduce arc size and vertical gaps;
- `@media (prefers-reduced-motion: reduce)` to remove overlay/editor animation;
- no viewport-width font scaling;
- no horizontal overflow.

### Step 4: Run CSS and related source tests

Run:

```powershell
npm.cmd run test -- lib/readingGoalCss.test.ts lib/semanticTokens.test.ts lib/responsiveLayoutCss.test.ts
npm.cmd exec -- eslint app lib
git diff --check
```

Expected: tests, lint, and whitespace validation pass.

### Step 5: Commit

```powershell
git add app/page.module.css lib/readingGoalCss.test.ts
git commit -m "style: match fullscreen reading goal reference"
```

## Task 7: Verify Behavior and Visual Quality

**Files:**
- Modify only if verification finds defects.

### Step 1: Run the full automated suite

Run:

```powershell
npm.cmd run test
npm.cmd exec -- eslint app lib
npm.cmd run build
npm.cmd audit --json
git diff --check
```

Expected:

- all Vitest tests pass;
- ESLint exits zero;
- Next.js production build exits zero;
- audit reports no unresolved production vulnerability requiring a code change;
- `git diff --check` is clean.

### Step 2: Start the development server

Run:

```powershell
npm.cmd run dev -- --hostname 127.0.0.1
```

Keep the returned session running until browser verification is complete. If the default port is occupied, use the port selected by Next.js.

### Step 3: Verify the approved iPhone layouts in the in-app browser

At `390 x 844`, verify:

- default state with target `120`;
- editing state showing `118, 119, 120, 121, 122`;
- the arc is an open upper semicircle rather than an ellipse or closed ring;
- close and bottom actions clear the safe areas;
- no share or continue-reading action appears;
- no overlap, clipping, or horizontal scroll.

Repeat at a shorter iPhone viewport such as `390 x 667`.

### Step 4: Verify interaction and states

Using the browser:

- drag and wheel the picker;
- use all documented keyboard keys;
- close while editing and reopen to confirm the draft was discarded;
- press `完成`, reopen, and confirm the persisted value changed;
- test target values `1`, `120`, and `1440`;
- test zero, partial, completed, and over-target progress;
- test light and dark appearance;
- test 200% zoom;
- inspect browser console errors.

Capture screenshots for default and editing states after final corrections.

### Step 5: Stop the server and inspect the final diff

Stop the dev-server session, then run:

```powershell
git status --short
git diff --stat
git log --oneline -8
```

Expected: only intended implementation/test files are changed or committed, and no generated screenshot or temporary browser artifact is tracked.

### Step 6: Commit any verification fixes

If verification required edits:

```powershell
git add <only-the-files-fixed>
git commit -m "fix: polish reading goal fullscreen behavior"
```

If no edits were required, do not create an empty commit.
