# Settings Switch Hint Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove explanatory secondary text from the four settings switch rows while preserving navigation-row status text.

**Architecture:** Keep the existing `SettingsSurface` component and settings state flow unchanged. Add a focused source-contract test, then remove only the four switch-row `<small>` elements; retain the shared row styles because navigation rows still use secondary status text.

**Tech Stack:** React 19, TypeScript, CSS Modules, Vitest, Next.js 16

---

### Task 1: Lock the settings text contract

**Files:**
- Create: `lib/settingsSurface.test.ts`
- Read: `app/SettingsSurface.tsx`

- [ ] **Step 1: Write the failing source-contract test**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../app/SettingsSurface.tsx", import.meta.url),
  "utf8"
);

describe("settings surface copy", () => {
  it("omits explanatory hints from switch rows", () => {
    for (const hint of [
      "UI_TEXT.AUTO_OPEN_LAST_BOOK_HINT",
      "UI_TEXT.KEEP_SCREEN_AWAKE_HINT",
      "UI_TEXT.REDUCE_MOTION_HINT",
      "UI_TEXT.SWIPE_TO_TURN_HINT",
    ]) {
      expect(source).not.toContain(hint);
    }
  });

  it("keeps secondary status text on navigation rows", () => {
    expect(source).toContain('activeProviderLabel ??');
    expect(source).toContain("<small>{readerThemeLabel}</small>");
    expect(source).toContain("todayMinutes");
    expect(source).toContain("targetMinutes");
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
npm.cmd run test -- lib/settingsSurface.test.ts
```

Expected: the first test fails because the four `UI_TEXT.*_HINT` references are still present.

- [ ] **Step 3: Commit the failing test**

```powershell
git add -- lib/settingsSurface.test.ts
git commit -m "test: define settings switch copy contract"
```

### Task 2: Remove only switch-row hints

**Files:**
- Modify: `app/SettingsSurface.tsx:57-117`
- Test: `lib/settingsSurface.test.ts`

- [ ] **Step 1: Remove the four hint elements**

Change each switch row from:

```tsx
<span className={styles.settingsRowText}>
  <strong>{UI_TEXT.AUTO_OPEN_LAST_BOOK}</strong>
  <small>{UI_TEXT.AUTO_OPEN_LAST_BOOK_HINT}</small>
</span>
```

to the corresponding label-only form:

```tsx
<span className={styles.settingsRowText}>
  <strong>{UI_TEXT.AUTO_OPEN_LAST_BOOK}</strong>
</span>
```

Apply the same removal to:

```tsx
UI_TEXT.KEEP_SCREEN_AWAKE_HINT
UI_TEXT.REDUCE_MOTION_HINT
UI_TEXT.SWIPE_TO_TURN_HINT
```

Do not change the `<small>` elements containing:

```tsx
activeProviderLabel
readerThemeLabel
todayMinutes
targetMinutes
```

- [ ] **Step 2: Run the focused test and verify it passes**

Run:

```powershell
npm.cmd run test -- lib/settingsSurface.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 3: Run source lint**

Run:

```powershell
npm.cmd exec -- eslint app lib
```

Expected: exit code 0 with no lint errors.

- [ ] **Step 4: Commit the implementation**

```powershell
git add -- app/SettingsSurface.tsx
git commit -m "refactor: simplify settings switch rows"
```

### Task 3: Verify behavior and layout

**Files:**
- Verify: `app/SettingsSurface.tsx`
- Verify: `app/page.module.css`
- Verify: `lib/settingsSurface.test.ts`

- [ ] **Step 1: Run the complete automated verification**

Run:

```powershell
npm.cmd run test
npm.cmd exec -- eslint app lib
npm.cmd run build
npm.cmd audit --json
git diff --check
```

Expected:

- All Vitest tests pass.
- ESLint exits with code 0.
- Next.js production build succeeds.
- `npm audit` output is recorded; any nonzero result is reported rather than hidden.
- `git diff --check` reports no whitespace errors.

- [ ] **Step 2: Check the settings page at an iPhone-sized viewport**

Start the development server:

```powershell
npm.cmd run dev -- --hostname 127.0.0.1 --port 3000
```

At a `390 x 844` viewport:

- Open the settings tab.
- Confirm the four switch rows show only their primary labels.
- Confirm the switches remain vertically centered and easy to tap.
- Confirm AI provider, reader appearance, and reading-goal rows retain their secondary status text.
- Confirm no text overlaps or row-height jumps occur.

- [ ] **Step 3: Review repository state**

Run:

```powershell
git status -sb
git log -5 --oneline --decorate
```

Expected: implementation commits are present; the pre-existing uncommitted
`HANDOFF.md` and `ROADMAP.md` changes remain untouched.
