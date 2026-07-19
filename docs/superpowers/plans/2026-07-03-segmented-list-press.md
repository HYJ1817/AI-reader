# Segmented and List Press Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add compositor-only pressed feedback to compact segmented controls, Library view toggles, and collection rows.

**Architecture:** Keep the change CSS-only. Add motion contract assertions in `lib/motionCss.test.ts`, then implement transform transitions and reduced-motion coverage in `app/page.module.css`.

**Tech Stack:** CSS Modules, Vitest CSS contract tests.

---

## File Structure

- `lib/motionCss.test.ts`: add a focused test for compact segmented/list press feedback.
- `app/page.module.css`: add transform transitions, active transforms, and reduced-motion coverage for settings segmented controls, Library view toggles, and collection rows.

---

### Task 1: Add Failing CSS Tests

**Files:**
- Modify: `lib/motionCss.test.ts`

- [ ] **Step 1: Add compact segmented/list press test**

In `lib/motionCss.test.ts`, add this test after `it("gives primary touch controls consistent pressed motion", () => { ... })`:

```ts
it("gives compact segmented and collection controls pressed motion", () => {
  for (const selector of [
    ".settingsSegmentControl button {",
    ".libraryViewToggle button {",
    ".collectionRow {",
    ".collectionRowMain {",
  ]) {
    const start = css.indexOf(selector);
    const end = css.indexOf("}", start);
    const rule = css.slice(start, end);
    expect(rule).toContain("transform");
    expect(rule).toMatch(/transition:[^}]*transform/s);
  }

  expect(css).toMatch(
    /\.settingsSegmentControl\s+button:not\(:disabled\):active\s*\{[^}]*scale\(0\.94\)/s
  );
  expect(css).toMatch(
    /\.libraryViewToggle\s+button:not\(:disabled\):active\s*\{[^}]*scale\(0\.94\)/s
  );
  expect(css).toMatch(
    /\.libraryViewToggle\s+\.libraryViewActive\s*\{[^}]*transform:\s*scale\(1\)/s
  );
  expect(css).toMatch(
    /\.collectionRow:active\s*\{[^}]*translate3d\(0,\s*1px,\s*0\)/s
  );
  expect(css).toMatch(
    /\.collectionRowMain:active\s*\{[^}]*translate3d\(0,\s*1px,\s*0\)/s
  );

  const reduceStart = css.indexOf(
    "@media (prefers-reduced-motion: reduce)",
    css.indexOf(".settingsSegmentControl button:not(:disabled):active")
  );
  const reduceEnd = css.indexOf(
    "}",
    css.indexOf(".collectionRowMain:active", reduceStart)
  );
  const reduceRule = css.slice(reduceStart, reduceEnd);
  for (const selector of [
    ".settingsSegmentControl button",
    ".settingsSegmentControl button:not(:disabled):active",
    ".libraryViewToggle button",
    ".libraryViewToggle button:not(:disabled):active",
    ".libraryViewToggle .libraryViewActive",
    ".collectionRow",
    ".collectionRow:active",
    ".collectionRowMain",
    ".collectionRowMain:active",
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

Expected: FAIL because compact segmented/list controls do not yet have transform transitions and active transform rules.

---

### Task 2: Implement Press Feedback CSS

**Files:**
- Modify: `app/page.module.css`

- [ ] **Step 1: Add settings segmented button transforms**

Update `.settingsSegmentControl button`:

```css
.settingsSegmentControl button {
  min-width: 42px;
  height: 30px;
  padding: 0 10px;
  border-radius: 9px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  transform: scale(1);
  transition:
    background var(--motion-fast) var(--ease-standard),
    color var(--motion-fast) var(--ease-standard),
    transform var(--motion-fast) var(--ease-standard);
}
```

Add:

```css
.settingsSegmentControl button:not(:disabled):active {
  transform: scale(0.94);
}
```

- [ ] **Step 2: Add Library view toggle transforms**

Update `.libraryViewToggle button`:

```css
.libraryViewToggle button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  color: var(--text-secondary);
  transform: scale(1);
  transition:
    background var(--motion-fast) var(--ease-standard),
    color var(--motion-fast) var(--ease-standard),
    transform var(--motion-fast) var(--ease-standard);
}
```

Add:

```css
.libraryViewToggle button:not(:disabled):active {
  transform: scale(0.94);
}
```

Update `.libraryViewToggle .libraryViewActive`:

```css
.libraryViewToggle .libraryViewActive {
  background: var(--surface-primary);
  color: var(--tint);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  transform: scale(1);
}
```

- [ ] **Step 3: Add collection row transforms**

Update `.collectionRow`:

```css
.collectionRow {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 44px;
  padding: 8px 12px;
  border: 0;
  border-bottom: 0.5px solid var(--separator);
  border-radius: 0;
  background: transparent;
  color: var(--text-primary);
  text-align: left;
  transform: translate3d(0, 0, 0);
  transition:
    background var(--motion-fast) var(--ease-standard),
    transform var(--motion-fast) var(--ease-standard);
}
```

Update `.collectionRowMain`:

```css
.collectionRowMain {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  color: inherit;
  text-align: left;
  transform: translate3d(0, 0, 0);
  transition: transform var(--motion-fast) var(--ease-standard);
}
```

Add:

```css
.collectionRow:active,
.collectionRowMain:active {
  transform: translate3d(0, 1px, 0);
}
```

- [ ] **Step 4: Add reduced-motion CSS**

Add after the collection row active rules:

```css
@media (prefers-reduced-motion: reduce) {
  .settingsSegmentControl button,
  .settingsSegmentControl button:not(:disabled):active,
  .libraryViewToggle button,
  .libraryViewToggle button:not(:disabled):active,
  .libraryViewToggle .libraryViewActive,
  .collectionRow,
  .collectionRow:active,
  .collectionRowMain,
  .collectionRowMain:active {
    transition: none;
    transform: none;
  }
}
```

- [ ] **Step 5: Run focused tests and verify GREEN**

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
git commit -m "style: polish compact control press feedback"
```

Expected: one implementation commit after the design and plan commit.

---

## Self-Review

- Spec coverage: the plan covers settings segmented controls, Library view toggles, collection rows, nested row-main buttons, reduced-motion coverage, and verification.
- Placeholder scan: no TBD, TODO, or deferred steps remain.
- Type consistency: selectors match existing CSS classes in `page.module.css` and `LibrarySurface.tsx`.
