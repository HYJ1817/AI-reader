# Reader Settings Micro-Press Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make reader settings popover rows and the custom settings entry feel like cohesive pressed objects.

**Architecture:** Keep this as a CSS-only motion polish. Add failing CSS contract assertions first, then add transform transitions and active child transforms in `app/page.module.css`.

**Tech Stack:** CSS Modules, Vitest source/CSS contract tests.

---

## File Structure

- `lib/motionCss.test.ts`: assert child affordance transitions, active transforms, and reduced-motion coverage.
- `app/page.module.css`: add compositor-only transform transitions to reader settings popover child affordances and the custom entry gear icon.

---

### Task 1: Add Failing CSS Contract Tests

**Files:**
- Modify: `lib/motionCss.test.ts`

- [ ] **Step 1: Extend the reader settings popover test**

In `lib/motionCss.test.ts`, inside `it("styles reader settings popover menus independently from font sizing", ...)`, after the existing `readerSettingsPopoverRow` transition assertion, add:

```ts
const checkStart = css.indexOf(".readerSettingsPopoverCheck {");
const checkEnd = css.indexOf("}", checkStart);
const checkRule = css.slice(checkStart, checkEnd);
expect(checkRule).toContain("transform");
expect(checkRule).toMatch(/transition:[^}]*transform/s);

const iconStart = css.indexOf(".readerSettingsPopoverIcon {");
const iconEnd = css.indexOf("}", iconStart);
const iconRule = css.slice(iconStart, iconEnd);
expect(iconRule).toContain("transform");
expect(iconRule).toMatch(/transition:[^}]*transform/s);

expect(css).toMatch(
  /\.readerSettingsPopoverRow:active\s+\.readerSettingsPopoverCheck\s*\{[^}]*scale\(1\.08\)/s
);
expect(css).toMatch(
  /\.readerSettingsPopoverRow:active\s+\.readerSettingsPopoverIcon\s*\{[^}]*scale\(0\.94\)/s
);
```

- [ ] **Step 2: Extend the custom entry typography/motion test**

In `lib/motionCss.test.ts`, inside `it("keeps reader settings typography at a normal menu scale", ...)`, after the existing `readerCustomEntryButton` assertions, add:

```ts
const customGearStart = css.indexOf(".readerCustomGearIcon {");
const customGearEnd = css.indexOf("}", customGearStart);
const customGearRule = css.slice(customGearStart, customGearEnd);
expect(customGearRule).toContain("transform");
expect(customGearRule).toMatch(/transition:[^}]*transform/s);
expect(css).toMatch(
  /\.readerCustomEntryButton:active\s+\.readerCustomGearIcon\s*\{[^}]*scale\(0\.92\)/s
);
```

- [ ] **Step 3: Extend reduced-motion assertions**

In the existing reduced-motion block for reader settings controls, add these selectors to the list:

```ts
".readerSettingsPopoverCheck",
".readerSettingsPopoverIcon",
".readerSettingsPopoverRow:active .readerSettingsPopoverCheck",
".readerSettingsPopoverRow:active .readerSettingsPopoverIcon",
".readerCustomGearIcon",
".readerCustomEntryButton:active .readerCustomGearIcon",
```

- [ ] **Step 4: Run focused tests and verify RED**

Run:

```powershell
npm.cmd run test -- lib/motionCss.test.ts
```

Expected: FAIL because the child transform transitions and active selectors do not exist yet.

---

### Task 2: Implement Micro-Press CSS

**Files:**
- Modify: `app/page.module.css`

- [ ] **Step 1: Add popover child transform transitions**

In `app/page.module.css`, update `.readerSettingsPopoverCheck`:

```css
.readerSettingsPopoverCheck {
  color: #111111;
  font-size: 16px;
  font-weight: 800;
  line-height: 1;
  text-align: center;
  transform: scale(1);
  transition: transform var(--motion-fast) var(--ease-standard);
}
```

Update `.readerSettingsPopoverIcon`:

```css
.readerSettingsPopoverIcon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  transform: scale(1);
  transition: transform var(--motion-fast) var(--ease-standard);
}
```

- [ ] **Step 2: Add popover active child transforms**

Add below `.readerSettingsPopoverRow:active`:

```css
.readerSettingsPopoverRow:active .readerSettingsPopoverCheck {
  transform: scale(1.08);
}

.readerSettingsPopoverRow:active .readerSettingsPopoverIcon {
  transform: scale(0.94);
}
```

- [ ] **Step 3: Add custom entry gear transform**

Update `.readerCustomGearIcon`:

```css
.readerCustomGearIcon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  transform: scale(1);
  transition: transform var(--motion-fast) var(--ease-standard);
}
```

Add below `.readerCustomEntryButton:active`:

```css
.readerCustomEntryButton:active .readerCustomGearIcon {
  transform: scale(0.92);
}
```

- [ ] **Step 4: Expand reduced-motion CSS**

In the reader settings reduced-motion block, include:

```css
.readerSettingsPopoverCheck,
.readerSettingsPopoverIcon,
.readerSettingsPopoverRow:active .readerSettingsPopoverCheck,
.readerSettingsPopoverRow:active .readerSettingsPopoverIcon,
.readerCustomGearIcon,
.readerCustomEntryButton:active .readerCustomGearIcon
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
git commit -m "style: polish reader settings press feedback"
```

Expected: one implementation commit after the design and plan commits.

---

## Self-Review

- Spec coverage: the plan covers popover child transitions, active child transforms, custom gear motion, reduced-motion handling, and verification.
- Placeholder scan: no TBD, TODO, or deferred steps remain.
- Type consistency: selectors match existing CSS class names in `ReaderSettingsPanel.tsx` and `page.module.css`.
