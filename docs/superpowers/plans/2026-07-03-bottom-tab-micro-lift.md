# Bottom Tab Micro-Lift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add subtle active lift and shared pressed feedback to the bottom navigation tab icon/label pair.

**Architecture:** Keep the interaction CSS-first and layout-stable. Add a named label span in `AppNavigation.tsx`, assert the CSS motion contract in `lib/motionCss.test.ts`, then implement compositor-only transform transitions in `app/page.module.css`.

**Tech Stack:** React, CSS Modules, Vitest CSS contract tests.

---

## File Structure

- `app/AppNavigation.tsx`: add `styles.tabLabel` to each bottom-tab label span.
- `lib/motionCss.test.ts`: extend primary touch-control assertions for tab label active/pressed/reduced-motion behavior.
- `app/page.module.css`: add tab label transform transitions, active icon/label lift, pressed label compression, and reduced-motion coverage.

---

### Task 1: Add Failing Navigation Motion Tests

**Files:**
- Modify: `lib/motionCss.test.ts`

- [ ] **Step 1: Extend the primary touch-control test**

In `lib/motionCss.test.ts`, inside `it("gives primary touch controls consistent pressed motion", () => { ... })`, add these assertions after the existing `.tabIcon` assertions:

```ts
const tabLabelStart = css.indexOf(".tabLabel {");
const tabLabelEnd = css.indexOf("}", tabLabelStart);
const tabLabelRule = css.slice(tabLabelStart, tabLabelEnd);
expect(tabLabelRule).toContain("transform");
expect(tabLabelRule).toMatch(/transition:[^}]*transform/s);

expect(css).toMatch(
  /\.activeTab\s+\.tabIcon\s*\{[^}]*translate3d\(0,\s*-1px,\s*0\)[^}]*scale\(1\.04\)/s
);
expect(css).toMatch(
  /\.activeTab\s+\.tabLabel\s*\{[^}]*translate3d\(0,\s*-1px,\s*0\)/s
);
expect(css).toMatch(
  /\.tab:not\(:disabled\):active\s+\.tabLabel\s*\{[^}]*translate3d\(0,\s*1px,\s*0\)[^}]*scale\(0\.96\)/s
);

const reduceStart = css.indexOf("@media (prefers-reduced-motion: reduce)");
const reduceEnd = css.indexOf("}", css.indexOf(".tab:not(:disabled):active .tabLabel", reduceStart));
const reduceRule = css.slice(reduceStart, reduceEnd);
for (const selector of [
  ".tabIcon",
  ".activeTab .tabIcon",
  ".tab:not(:disabled):active .tabIcon",
  ".tabLabel",
  ".activeTab .tabLabel",
  ".tab:not(:disabled):active .tabLabel",
]) {
  expect(reduceRule).toContain(selector);
}
expect(reduceRule).toContain("transition: none;");
expect(reduceRule).toContain("transform: none;");
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
npm.cmd run test -- lib/motionCss.test.ts
```

Expected: FAIL because `.tabLabel` and active label/icon lift rules do not yet exist.

---

### Task 2: Implement Tab Label Markup and Motion CSS

**Files:**
- Modify: `app/AppNavigation.tsx`
- Modify: `app/page.module.css`

- [ ] **Step 1: Add label class names**

Update each bottom-tab label span in `app/AppNavigation.tsx`:

```tsx
<span className={styles.tabLabel}>{UI_TEXT.LIBRARY}</span>
<span className={styles.tabLabel}>{UI_TEXT.READING}</span>
<span className={styles.tabLabel}>{UI_TEXT.SETTINGS}</span>
```

- [ ] **Step 2: Add label transform transition**

Add after `.tabIcon` in `app/page.module.css`:

```css
.tabLabel {
  display: block;
  transform: translate3d(0, 0, 0) scale(1);
  transition: transform var(--motion-fast) var(--ease-standard);
}
```

- [ ] **Step 3: Add active content lift**

Add before the existing `.activeTab .tabIconStroke` rule:

```css
.activeTab .tabIcon {
  transform: translate3d(0, -1px, 0) scale(1.04);
}

.activeTab .tabLabel {
  transform: translate3d(0, -1px, 0);
}
```

- [ ] **Step 4: Add pressed label compression**

Add after the existing `.tab:not(:disabled):active .tabIcon` rule:

```css
.tab:not(:disabled):active .tabLabel {
  transform: translate3d(0, 1px, 0) scale(0.96);
}
```

- [ ] **Step 5: Add reduced-motion coverage**

Add a reduced-motion block near the tab motion rules:

```css
@media (prefers-reduced-motion: reduce) {
  .tabIcon,
  .activeTab .tabIcon,
  .tab:not(:disabled):active .tabIcon,
  .tabLabel,
  .activeTab .tabLabel,
  .tab:not(:disabled):active .tabLabel {
    transition: none;
    transform: none;
  }
}
```

- [ ] **Step 6: Run focused tests and verify GREEN**

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
git add -- app/AppNavigation.tsx app/page.module.css lib/motionCss.test.ts
git commit -m "style: polish bottom tab press feedback"
```

Expected: one implementation commit after the design and plan commits.

---

## Self-Review

- Spec coverage: the plan covers label markup, active icon/label lift, pressed label feedback, reduced-motion handling, and verification.
- Placeholder scan: no TBD, TODO, or deferred steps remain.
- Type consistency: selectors match existing CSS class names plus the new `tabLabel` class used by `AppNavigation.tsx`.
