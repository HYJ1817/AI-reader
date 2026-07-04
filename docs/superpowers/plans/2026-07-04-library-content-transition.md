# Library Content Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a restrained CSS-only enter motion to Library grid/list content containers.

**Architecture:** Use the existing conditional render between `.bookGrid` and `.bookItems`. Add a shared `libraryContentIn` keyframes animation to both containers, with reduced-motion coverage and CSS contract tests.

**Tech Stack:** CSS Modules, Vitest CSS contract tests.

---

## File Structure

- `lib/motionCss.test.ts`: add Library content transition assertions.
- `app/page.module.css`: add shared content enter animation for `.bookGrid` and `.bookItems`, keyframes, and reduced-motion coverage.

---

### Task 1: Add Failing Motion Tests

**Files:**
- Modify: `lib/motionCss.test.ts`

- [ ] **Step 1: Add Library content transition test**

In `lib/motionCss.test.ts`, add this test after `it("gives library book entries layered press depth", () => { ... })`:

```ts
it("settles library grid and list content on view changes", () => {
  for (const selector of [".bookGrid {", ".bookItems {"]) {
    const start = css.indexOf(selector);
    const end = css.indexOf("}", start);
    const rule = css.slice(start, end);
    expect(rule).toContain("animation: libraryContentIn var(--motion-standard) var(--ease-standard) both;");
  }

  expect(css).toMatch(
    /@keyframes libraryContentIn\s*\{[\s\S]*?from\s*\{[\s\S]*?opacity:\s*0\.72;[\s\S]*?transform:\s*translate3d\(0,\s*7px,\s*0\);[\s\S]*?\}[\s\S]*?to\s*\{[\s\S]*?opacity:\s*1;[\s\S]*?transform:\s*translate3d\(0,\s*0,\s*0\);/s
  );

  const reduceStart = css.indexOf(
    "@media (prefers-reduced-motion: reduce)",
    css.indexOf("@keyframes libraryContentIn")
  );
  const reduceEnd = css.indexOf("}", css.indexOf(".bookItems", reduceStart));
  const reduceRule = css.slice(reduceStart, reduceEnd);
  for (const selector of [".bookGrid", ".bookItems"]) {
    expect(reduceRule).toContain(selector);
  }
  expect(reduceRule).toContain("animation: none;");
  expect(reduceRule).toContain("transform: none;");
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
npm.cmd run test -- lib/motionCss.test.ts
```

Expected: FAIL because `.bookGrid` and `.bookItems` do not yet use `libraryContentIn`.

---

### Task 2: Implement Library Content Enter Motion

**Files:**
- Modify: `app/page.module.css`

- [ ] **Step 1: Add animation to `.bookList` containers**

Update `.bookGrid`:

```css
.bookGrid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  column-gap: 14px;
  row-gap: 18px;
  padding: 2px 0 8px;
  animation: libraryContentIn var(--motion-standard) var(--ease-standard) both;
}
```

Update `.bookItems`:

```css
.bookItems {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  animation: libraryContentIn var(--motion-standard) var(--ease-standard) both;
}
```

- [ ] **Step 2: Add keyframes**

Add near the Library book layout rules:

```css
@keyframes libraryContentIn {
  from {
    opacity: 0.72;
    transform: translate3d(0, 7px, 0);
  }

  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}
```

- [ ] **Step 3: Add reduced-motion coverage**

Add after the keyframes:

```css
@media (prefers-reduced-motion: reduce) {
  .bookGrid,
  .bookItems {
    animation: none;
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
git commit -m "style: add library content transition"
```

Expected: one implementation commit after the design and plan commit.

---

## Self-Review

- Spec coverage: the plan covers grid/list content enter motion, keyframes, reduced-motion handling, focused tests, and full verification.
- Placeholder scan: no TBD, TODO, or deferred steps remain.
- Type consistency: selectors match existing CSS classes in `LibrarySurface.tsx` and `page.module.css`.
