# Library Selection Affordance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Library selected-book badges a clearer elevated selected state without changing selection behavior.

**Architecture:** Keep the change CSS-only. Add source/CSS contract assertions for badge transitions and selected-state transforms, then implement badge transition, selected lift, stronger shadow, and reduced-motion coverage in `app/page.module.css`.

**Tech Stack:** CSS Modules, Vitest CSS contract tests.

---

## File Structure

- `lib/motionCss.test.ts`: add selected-badge state assertions.
- `app/page.module.css`: add selection badge transform/transition, selected-state lift/shadow, and reduced-motion coverage.

---

### Task 1: Add Failing CSS Tests

**Files:**
- Modify: `lib/motionCss.test.ts`

- [ ] **Step 1: Add selected badge affordance test**

In `lib/motionCss.test.ts`, add this test after `it("settles library grid and list content on view changes", () => { ... })`:

```ts
it("gives library selection badges elevated selected state", () => {
  const badgeStart = css.indexOf(".selectionBadge,");
  const badgeEnd = css.indexOf("}", badgeStart);
  const badgeRule = css.slice(badgeStart, badgeEnd);
  expect(badgeRule).toContain("transform");
  expect(badgeRule).toMatch(
    /transition:[^}]*background[^}]*border-color[^}]*box-shadow[^}]*transform/s
  );

  const selectedStart = css.indexOf(
    ".bookSelected .selectionBadge,",
    badgeEnd
  );
  const selectedEnd = css.indexOf("}", selectedStart);
  const selectedRule = css.slice(selectedStart, selectedEnd);
  expect(selectedRule).toContain("transform: scale(1.06)");
  expect(selectedRule).toContain("box-shadow");

  const reduceStart = css.indexOf(
    "@media (prefers-reduced-motion: reduce)",
    selectedStart
  );
  const reduceEnd = css.indexOf("}", css.indexOf(".bookSelected .selectionBadgeInline", reduceStart));
  const reduceRule = css.slice(reduceStart, reduceEnd);
  for (const selector of [
    ".selectionBadge",
    ".selectionBadgeInline",
    ".bookSelected .selectionBadge",
    ".bookSelected .selectionBadgeInline",
  ]) {
    expect(reduceRule).toContain(selector);
  }
  expect(reduceRule).toContain("transition: none;");
  expect(reduceRule).toContain("transform: none;");
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
npm.cmd run test -- lib/motionCss.test.ts
```

Expected: FAIL because selection badges do not yet transition transform or scale selected state.

---

### Task 2: Implement Selected Badge Polish

**Files:**
- Modify: `app/page.module.css`

- [ ] **Step 1: Add badge transform transition**

Update `.selectionBadge, .selectionBadgeInline`:

```css
.selectionBadge,
.selectionBadgeInline {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, 0.92);
  background: rgba(120, 130, 160, 0.48);
  color: #ffffff;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.18);
  transform: scale(1);
  transition:
    background var(--motion-fast) var(--ease-standard),
    border-color var(--motion-fast) var(--ease-standard),
    box-shadow var(--motion-fast) var(--ease-standard),
    transform var(--motion-fast) var(--ease-standard);
}
```

- [ ] **Step 2: Add selected badge lift**

Update `.bookSelected .selectionBadge, .bookSelected .selectionBadgeInline`:

```css
.bookSelected .selectionBadge,
.bookSelected .selectionBadgeInline {
  background: var(--tint);
  border-color: var(--tint);
  box-shadow: 0 4px 10px color-mix(in srgb, var(--tint) 26%, rgba(0, 0, 0, 0.22));
  transform: scale(1.06);
}
```

- [ ] **Step 3: Add reduced-motion coverage**

Add after the selected badge rule:

```css
@media (prefers-reduced-motion: reduce) {
  .selectionBadge,
  .selectionBadgeInline,
  .bookSelected .selectionBadge,
  .bookSelected .selectionBadgeInline {
    transition: none;
    transform: none;
  }
}
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```powershell
npm.cmd run test -- lib/motionCss.test.ts
```

Expected: PASS.

---

### Task 3: Verify and Commit

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

Expected: no whitespace errors.

- [ ] **Step 5: Commit implementation**

Run:

```powershell
git status -sb
git add -- app/page.module.css lib/motionCss.test.ts
git commit -m "style: polish library selected badges"
```

Expected: one implementation commit after the design and plan commit.

---

## Self-Review

- Spec coverage: the plan covers grid/list selection badges, selected-state lift/shadow, reduced-motion handling, focused tests, and full verification.
- Placeholder scan: no TBD, TODO, or deferred steps remain.
- Type consistency: selectors match existing CSS classes in `LibrarySurface.tsx` and `page.module.css`.
