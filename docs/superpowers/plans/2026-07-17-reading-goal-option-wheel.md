# Reading Goal Option Wheel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Reading Goal minute picker with a faithful, accessible React Bits Option Wheel port covering every minute from `0` through `1440`, with one-minute steps, matching motion, blur, fade, drag, wheel, keyboard, and tick-sound behavior.

**Architecture:** Keep `ReadingGoalWheel` controlled by the existing draft/save flow. Port the React Bits target-position and animation-frame model into the component, but render only a 15-row virtual window around the current fractional position. Keep range, visual-state, keyboard, interpolation, and sound-gating decisions in pure helpers so Vitest can establish the contract before the client component is replaced.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS Modules, Vitest, Playwright, local MP3 asset; no new runtime dependency.

---

## Reference and repository constraints

- Approved design: `docs/superpowers/specs/2026-07-17-reading-goal-option-wheel-design.md`
- Visual/behavior reference: <https://reactbits.dev/components/option-wheel?curve=0&tilt=0&smoothing=250&fontSize=1.7>
- Derived source: <https://github.com/DavidHDev/react-bits>
- License: <https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md>
- Reference constants: `fontSize=1.7rem`, `spacing=1.4`, `curve=0`, `tilt=0`, `blur=2`, `fade=0.25`, `minOpacity=0.05`, `smoothing=250`, `loop=false`, `draggable=true`.
- Preserve user work. Do not run `git reset`, `git clean`, or overwrite unrelated changes.
- `HANDOFF.md` requires the full test, lint, production build, and mobile Playwright checks before another code commit. Therefore Tasks 1–5 stay uncommitted while focused red/green checks run; Task 6 performs the complete gate and creates one scoped implementation commit.
- Do not deploy in this plan. Production deployment remains a separate, explicit action.

## Task 1: Establish the `0–1440` domain and pure wheel contract

**Files:**

- Modify: `lib/readingGoal.test.ts`
- Modify: `lib/readingGoal.ts`
- Modify: `lib/readingGoalWheel.test.ts`
- Modify: `lib/readingGoalWheel.ts`

- [ ] **Step 1: Change persistence tests to make zero a valid saved goal**

In `lib/readingGoal.test.ts`, replace the current minimum and negative-value cases with:

```ts
it("persists zero as a valid goal", () => {
  saveReadingGoalToStorage({ targetMinutes: 0 });
  expect(loadReadingGoal().targetMinutes).toBe(0);
});

it("clamps negative targets to zero", () => {
  saveReadingGoalToStorage({ targetMinutes: -5 });
  expect(loadReadingGoal().targetMinutes).toBe(0);
});
```

Keep the default `120`, finite-number fallback, integer-flooring, and maximum `1440` assertions unchanged.

- [ ] **Step 2: Run the persistence test and confirm the intentional failure**

Run:

```powershell
npx vitest run lib/readingGoal.test.ts
```

Expected: the two new cases fail because `clampTargetMinutes` still returns `1` for zero and negative values.

- [ ] **Step 3: Change the persisted goal sanitizer minimum**

In `lib/readingGoal.ts`, change only the lower-bound branch:

```ts
function clampTargetMinutes(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_READING_TARGET_MINUTES;
  }
  const int = Math.floor(value);
  if (int < 0) return 0;
  if (int > 1440) return 1440;
  return int;
}
```

- [ ] **Step 4: Replace wheel-helper tests with the approved motion and virtualization contract**

Replace `lib/readingGoalWheel.test.ts` with tests covering these imports:

```ts
import { describe, expect, it } from "vitest";
import {
  clampReadingGoalMinutes,
  clampReadingGoalWheelPosition,
  getReadingGoalWheelAnimationMix,
  getReadingGoalWheelDragTarget,
  getReadingGoalWheelSelectedValue,
  getReadingGoalWheelValues,
  getReadingGoalWheelValueForKey,
  getReadingGoalWheelVisualState,
  shouldPlayReadingGoalTick,
} from "./readingGoalWheel";
```

Add exact assertions for range and rounding:

```ts
describe("reading goal wheel range", () => {
  it("clamps selected minutes to every integer from zero through 1440", () => {
    expect(clampReadingGoalMinutes(-1)).toBe(0);
    expect(clampReadingGoalMinutes(0)).toBe(0);
    expect(clampReadingGoalMinutes(120.8)).toBe(121);
    expect(clampReadingGoalMinutes(1600)).toBe(1440);
    expect(clampReadingGoalMinutes(Number.NaN)).toBe(0);
  });

  it("keeps finite motion positions fractional while enforcing bounds", () => {
    expect(clampReadingGoalWheelPosition(120.25)).toBe(120.25);
    expect(clampReadingGoalWheelPosition(-0.25)).toBe(0);
    expect(clampReadingGoalWheelPosition(1440.25)).toBe(1440);
    expect(clampReadingGoalWheelPosition(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("settles fractional positions to the nearest minute", () => {
    expect(getReadingGoalWheelSelectedValue(119.49)).toBe(119);
    expect(getReadingGoalWheelSelectedValue(119.5)).toBe(120);
  });

  it("converts pointer pixels into a bounded fractional target", () => {
    expect(getReadingGoalWheelDragTarget(120, 200, 181, 38)).toBe(120.5);
    expect(getReadingGoalWheelDragTarget(0, 100, 140, 38)).toBe(0);
    expect(getReadingGoalWheelDragTarget(120, 100, 80, 0)).toBe(120);
    expect(
      getReadingGoalWheelDragTarget(120, Number.NaN, 80, 38)
    ).toBe(120);
  });
});
```

