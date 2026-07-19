# Bottom Sheet Settle Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an explicit settle phase so a bottom sheet that is released without dismissal returns to rest with a dedicated, interruptible motion.

**Architecture:** Keep the shared `BottomSheet` component as the single interaction owner. Add a `settling` phase, a CSS class for that phase, and one motion token while preserving existing helper-based dismissal logic and source/CSS regression tests.

**Tech Stack:** Next.js App Router, React, TypeScript, CSS Modules, Vitest.

---

## File Structure

- `lib/motionInteractions.test.ts`: extend phase coverage so `settling` is interruptible.
- `lib/motionCss.test.ts`: add CSS contract assertions for the settle token and settle class.
- `lib/motionInteractions.ts`: allow `settling` in `canInterruptSheetPhase`.
- `app/BottomSheet.tsx`: add the `settling` phase, set it after a non-dismissed drag release, and return to `open` after the transform transition.
- `app/page.module.css`: define `--motion-sheet-settle`, style `.motionSheetSettling`, and include reduced-motion coverage through the existing reduced-motion rules.

---

### Task 1: Add Failing Settle Tests

**Files:**
- Modify: `lib/motionInteractions.test.ts`
- Modify: `lib/motionCss.test.ts`

- [ ] **Step 1: Update interaction helper test**

In `lib/motionInteractions.test.ts`, update the first `canInterruptSheetPhase` test to include `settling`:

```ts
describe("canInterruptSheetPhase", () => {
  it("allows the sheet to be grabbed during entry, rest, settling, and dismissal", () => {
    expect(canInterruptSheetPhase("entering")).toBe(true);
    expect(canInterruptSheetPhase("open")).toBe(true);
    expect(canInterruptSheetPhase("settling")).toBe(true);
    expect(canInterruptSheetPhase("closing")).toBe(true);
  });

  it("rejects unknown phases defensively", () => {
    expect(canInterruptSheetPhase("unknown")).toBe(false);
  });
});
```

- [ ] **Step 2: Update motion CSS contract test**

In `lib/motionCss.test.ts`, extend the navigation timing test with settle token and class assertions:

```ts
expect(css).toContain("--motion-sheet-settle: 220ms;");
expect(css).toMatch(
  /\.motionSheetSettling\s+\.bottomSheet\s*\{[^}]*transition-duration:\s*var\(--motion-sheet-settle\)[^}]*transition-timing-function:\s*var\(--ease-sheet-settle\)/s
);
```

Also extend the reduced-motion sheet test coverage by adding a focused assertion near the sheet motion tests:

```ts
expect(css).toMatch(
  /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.app,[\s\S]*?transition-duration:\s*0\.001ms !important;/s
);
```

- [ ] **Step 3: Run tests and verify RED**

Run:

```powershell
npm.cmd run test -- lib/motionInteractions.test.ts lib/motionCss.test.ts
```

Expected: FAIL. The helper test should fail because `canInterruptSheetPhase("settling")` returns `false`, and the CSS test should fail because `--motion-sheet-settle` and `.motionSheetSettling` do not exist yet.

---

### Task 2: Implement Settle Phase

**Files:**
- Modify: `lib/motionInteractions.ts`
- Modify: `app/BottomSheet.tsx`
- Modify: `app/page.module.css`

- [ ] **Step 1: Allow settling phase interruption**

In `lib/motionInteractions.ts`, update `canInterruptSheetPhase`:

```ts
export function canInterruptSheetPhase(phase: string): boolean {
  return phase === "entering" || phase === "open" || phase === "settling" || phase === "closing";
}
```

- [ ] **Step 2: Add `settling` to `BottomSheet` phase handling**

In `app/BottomSheet.tsx`, change the phase type:

```ts
type SheetPhase = "entering" | "open" | "settling" | "closing";
```

Update `handlePanelTransitionEnd` so settling completes on the panel transform transition:

```ts
  if (
    phase === "settling" &&
    isSheetCloseTransition({
      propertyName: event.propertyName,
      targetIsPanel: event.target === event.currentTarget,
    })
  ) {
    setPhase("open");
    return;
  }
```

Keep the existing closing transition handling after that block.

- [ ] **Step 3: Set settling after an undecided drag**

In `finishDrag`, after `panel.style.removeProperty("transition");` and after the dismissal branch, set the phase to `settling` before resetting the drag variable:

```ts
    setPhase("settling");
    window.requestAnimationFrame(() => {
      panel.style.setProperty("--sheet-drag-y", "0px");
      overlayRef.current?.style.setProperty("--sheet-backdrop-opacity", "1");
    });
```

Keep the existing `close()` path unchanged for committed dismissals.

- [ ] **Step 4: Include the settling CSS class**

In `BottomSheet.tsx`, add the class in `overlayClassName`:

```ts
phase === "settling" ? styles.motionSheetSettling : "",
```

- [ ] **Step 5: Add settle motion CSS**

In `app/page.module.css`, add the token under `.app`:

```css
--motion-sheet-settle: 220ms;
```

Add the settling class near the other sheet phase classes:

```css
.motionSheetSettling {
  opacity: 1;
}

.motionSheetSettling .bottomSheet {
  transition-duration: var(--motion-sheet-settle);
  transition-timing-function: var(--ease-sheet-settle);
  will-change: transform;
}
```

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```powershell
npm.cmd run test -- lib/motionInteractions.test.ts lib/motionCss.test.ts
```

Expected: PASS.

---

### Task 3: Verify Full Surface

**Files:**
- No additional file edits expected.

- [ ] **Step 1: Run full tests**

Run:

```powershell
npm.cmd run test
```

Expected: all test files pass.

- [ ] **Step 2: Run lint**

Run:

```powershell
npm.cmd exec -- eslint app lib
```

Expected: no lint output and exit code 0.

- [ ] **Step 3: Run production build**

Run:

```powershell
npm.cmd run build
```

Expected: Next.js build completes successfully.

- [ ] **Step 4: Run whitespace check**

Run:

```powershell
git diff --check
```

Expected: no output and exit code 0.

- [ ] **Step 5: Commit implementation**

Run:

```powershell
git status -sb
git add -- app/BottomSheet.tsx app/page.module.css lib/motionInteractions.ts lib/motionInteractions.test.ts lib/motionCss.test.ts
git commit -m "style: add bottom sheet settle motion"
```

Expected: one implementation commit after the design and plan commits.

---

## Self-Review

- Spec coverage: the plan adds the `settling` state, separate `--motion-sheet-settle` token, transform-only CSS class, interruption support, reduced-motion reliance on existing global reduced-motion rules, and verification commands.
- Placeholder scan: no TBD, TODO, or deferred implementation steps remain.
- Type consistency: the phase is consistently named `settling`, the CSS class is consistently named `motionSheetSettling`, and the token is consistently named `--motion-sheet-settle`.
