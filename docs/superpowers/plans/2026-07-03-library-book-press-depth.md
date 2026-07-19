# Library Book Press Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add subtle internal press depth to Library book cards and rows without changing Library behavior.

**Architecture:** Keep the change CSS-only. Add source/CSS contract assertions for cover and more-button transform behavior, then implement compositor-only transform transitions in `app/page.module.css`.

**Tech Stack:** CSS Modules, Vitest CSS contract tests.

---

## File Structure

- `lib/motionCss.test.ts`: add Library book press-depth assertions.
- `app/page.module.css`: add transform transitions and active child transforms for book covers and more buttons.

---

### Task 1: Add Failing CSS Tests

**Files:**
- Modify: `lib/motionCss.test.ts`

- [ ] **Step 1: Add a Library book press-depth test**

In `lib/motionCss.test.ts`, add this test near the other Library motion tests:

```ts
it("gives library book entries layered press depth", () => {
  const coverStart = css.indexOf(".bookCover {");
  const coverEnd = css.indexOf("}", coverStart);
  const coverRule = css.slice(coverStart, coverEnd);
  expect(coverRule).toContain("transform");
  expect(coverRule).toMatch(/transition:[^}]*transform/s);

  expect(css).toMatch(
    /\.bookGridItem:active\s+\.bookCover\s*\{[^}]*translate3d\(0,\s*1px,\s*0\)[^}]*scale\(0\.985\)/s
  );
  expect(css).toMatch(
    /\.bookItem:active\s+\.bookCover\s*\{[^}]*translate3d\(0,\s*1px,\s*0\)[^}]*scale\(0\.985\)/s
  );

  const moreStart = css.indexOf(".bookMoreButton {");
  const moreEnd = css.indexOf("}", moreStart);
  const moreRule = css.slice(moreStart, moreEnd);
  expect(moreRule).toContain("transform");
  expect(moreRule).toMatch(/transition:[^}]*opacity[^}]*transform/s);

  const gridMoreStart = css.indexOf(".bookGridMoreButton {");
  const gridMoreEnd = css.indexOf("}", gridMoreStart);
  const gridMoreRule = css.slice(gridMoreStart, gridMoreEnd);
  expect(gridMoreRule).toMatch(/transition:[^}]*opacity[^}]*transform/s);

  expect(css).toMatch(
    /\.bookMoreButton:active\s*\{[^}]*scale\(0\.94\)/s
  );
  expect(css).toMatch(
    /\.bookItem:active\s+\.bookMoreButton\s*\{[^}]*scale\(0\.96\)/s
  );
});
```

- [ ] **Step 2: Add reduced-motion assertions**

In the same test, add:

```ts
const reduceStart = css.indexOf(
  "@media (prefers-reduced-motion: reduce)",
  css.indexOf(".bookGridItem:active .bookCover")
);
const reduceEnd = css.indexOf(
  "}",
  css.indexOf("transform: none;", reduceStart)
);
const reduceRule = css.slice(reduceStart, reduceEnd);
for (const selector of [
  ".bookCover",
  ".bookGridItem:active .bookCover",
  ".bookItem:active .bookCover",
  ".bookMoreButton",
  ".bookMoreButton:active",
  ".bookItem:active .bookMoreButton",
  ".bookGridMoreButton",
  ".bookGridMoreButton:active",
]) {
  expect(reduceRule).toContain(selector);
}
expect(reduceRule).toContain("transition: none;");
expect(reduceRule).toContain("transform: none;");
```

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```powershell
npm.cmd run test -- lib/motionCss.test.ts
```

Expected: FAIL because `.bookCover` and `.bookMoreButton` do not yet have the required transform contract and the active child selectors do not exist.

---

### Task 2: Implement Library Press-Depth CSS

**Files:**
- Modify: `app/page.module.css`

- [ ] **Step 1: Add book cover transform transition**

Update `.bookCover`:

```css
.bookCover {
  flex-shrink: 0;
  width: 48px;
  height: 68px;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
  transform: translate3d(0, 0, 0) scale(1);
  transition: transform var(--motion-fast) var(--ease-standard);
}
```

- [ ] **Step 2: Add grid/list active cover transforms**

Add near existing book active rules:

```css
.bookGridItem:active .bookCover,
.bookItem:active .bookCover {
  transform: translate3d(0, 1px, 0) scale(0.985);
}
```

- [ ] **Step 3: Add transform to list more button**

Update `.bookMoreButton`:

```css
.bookMoreButton {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: var(--text-tertiary);
  transform: scale(1);
  transition:
    opacity var(--motion-fast) var(--ease-standard),
    transform var(--motion-fast) var(--ease-standard);
}
```

Add:

```css
.bookMoreButton:active {
  transform: scale(0.94);
}

.bookItem:active .bookMoreButton {
  transform: scale(0.96);
}
```

- [ ] **Step 4: Add reduced-motion CSS**

Add after the book more-button rules:

```css
@media (prefers-reduced-motion: reduce) {
  .bookCover,
  .bookGridItem:active .bookCover,
  .bookItem:active .bookCover,
  .bookMoreButton,
  .bookMoreButton:active,
  .bookItem:active .bookMoreButton,
  .bookGridMoreButton,
  .bookGridMoreButton:active {
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
git commit -m "style: add library book press depth"
```

Expected: one implementation commit after the design and plan commits.

---

## Self-Review

- Spec coverage: the plan covers grid/list cover press, list more-button press, direct more-button press, reduced-motion handling, and verification.
- Placeholder scan: no TBD, TODO, or deferred steps remain.
- Type consistency: selectors match existing CSS class names in `LibrarySurface.tsx` and `page.module.css`.