Add exact virtualization assertions:

```ts
describe("getReadingGoalWheelValues", () => {
  it("renders fifteen values around an ordinary position", () => {
    expect(getReadingGoalWheelValues(120)).toEqual(
      Array.from({ length: 15 }, (_, index) => 113 + index)
    );
  });

  it("shifts the same bounded window at both ends", () => {
    expect(getReadingGoalWheelValues(0)).toEqual(
      Array.from({ length: 15 }, (_, index) => index)
    );
    expect(getReadingGoalWheelValues(1440)).toEqual(
      Array.from({ length: 15 }, (_, index) => 1426 + index)
    );
  });
});
```

Add reference-style visual assertions:

```ts
describe("getReadingGoalWheelVisualState", () => {
  it("matches the reference blur and fade falloff", () => {
    expect(getReadingGoalWheelVisualState(120, 120)).toEqual({
      offsetSteps: 0,
      blurPx: 0,
      opacity: 1,
      emphasis: 1,
    });
    expect(getReadingGoalWheelVisualState(121, 120)).toEqual({
      offsetSteps: 1,
      blurPx: 2,
      opacity: 0.75,
      emphasis: 0,
    });
    expect(getReadingGoalWheelVisualState(127, 120)).toEqual({
      offsetSteps: 7,
      blurPx: 14,
      opacity: 0.05,
      emphasis: 0,
    });
  });

  it("preserves fractional offsets while moving", () => {
    expect(getReadingGoalWheelVisualState(121, 120.25)).toEqual({
      offsetSteps: 0.75,
      blurPx: 1.5,
      opacity: 0.8125,
      emphasis: 0.25,
    });
  });
});
```

Add keyboard, smoothing, and sound-gate assertions:

```ts
describe("wheel controls", () => {
  it.each([
    ["ArrowUp", 119],
    ["ArrowDown", 121],
    ["PageUp", 110],
    ["PageDown", 130],
    ["Home", 0],
    ["End", 1440],
  ])("maps %s to %i", (key, expected) => {
    expect(getReadingGoalWheelValueForKey(120, key)).toBe(expected);
  });

  it("does not loop beyond the range", () => {
    expect(getReadingGoalWheelValueForKey(0, "ArrowUp")).toBe(0);
    expect(getReadingGoalWheelValueForKey(1440, "ArrowDown")).toBe(1440);
    expect(getReadingGoalWheelValueForKey(120, "Enter")).toBeNull();
  });

  it("uses exponential smoothing and handles invalid frames", () => {
    expect(getReadingGoalWheelAnimationMix(0, 250)).toBe(0);
    expect(getReadingGoalWheelAnimationMix(250, 250)).toBeCloseTo(1 - Math.exp(-1));
    expect(getReadingGoalWheelAnimationMix(16, 0)).toBe(1);
    expect(getReadingGoalWheelAnimationMix(Number.NaN, 250)).toBe(1);
  });

  it("rate-limits ticks and requires a changed selected minute", () => {
    expect(shouldPlayReadingGoalTick(120, 121, 1000, 0)).toBe(true);
    expect(shouldPlayReadingGoalTick(120, 120, 1000, 0)).toBe(false);
    expect(shouldPlayReadingGoalTick(120, 121, 1020, 1000)).toBe(false);
    expect(shouldPlayReadingGoalTick(120, 121, 1040, 1000)).toBe(true);
  });
});
```

- [ ] **Step 5: Run the helper tests and confirm they fail against the old five-row implementation**

Run:

```powershell
npx vitest run lib/readingGoalWheel.test.ts
```

Expected: failures for minimum zero, missing helper exports, and the 15-row window.

- [ ] **Step 6: Implement the pure helper contract**

Replace `lib/readingGoalWheel.ts` with:

