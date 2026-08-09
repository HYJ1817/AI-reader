# 图书操作 Sheet UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the mobile book-action bottom sheet into a restrained, grouped product surface inspired by COSS UI while preserving every existing interaction and business behavior.

**Architecture:** Keep `BookActionPage` and the existing Sheet route as the behavioral boundary. Add stable presentation hooks only where browser tests need to distinguish the hero, action, detail, and danger groups; express the visual change in the existing CSS module and existing semantic theme tokens. Validate the presentation contract with Playwright and run the existing source gates.

**Tech Stack:** Next.js 16, React, TypeScript, CSS Modules, Playwright, Vitest, existing semantic theme and motion tokens.

---

### Task 1: Add a failing visual-contract journey for the book-action sheet

**Files:**
- Modify: `app/LibrarySheetPages.tsx:140-205`
- Test: `e2e/interaction-fluidity.spec.ts` after `openBookActionSheet`

- [ ] **Step 1: Add stable presentation hooks without changing behavior**

Add `data-book-action-section="hero"` to the existing hero wrapper, `actions` to the first action group, `details` to the detail group, and `danger` to the final delete group. Keep all callbacks, labels, focus-return attributes, and child structure unchanged.

- [ ] **Step 2: Write the failing Playwright assertion**

Add this test after the `openBookActionSheet` helper:

```ts
test("book actions use a clear grouped visual hierarchy", async ({ page }) => {
  const sheet = await openBookActionSheet(page);
  const sections = sheet.locator("[data-book-action-section]");
  await expect(sections).toHaveCount(4);

  const visualContract = await sheet.evaluate((element) => {
    const read = (selector: string) => {
      const node = element.querySelector<HTMLElement>(selector);
      if (!node) throw new Error(`Missing ${selector}`);
      const style = getComputedStyle(node);
      return {
        borderTopWidth: style.borderTopWidth,
        boxShadow: style.boxShadow,
      };
    };

    return {
      actions: read('[data-book-action-section="actions"]'),
      details: read('[data-book-action-section="details"]'),
      rows: [
        ...element.querySelectorAll<HTMLElement>(
          '[data-book-action-section="actions"] button'
        ),
      ].map((row) => getComputedStyle(row).minHeight),
    };
  });

  expect(visualContract.actions.borderTopWidth).toBe("1px");
  expect(visualContract.details.borderTopWidth).toBe("1px");
  expect(visualContract.actions.boxShadow).toBe("none");
  expect(visualContract.rows).toHaveLength(5);
  expect(
    visualContract.rows.every((height) => Number.parseFloat(height) >= 44)
  ).toBe(true);
});
```

- [ ] **Step 3: Run the focused test and confirm it fails for the old presentation**

Run:

```powershell
npm.cmd exec -- playwright test e2e/interaction-fluidity.spec.ts -g "book actions use a clear grouped visual hierarchy" --project=iphone-14 --workers=1 --trace=off
```

Expected: the assertion for the old `0.5px` group border fails before the style implementation.

### Task 2: Implement the restrained grouped presentation

**Files:**
- Modify: `app/LibrarySheetPages.tsx:140-205`
- Modify: `app/page.module.css:4583-4695`

- [ ] **Step 1: Tune the hero spacing and cover scale**

Keep the existing cover and metadata markup. Update only the existing presentation rules:

```css
.bookActionHero {
  gap: 16px;
  padding: 12px 16px 18px;
}

.bookActionHero .bookCover {
  width: 68px;
  height: 96px;
  border-radius: 8px;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.18);
}
```

Keep title truncation and metadata colors intact, adjusting only weight or line-height if the new spacing requires it.

- [ ] **Step 2: Make action and detail groups share one quiet container language**

Use one thin border, no decorative shadow, and a tighter radius while retaining semantic surface tokens:

```css
.actionListGroup,
.bookDetailGroup {
  margin: 0 16px 14px;
  border: 1px solid var(--hairline);
  border-radius: 14px;
  background: var(--surface-primary);
  box-shadow: none;
}

.actionListRow {
  min-height: 58px;
  padding: 0 14px;
  gap: 14px;
  border-bottom: 1px solid var(--hairline);
}

.actionIcon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
}
```

Preserve the existing last-row separator removal and action callbacks.

- [ ] **Step 3: Strengthen interaction states and the danger group**

Use a quiet pressed state and explicit focus ring with the existing motion system:

```css
.actionListRow:focus-visible {
  position: relative;
  z-index: 1;
  outline: 2px solid color-mix(in srgb, var(--tint) 72%, transparent);
  outline-offset: -3px;
}

.actionListRow:active {
  background: color-mix(in srgb, var(--tint) 8%, transparent);
  transform: none;
}

.actionListDanger:active {
  background: rgba(255, 69, 58, 0.08);
}
```

Keep the existing red semantic color for the danger row and its icon. Do not add a large red fill or a second shadow.

- [ ] **Step 4: Refine details without changing values**

Keep `DetailRow` as the key-value structure and adjust only the section label, row height, and text alignment:

```css
.bookDetailGroup h3 {
  padding: 11px 14px 6px;
  font-size: 12px;
}

.bookDetailRow {
  min-height: 44px;
  padding: 0 14px;
  border-top: 1px solid var(--hairline);
}
```

All values must remain visible or ellipsized inside the sheet width.

### Task 3: Verify behavior, themes, and responsive geometry

**Files:**
- Test: `e2e/interaction-fluidity.spec.ts`
- Existing behavior coverage: `e2e/native-navigation.spec.ts`, `e2e/reading-workspace.spec.ts`

- [ ] **Step 1: Run the focused visual-contract test after implementation**

Run the Task 1 command. Expected: PASS on iPhone 14.

- [ ] **Step 2: Run the related mobile interaction journeys**

Run:

```powershell
npm.cmd exec -- playwright test e2e/interaction-fluidity.spec.ts e2e/native-navigation.spec.ts e2e/reading-workspace.spec.ts --project=iphone-14 --project=iphone-15-pro-max --workers=1 --trace=off
```

Expected: all selected navigation, focus, keyboard, Workspace, and action-row journeys pass on both mobile profiles.

- [ ] **Step 3: Run source gates**

Run:

```powershell
npm.cmd exec -- vitest run
npm.cmd exec -- eslint app lib e2e
npm.cmd run build
git diff --check
```

Expected: the current repository test suite passes, source lint exits 0, the production build exits 0, and `git diff --check` reports no errors.

- [ ] **Step 4: Review the final diff and commit the implementation**

Run:

```powershell
git diff --stat
git status -sb
git add -- app/LibrarySheetPages.tsx app/page.module.css e2e/interaction-fluidity.spec.ts
git commit -m "polish: refine book action sheet UI"
```

The commit must contain only the presentation hooks, CSS, and the focused regression test. Do not reset, clean, or overwrite unrelated work.
