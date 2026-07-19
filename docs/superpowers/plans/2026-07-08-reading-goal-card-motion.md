# Reading Goal Card Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a restrained press-motion hierarchy to the Reading dashboard's today goal card.

**Architecture:** This is a CSS-only polish pass. The focused test reads `app/page.module.css` and verifies that the goal ring and chevron have independent transform transitions, card-press transforms, and reduced-motion coverage.

**Tech Stack:** Next.js, CSS Modules, Vitest.

---

### Task 1: Document and Test the Goal Card Motion Contract

**Files:**
- Modify: `lib/readingDashboardCss.test.ts`
- Read: `app/page.module.css`

- [ ] **Step 1: Add the failing test**

Add a Vitest case named `gives the reading goal card layered press affordances`.

```ts
it("gives the reading goal card layered press affordances", () => {
  const ringRule = rule(".dashboardGoalRing");
  expect(ringRule).toContain("transform: translate3d(0, 0, 0) scale(1)");
  expect(ringRule).toMatch(/transition:[^}]*transform/s);

  const chevronRule = rule(".continueChevron");
  expect(chevronRule).toContain("transform: translate3d(0, 0, 0)");
  expect(chevronRule).toMatch(/transition:[^}]*color[^}]*transform/s);

  expect(css).toMatch(
    /\.readingGoalCard:active \.dashboardGoalRing\s*\{[\s\S]*?transform:\s*translate3d\(0, 1px, 0\) scale\(0\.96\);/s
  );
  expect(css).toMatch(
    /\.readingGoalCard:active \.continueChevron\s*\{[\s\S]*?transform:\s*translate3d\(2px, 1px, 0\);/s
  );
  expect(css).toMatch(
    /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.dashboardGoalRing,[\s\S]*?\.continueChevron,[\s\S]*?\.readingGoalCard:active \.dashboardGoalRing,[\s\S]*?\.readingGoalCard:active \.continueChevron\s*\{[\s\S]*?transition:\s*none;[\s\S]*?transform:\s*none;/s
  );
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```powershell
npm.cmd run test -- lib/readingDashboardCss.test.ts
```

Expected: the new test fails because `.dashboardGoalRing` and `.continueChevron` do not yet expose the required transform baselines and nested active transforms.

### Task 2: Implement CSS-Only Motion

**Files:**
- Modify: `app/page.module.css`
- Test: `lib/readingDashboardCss.test.ts`

- [ ] **Step 1: Add the minimal CSS**

Add transform baselines and transitions to `.dashboardGoalRing` and `.continueChevron`, then add nested active-state rules for `.readingGoalCard:active`.

```css
.dashboardGoalRing {
  transform: translate3d(0, 0, 0) scale(1);
  transition: transform var(--motion-fast) var(--ease-standard);
}

.continueChevron {
  transform: translate3d(0, 0, 0);
  transition:
    color var(--motion-fast) var(--ease-standard),
    transform var(--motion-fast) var(--ease-standard);
}

.readingGoalCard:active .dashboardGoalRing {
  transform: translate3d(0, 1px, 0) scale(0.96);
}

.readingGoalCard:active .continueChevron {
  transform: translate3d(2px, 1px, 0);
}
```

Extend reduced-motion coverage so these targets have no animation or transform in reduced-motion mode.

- [ ] **Step 2: Run the focused test and confirm GREEN**

Run:

```powershell
npm.cmd run test -- lib/readingDashboardCss.test.ts
```

Expected: all tests in `lib/readingDashboardCss.test.ts` pass.

### Task 3: Verify and Close Out

**Files:**
- Modify: `HANDOFF.md`

- [ ] **Step 1: Run verification**

Run:

```powershell
npm.cmd run test
npm.cmd exec -- eslint app lib
npm.cmd run build
git diff --check
```

Expected: all commands exit with code `0`.

- [ ] **Step 2: Refresh handoff and preview**

Update `HANDOFF.md` with the latest code commit, the Reading goal card motion summary, verification results, and current preview URL.

- [ ] **Step 3: Push and check PR**

Run:

```powershell
git push origin codex/custom-background-settings
gh pr checks 1 --watch --interval 10
gh pr view 1 --json headRefName,headRefOid,mergeStateStatus,statusCheckRollup,url
```

Expected: PR points at the pushed HEAD, CI passes, and merge state is `CLEAN`.