```ts
export const READING_GOAL_MIN_MINUTES = 0;
export const READING_GOAL_MAX_MINUTES = 1440;
export const READING_GOAL_WHEEL_VIRTUAL_RADIUS = 7;
export const READING_GOAL_WHEEL_SMOOTHING_MS = 250;
export const READING_GOAL_WHEEL_TICK_INTERVAL_MS = 36;

export function clampReadingGoalWheelPosition(value: number): number {
  if (!Number.isFinite(value)) return READING_GOAL_MIN_MINUTES;
  return Math.min(
    READING_GOAL_MAX_MINUTES,
    Math.max(READING_GOAL_MIN_MINUTES, value)
  );
}

export function clampReadingGoalMinutes(value: number): number {
  return Math.round(clampReadingGoalWheelPosition(value));
}

export function getReadingGoalWheelSelectedValue(position: number): number {
  return clampReadingGoalMinutes(position);
}

export function getReadingGoalWheelDragTarget(
  target: number,
  previousY: number,
  nextY: number,
  rowHeightPx: number
): number {
  const safeTarget = clampReadingGoalWheelPosition(target);
  if (
    !Number.isFinite(previousY) ||
    !Number.isFinite(nextY) ||
    !Number.isFinite(rowHeightPx) ||
    rowHeightPx <= 0
  ) {
    return safeTarget;
  }
  return clampReadingGoalWheelPosition(
    safeTarget + (previousY - nextY) / rowHeightPx
  );
}

export function getReadingGoalWheelValues(
  position: number,
  radius = READING_GOAL_WHEEL_VIRTUAL_RADIUS
): number[] {
  const safeRadius = Math.max(0, Math.floor(Number.isFinite(radius) ? radius : 0));
  const length = Math.min(
    READING_GOAL_MAX_MINUTES - READING_GOAL_MIN_MINUTES + 1,
    safeRadius * 2 + 1
  );
  const center = getReadingGoalWheelSelectedValue(position);
  const maxStart = READING_GOAL_MAX_MINUTES - length + 1;
  const start = Math.min(
    maxStart,
    Math.max(READING_GOAL_MIN_MINUTES, center - safeRadius)
  );
  return Array.from({ length }, (_, index) => start + index);
}

export type ReadingGoalWheelVisualState = {
  offsetSteps: number;
  blurPx: number;
  opacity: number;
  emphasis: number;
};

export function getReadingGoalWheelVisualState(
  itemValue: number,
  position: number
): ReadingGoalWheelVisualState {
  const offsetSteps = itemValue - clampReadingGoalWheelPosition(position);
  const distance = Math.abs(offsetSteps);
  return {
    offsetSteps,
    blurPx: distance * 2,
    opacity: Math.max(0.05, 1 - distance * 0.25),
    emphasis: Math.max(0, 1 - distance),
  };
}

export function getReadingGoalWheelAnimationMix(
  elapsedMs: number,
  smoothingMs = READING_GOAL_WHEEL_SMOOTHING_MS
): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return 1;
  if (!Number.isFinite(smoothingMs) || smoothingMs <= 0) return 1;
  return 1 - Math.exp(-elapsedMs / smoothingMs);
}

export function shouldPlayReadingGoalTick(
  previousValue: number,
  nextValue: number,
  nowMs: number,
  lastTickMs: number
): boolean {
  return (
    previousValue !== nextValue &&
    Number.isFinite(nowMs) &&
    Number.isFinite(lastTickMs) &&
    nowMs - lastTickMs >= READING_GOAL_WHEEL_TICK_INTERVAL_MS
  );
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

- [ ] **Step 7: Run the focused domain tests**

Run:

```powershell
npx vitest run lib/readingGoal.test.ts lib/readingGoalWheel.test.ts lib/readingGoalDisplay.test.ts
```

Expected: all tests pass, including the existing target-zero progress-display behavior.

## Task 2: Add React Bits attribution and the local selection tick

**Files:**

- Create: `THIRD_PARTY_NOTICES.md`
- Create: `public/assets/sounds/click-soft.mp3`
- Create: `lib/reactBitsOptionWheelAttribution.test.ts`

- [ ] **Step 1: Add a failing repository-attribution test**

Create `lib/reactBitsOptionWheelAttribution.test.ts`:

```ts
import { existsSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

const noticeUrl = new URL("../THIRD_PARTY_NOTICES.md", import.meta.url);
const soundUrl = new URL(
  "../public/assets/sounds/click-soft.mp3",
  import.meta.url
);

describe("React Bits Option Wheel attribution", () => {
  it("retains the upstream identity, copyright, license condition, and links", () => {
    expect(existsSync(noticeUrl)).toBe(true);
    const notice = readFileSync(noticeUrl, "utf8");
    expect(notice).toContain("React Bits Option Wheel");
    expect(notice).toContain("Copyright (c) 2026 David Haz");
    expect(notice).toContain("Commons Clause License Condition v1.0");
    expect(notice).toContain("https://github.com/DavidHDev/react-bits");
    expect(notice).toContain(
      "https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md"
    );
  });

  it("ships the referenced local tick asset", () => {
    expect(existsSync(soundUrl)).toBe(true);
    expect(statSync(soundUrl).size).toBeGreaterThan(100);
  });
});
```

- [ ] **Step 2: Run the attribution test and confirm missing-file failures**

Run:

```powershell
npx vitest run lib/reactBitsOptionWheelAttribution.test.ts
```

Expected: failure because the notice and local sound do not exist yet.

- [ ] **Step 3: Add the third-party notice**

Create `THIRD_PARTY_NOTICES.md` with a `React Bits Option Wheel` section that includes:

- component and repository name;
- `Copyright (c) 2026 David Haz`;
- both upstream links from the test;
- the complete MIT permission/warranty text from the upstream `LICENSE.md`;
- the complete `Commons Clause License Condition v1.0` text from the same upstream file;
- a note that AI Reader uses the derived component and tick asset inside the application and does not redistribute them as a standalone component library.

Copy the license text exactly from the upstream license URL; do not paraphrase legal text.

- [ ] **Step 4: Download the exact reference tick asset without touching other public assets**

Run:

```powershell
New-Item -ItemType Directory -Force public\assets\sounds | Out-Null
Invoke-WebRequest -Uri "https://reactbits.dev/assets/sounds/click-soft.mp3" -OutFile "public\assets\sounds\click-soft.mp3"
Get-Item public\assets\sounds\click-soft.mp3 | Select-Object FullName, Length
Get-FileHash public\assets\sounds\click-soft.mp3 -Algorithm SHA256
```

Expected: the file exists, has a nonzero length greater than 100 bytes, and PowerShell reports a SHA-256 hash for the downloaded bytes.

- [ ] **Step 5: Re-run the attribution test**

Run:

```powershell
npx vitest run lib/reactBitsOptionWheelAttribution.test.ts
```

Expected: 2 tests pass.

## Task 3: Port the virtualized React Bits interaction model

**Files:**

- Modify: `lib/readingGoalWheelIntegration.test.ts`
- Modify: `app/ReadingGoalWheel.tsx`

- [ ] **Step 1: Replace integration source assertions with the derived-component contract**

Update `lib/readingGoalWheelIntegration.test.ts` so it checks all of the following source-level contracts:

```ts
it("documents the derived source and license", () => {
  expect(source).toContain("Derived from React Bits Option Wheel");
  expect(source).toContain("github.com/DavidHDev/react-bits");
  expect(source).toContain("THIRD_PARTY_NOTICES.md");
});

it("keeps a controlled accessible bounded spinbutton", () => {
  expect(source).toContain('role="spinbutton"');
  expect(source).toContain("aria-valuemin={READING_GOAL_MIN_MINUTES}");
  expect(source).toContain("aria-valuemax={READING_GOAL_MAX_MINUTES}");
  expect(source).toContain("aria-valuenow={selectedValue}");
  expect(source).toContain("aria-valuetext={`${selectedValue} 分钟`}");
  expect(source).toContain("onChangeRef.current(nextValue)");
});

it("ports target smoothing, drag, wheel settling, and cleanup", () => {
  expect(source).toContain("requestAnimationFrame(animate)");
  expect(source).toContain("getReadingGoalWheelAnimationMix");
  expect(source).toContain("getReadingGoalWheelDragTarget");
  expect(source).toContain("setPointerCapture");
  expect(source).toContain("wheelTimerRef.current = window.setTimeout");
  expect(source).toContain("window.matchMedia(\"(prefers-reduced-motion: reduce)\")");
  expect(source).toContain("cancelAnimationFrame(rafRef.current)");
  expect(source).toContain("window.clearTimeout(wheelTimerRef.current)");
  expect(source).toContain("audioRef.current?.pause()");
});

it("renders only the virtual window and exposes stable browser hooks", () => {
  expect(source).toContain("getReadingGoalWheelValues(renderCenter)");
  expect(source).toContain("visibleValues.map");
  expect(source).toContain('data-reading-goal-wheel="true"');
  expect(source).toContain('data-reading-goal-wheel-row="true"');
  expect(source).not.toContain("Array.from({ length: 1441");
});

it("loads and rate-limits the nonessential local selection tick", () => {
  expect(source).toContain('new Audio("/assets/sounds/click-soft.mp3")');
  expect(source).toContain("shouldPlayReadingGoalTick");
  expect(source).toContain("void audio.play().catch(() => undefined)");
});
```

Retain the pointer, wheel, keyboard event-handler assertions, but update them to the new handler names used in Step 3.

- [ ] **Step 2: Run the integration test and confirm the old component fails the port contract**

Run:

```powershell
npx vitest run lib/readingGoalWheelIntegration.test.ts
```

Expected: failures for attribution, requestAnimationFrame smoothing, audio, reduced motion, cleanup, and browser hooks.

- [ ] **Step 3: Replace `ReadingGoalWheel` with the TypeScript port**

Implement these exact component constants and ref shapes near the top of `app/ReadingGoalWheel.tsx`:

```ts
const FONT_SIZE_REM = 1.7;
const SPACING = 1.4;
const ROW_HEIGHT_REM = FONT_SIZE_REM * SPACING;
const WHEEL_SETTLE_MS = 90;

type PointerDrag = {
  pointerId: number;
  lastY: number;
};
```

The component must use:

- `positionRef` for the current fractional visual position;
- `targetRef` for the bounded destination;
- `selectedRef` for the last emitted whole minute;
- `renderCenter` state only when the rounded minute crosses into a new virtual window;
- `rowRefs` keyed by minute for per-frame `transform`, `filter`, `opacity`, `fontWeight`, and color updates;
- `lastFrameRef`, `rafRef`, `wheelTimerRef`, `dragRef`, `audioRef`, and `lastTickRef` for lifecycle-safe interaction state;
- `onChangeRef` so the animation loop always calls the latest parent callback without restarting.

Place this attribution directly above the component:

```ts
// Derived from React Bits Option Wheel:
// https://github.com/DavidHDev/react-bits
// License and Commons Clause notice: ../THIRD_PARTY_NOTICES.md
```

Implement a `playTick(nextValue)` callback with this behavior:

```ts
const now = performance.now();
if (
  !shouldPlayReadingGoalTick(
    selectedRef.current,
    nextValue,
    now,
    lastTickRef.current
  )
) {
  return;
}
lastTickRef.current = now;
const audio = audioRef.current ?? new Audio("/assets/sounds/click-soft.mp3");
audio.preload = "auto";
audio.volume = 0.5;
audioRef.current = audio;
audio.currentTime = 0;
void audio.play().catch(() => undefined);
```

Implement `emitSelection(position)` so it rounds/clamps with `getReadingGoalWheelSelectedValue`, updates `renderCenter`, plays the tick before updating `selectedRef`, and calls `onChangeRef.current(nextValue)` only when the selected minute changed.

Implement `paintRows(position)` by iterating the current row-ref map and applying the pure visual state:

```ts
const visual = getReadingGoalWheelVisualState(itemValue, position);
row.style.transform = `translateY(calc(-50% + ${visual.offsetSteps * ROW_HEIGHT_REM}rem))`;
row.style.filter = `blur(${visual.blurPx}px)`;
row.style.opacity = String(visual.opacity);
row.style.fontWeight = String(400 + visual.emphasis * 100);
row.style.color =
  visual.emphasis > 0.5 ? "var(--text-primary)" : "var(--text-secondary)";
```

Implement the animation frame using the reference target-position model:

```ts
const elapsed = Math.min(64, Math.max(0, timestamp - lastFrameRef.current));
lastFrameRef.current = timestamp;
const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;
const mix = reducedMotion
  ? 1
  : getReadingGoalWheelAnimationMix(elapsed, READING_GOAL_WHEEL_SMOOTHING_MS);
const current = positionRef.current;
const target = targetRef.current;
const next = Math.abs(target - current) < 0.001
  ? target
  : clampReadingGoalWheelPosition(current + (target - current) * mix);
positionRef.current = next;
paintRows(next);
emitSelection(next);
rafRef.current = requestAnimationFrame(animate);
```

Start one animation frame loop on mount. On controlled `value` changes, clamp the incoming integer, synchronize `targetRef`, `positionRef`, `selectedRef`, and `renderCenter` only when the incoming value differs from the component's last emitted selection. This prevents parent echoes from restarting an in-progress drag.

Input behavior:

- Pointer down focuses the root, cancels the wheel-settle timer, stores `pointerId` and `lastY`, marks dragging, and captures the pointer.
- Pointer move calls `getReadingGoalWheelDragTarget(targetRef.current, drag.lastY, event.clientY, measuredRowHeight)`, writes the returned fractional position to `targetRef`, updates `lastY`, and does not mutate 1,441 DOM nodes.
- Pointer up/cancel releases capture, clears the drag ref, removes dragging state, and sets `targetRef` to the nearest valid integer.
- Wheel prevents default, adds `event.deltaY / measuredRowHeight` to `targetRef`, clamps it, then resets a 90ms timer that settles to the nearest minute.
- Keyboard gets the next integer from `getReadingGoalWheelValueForKey`, prevents default, synchronizes target position, and emits immediately in reduced-motion mode while the regular animation handles the visual interpolation otherwise.

Render exactly one focusable root and presentation-only rows:

```tsx
<div
  className={[styles.goalWheel, isDragging ? styles.goalWheelDragging : ""]
    .filter(Boolean)
    .join(" ")}
  data-reading-goal-wheel="true"
  data-selected-minute={selectedValue}
  role="spinbutton"
  tabIndex={0}
  aria-label={ariaLabel}
  aria-valuemin={READING_GOAL_MIN_MINUTES}
  aria-valuemax={READING_GOAL_MAX_MINUTES}
  aria-valuenow={selectedValue}
  aria-valuetext={`${selectedValue} 分钟`}
  onKeyDown={handleKeyDown}
  onWheel={handleWheel}
  onPointerDown={handlePointerDown}
  onPointerMove={handlePointerMove}
  onPointerUp={finishPointerDrag}
  onPointerCancel={finishPointerDrag}
>
  <div className={styles.goalWheelRows} aria-hidden="true">
    {visibleValues.map((itemValue) => (
      <div
        key={itemValue}
        ref={(node) => {
          if (node) rowRefs.current.set(itemValue, node);
          else rowRefs.current.delete(itemValue);
        }}
        className={styles.goalWheelRow}
        data-reading-goal-wheel-row="true"
        data-minute={itemValue}
      >
        {itemValue}
      </div>
    ))}
  </div>
</div>
```

Use `selectedValue` as component state initialized from the clamped `value`. Compute `visibleValues` from `getReadingGoalWheelValues(renderCenter)`.

Cleanup must cancel the active animation frame, clear the wheel timer, release component refs, pause audio, reset its time to zero, and set `audioRef.current = null`. Guard `Audio` and `window` availability so SSR and restricted browsers remain safe.

- [ ] **Step 4: Run helper and integration tests**

Run:

```powershell
npx vitest run lib/readingGoalWheel.test.ts lib/readingGoalWheelIntegration.test.ts lib/reactBitsOptionWheelAttribution.test.ts
```

Expected: all tests pass.

## Task 4: Match the reference appearance across product themes

**Files:**

- Modify: `lib/readingGoalCss.test.ts`
- Modify: `app/page.module.css`

- [ ] **Step 1: Replace obsolete CSS expectations with the reference contract**

In `lib/readingGoalCss.test.ts`, change the wheel assertions to require:

```ts
it("uses the frameless React Bits wheel geometry", () => {
  expect(css).toContain(".goalWheelRows");
  expect(css).toContain(".goalWheelRow");
  expect(css).not.toContain(".goalWheelBand");
  expect(css).not.toContain(".goalWheelRowSelected");
  expect(css).not.toContain(".goalWheelRowNeighbor");
  expect(css).not.toContain(".goalWheelRowEdge");
  expect(css).toMatch(
    /\.goalWheel\s*\{[\s\S]*?height:\s*220px;[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;[\s\S]*?touch-action:\s*none;/
  );
  expect(css).toMatch(
    /\.goalWheelRow\s*\{[\s\S]*?height:\s*2\.38rem;[\s\S]*?font-size:\s*1\.7rem;/
  );
});

it("keeps theme tokens and avoids a permanent animation layer", () => {
  const start = css.indexOf(".goalWheelRow {");
  const end = css.indexOf("}", start);
  const rule = css.slice(start, end);
  expect(rule).toContain("color: var(--text-secondary);");
  expect(rule).not.toContain("will-change");
  expect(rule).not.toMatch(/color:\s*#(?:fff|ffffff|000|000000);/);
});
```

Update the short-screen assertion to require `.goalWheel { height: 190px; }` inside `@media (max-height: 760px)`. Keep the existing full-screen sheet, reduced-motion, focus, and obsolete-sheet-style assertions.

- [ ] **Step 2: Run the CSS test and confirm failures against the card-like wheel**

Run:

```powershell
npx vitest run lib/readingGoalCss.test.ts
```

Expected: failures for the band, border, background, shadow, old row classes, and missing reference dimensions.

- [ ] **Step 3: Replace only the wheel CSS block**

In `app/page.module.css`, replace `.goalWheel` through `.goalWheelRowEdge` with:

```css
.goalWheel {
  position: relative;
  width: 100%;
  height: 220px;
  margin-top: 10px;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.goalWheelDragging {
  cursor: grabbing;
}

.goalWheelRows {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.goalWheelRow {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 2.38rem;
  color: var(--text-secondary);
  font-size: 1.7rem;
  font-weight: 400;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  transform: translateY(-50%);
  transform-origin: center;
}
```

Remove the wheel gradient pseudo-elements and all `.goalWheelBand`, `.goalWheelRowSelected`, `.goalWheelRowNeighbor`, and `.goalWheelRowEdge` rules. Retain the existing shared `:focus-visible` rule.

Inside `@media (max-height: 760px)`, add:

```css
.goalWheel {
  height: 190px;
}
```

In the reduced-motion media query, remove `.goalWheelRow` from the transition list because per-frame transforms do not use CSS transitions. Do not add permanent `will-change`; the control has only 15 rows and runs only simple style updates.

- [ ] **Step 4: Run focused styling and interaction tests**

Run:

```powershell
npx vitest run lib/readingGoalCss.test.ts lib/readingGoalWheelIntegration.test.ts lib/readingGoalWheel.test.ts
```

Expected: all tests pass.

## Task 5: Prove the user flow on both iPhone projects

**Files:**

- Create: `e2e/reading-goal-wheel.spec.ts`

- [ ] **Step 1: Add shared setup for the existing Reading Goal flow**

Create `e2e/reading-goal-wheel.spec.ts` using `@playwright/test`. Copy the small `waitForLibrary`, TXT `importBook`, and `openReading` helpers from `e2e/reading-dashboard.spec.ts`, then add:

```ts
const readingRoot =
  '[data-navigation-root="reading"][aria-hidden="false"]';
const wheelSelector = '[data-reading-goal-wheel="true"]';

async function openGoalEditor(page: Page) {
  await page.locator(`${readingRoot} [data-reading-goal="true"]`).click();
  await expect(page.getByRole("dialog", { name: "阅读目标" })).toBeVisible();
  await page.getByRole("button", { name: "调整目标" }).click();
  await expect(page.locator(wheelSelector)).toBeVisible();
}
```

If the shared BottomSheet exposes a different semantic role in the current DOM, inspect it and use that existing role; do not modify `BottomSheet` solely for this test.

- [ ] **Step 2: Add the virtualized reference-style rendering test**

```ts
test("renders the reference falloff with a bounded virtual window", async ({
  page,
}) => {
  await importBook(page);
  await openReading(page);
  await openGoalEditor(page);

  const wheel = page.locator(wheelSelector);
  const rows = wheel.locator('[data-reading-goal-wheel-row="true"]');
  await expect(wheel).toHaveAttribute("aria-valuemin", "0");
  await expect(wheel).toHaveAttribute("aria-valuemax", "1440");
  await expect(wheel).toHaveAttribute("aria-valuenow", "120");
  await expect(rows).toHaveCount(15);

  const center = rows.filter({ hasText: /^120$/ });
  const neighbor = rows.filter({ hasText: /^121$/ });
  await expect(center).toHaveCSS("opacity", "1");
  await expect(center).toHaveCSS("filter", "blur(0px)");
  await expect(neighbor).toHaveCSS("opacity", "0.75");
  await expect(neighbor).toHaveCSS("filter", "blur(2px)");
});
```

Add a theme-token assertion in the same test after the falloff checks:

```ts
const shell = page.locator('[data-app-shell="true"]');
await shell.evaluate((element) => element.setAttribute("data-reader-theme", "light"));
const lightColor = await center.evaluate(
  (element) => getComputedStyle(element).color
);
await shell.evaluate((element) => element.setAttribute("data-reader-theme", "dark"));
const darkColor = await center.evaluate(
  (element) => getComputedStyle(element).color
);
expect(lightColor).not.toBe("rgba(0, 0, 0, 0)");
expect(darkColor).not.toBe("rgba(0, 0, 0, 0)");
expect(darkColor).not.toBe(lightColor);
```

This proves that the center emphasis follows product theme tokens instead of a hard-coded demo color.

- [ ] **Step 3: Add keyboard bounds and persistence coverage**

```ts
test("reaches both bounds in one-minute steps and saves zero", async ({ page }) => {
  await importBook(page);
  await openReading(page);
  await openGoalEditor(page);

  const wheel = page.locator(wheelSelector);
  await wheel.focus();
  await wheel.press("ArrowDown");
  await expect(wheel).toHaveAttribute("aria-valuenow", "121");
  await wheel.press("Home");
  await expect(wheel).toHaveAttribute("aria-valuenow", "0");
  await wheel.press("ArrowUp");
  await expect(wheel).toHaveAttribute("aria-valuenow", "0");
  await page.getByRole("button", { name: "完成" }).click();

  await page.reload();
  await waitForLibrary(page);
  await openReading(page);
  await openGoalEditor(page);
  await expect(page.locator(wheelSelector)).toHaveAttribute("aria-valuenow", "0");

  await page.locator(wheelSelector).press("End");
  await expect(page.locator(wheelSelector)).toHaveAttribute(
    "aria-valuenow",
    "1440"
  );
  await page.locator(wheelSelector).press("ArrowDown");
  await expect(page.locator(wheelSelector)).toHaveAttribute(
    "aria-valuenow",
    "1440"
  );
});
```

Use the actual `UI_TEXT.DONE` accessible name observed in the page if it differs from `完成`.

- [ ] **Step 4: Add unsaved-close, pointer/wheel, and sound-tolerance coverage**

Add one test that:

1. injects a `HTMLMediaElement.prototype.play` spy returning `Promise.resolve()` before opening the editor;
2. uses a trackpad-sized wheel delta or a short pointer drag to change the draft;
3. waits for settling and asserts `aria-valuenow` changed by at least one minute;
4. asserts the play spy was called;
5. closes the sheet without pressing Done;
6. reopens the editor and confirms the saved target remains `120`.

Keep the assertion value-based rather than pixel-perfect for the drag because Playwright device scale factors differ between the two iPhone projects. Add a separate page init that makes `play()` return a rejected promise, interact once, and assert the minute still changes; this proves sound failure is non-blocking.

During the successful-sound path, dispatch 40 small wheel events inside one `page.evaluate` call, measure only that synchronous dispatch block with `performance.now()`, and assert it completes below 50ms while the rendered row count remains exactly 15. This bounded check catches an accidental regression to updating all 1,441 values per input without relying on development-server navigation timing.

- [ ] **Step 5: Add reduced-motion coverage**

Use `page.emulateMedia({ reducedMotion: "reduce" })`, open the editor, press `ArrowDown`, and assert `aria-valuenow="121"` without a timer wait. Confirm the row count remains 15 and the center row remains unblurred.

- [ ] **Step 6: Run the new spec on each configured mobile project**

Run:

```powershell
npx playwright test e2e/reading-goal-wheel.spec.ts --project=iphone-14
npx playwright test e2e/reading-goal-wheel.spec.ts --project=iphone-15-pro-max
```

Expected: every goal-wheel test passes on both projects. Inspect retained traces or failure screenshots before changing timing assertions; do not hide real interaction failures with broad sleeps.

## Task 6: Complete the HANDOFF verification gate and commit

**Files:**

- Modify: `HANDOFF.md`

- [ ] **Step 1: Review the complete change before running the expensive gate**

Run:

```powershell
git status -sb
git diff --stat
git diff --check
git diff -- lib/readingGoal.ts lib/readingGoalWheel.ts app/ReadingGoalWheel.tsx app/page.module.css
rg -n "[T]ODO|[T]BD|[F]IXME" docs/superpowers/plans/2026-07-17-reading-goal-option-wheel.md app/ReadingGoalWheel.tsx lib/readingGoalWheel.ts e2e/reading-goal-wheel.spec.ts
```

Expected: only the files named in this plan are changed, `git diff --check` is silent, and the placeholder scan finds no unfinished implementation markers.

- [ ] **Step 2: Run the complete unit and source-integration suite**

Run:

```powershell
npm test
```

Expected: all Vitest files and tests pass with no unhandled rejection.

- [ ] **Step 3: Run lint and production build**

Run:

```powershell
npm run lint
npm run build
```

Expected: ESLint exits zero and the Next.js production build completes successfully.

- [ ] **Step 4: Run the relevant complete mobile browser suites**

Run:

```powershell
npx playwright test e2e/reading-goal-wheel.spec.ts e2e/reading-dashboard.spec.ts e2e/native-navigation.spec.ts --project=iphone-14
npx playwright test e2e/reading-goal-wheel.spec.ts e2e/reading-dashboard.spec.ts e2e/native-navigation.spec.ts --project=iphone-15-pro-max
```

Expected: all listed specs pass for both iPhone viewports, with bounded wheel row count and no regression to Reading dashboard or native navigation.

- [ ] **Step 5: Update the handoff with verified local state**

In `HANDOFF.md`, record:

- the Option Wheel implementation and approved reference URL;
- `0–1440`, one-minute steps, non-looping bounds, sound, virtual row count, and reduced-motion behavior;
- the exact Vitest, lint, build, and Playwright commands just run and their pass counts;
- the React Bits attribution and local asset paths;
- that the implementation is committed locally but not deployed, so the existing Worker version and production URL remain unchanged;
- the new commit hash after Step 6.

Do not remove still-relevant handoff history or deployment information.

- [ ] **Step 6: Commit the verified implementation as one scoped code commit**

Run:

```powershell
git add HANDOFF.md THIRD_PARTY_NOTICES.md public/assets/sounds/click-soft.mp3 app/ReadingGoalWheel.tsx app/page.module.css lib/readingGoal.ts lib/readingGoal.test.ts lib/readingGoalWheel.ts lib/readingGoalWheel.test.ts lib/readingGoalWheelIntegration.test.ts lib/readingGoalCss.test.ts lib/reactBitsOptionWheelAttribution.test.ts e2e/reading-goal-wheel.spec.ts
git diff --cached --check
git diff --cached --stat
git commit -m "feat: port reading goal option wheel"
```

Expected: one commit is created only after the complete HANDOFF gate passes. If `HANDOFF.md` needs the just-created hash, amend only that handoff line after inserting the hash, re-run `git diff --cached --check`, and use `git commit --amend --no-edit`; do not amend unrelated history.

- [ ] **Step 7: Report the final repository state without publishing**

Run:

```powershell
git status -sb
git log -3 --oneline --decorate
```

Expected: the worktree is clean, the new feature commit is at `HEAD`, and the branch is ahead of its upstream. Report that deployment was intentionally not performed.
