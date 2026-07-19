# Continue Reading Card Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add restrained layered press motion to the Reading dashboard's continue-reading card.

**Architecture:** This is a CSS-only polish pass. The focused test reads `app/page.module.css` and verifies independent motion targets for the feature-card book cover, progress fill, and chevron, plus reduced-motion coverage.

**Tech Stack:** Next.js, CSS Modules, Vitest.

---

### Task 1: Document and Test the Continue-Reading Card Motion Contract

**Files:**
- Modify: `lib/readingDashboardCss.test.ts`
- Read: `app/page.module.css`

- [ ] **Step 1: Add the failing test**

Add a Vitest case named `gives the continue reading card layered press affordances`.

```ts
it("gives the continue reading card layered press affordances", () => {
  const progressFillRule = rule(".libraryProgressTrack span");
  expect(progressFillRule).toContain("transform: translate3d(0, 0, 0) scaleX(1)");
  expect(progressFillRule).toContain("transform-origin: left center");
  expect(progressFillRule).toMatch(/transition:[^}]*width[^}]*transform/s);

  expect(css).toMatch(
    /\.featureBookCard \.bookCover\s*\{[\s\S]*?transform:\s*translate3d\(0, 0, 0\) scale\(1\);[\s\S]*?transition:[\s\S]*?transform var\(--motion-fast\)/s
  );
  expect(css).toMatch(
    /\.featureBookCard:active \.bookCover\s*\{[\s\S]*?transform:\s*translate3d\(0, 1px, 0\) scale\(0\.97\);/s
  );
  expect(css).toMatch(
    /\.featureBookCard:active \.continueChevron\s*\{[\s\S]*?transform:\s*translate3d\(2px, 1px, 0\);/s
  );
  expect(css).toMatch(
    /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.featureBookCard \.bookCover,[\s\S]*?\.featureBookCard:active \.bookCover,[\s\S]*?\.libraryProgressTrack span,[\s\S]*?\.featureBookCard:active \.continueChevron\s*\{[\s\S]*?transition:\s*none;[\s\S]*?transform:\s*none;/s
  );
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```powershell
npm.cmd run test -- lib/readingDashboardCss.test.ts
```

Expected: the new test fails because `.featureBookCard .bookCover` and `.libraryProgressTrack span` do not yet expose the required motion contract.

### Task 2: Implement CSS-Only Motion

**Files:**
- Modify: `app/page.module.css`
- Test: `lib/readingDashboardCss.test.ts`

- [ ] **Step 1: Add the minimal CSS**

Add transform baselines and transitions to the feature-card cover and progress fill, then add nested active-state rules for `.featureBookCard:active`.

```css
.libraryProgressTrack span {
  transform: translate3d(0, 0, 0) scaleX(1);
  transform-origin: left center;
  transition:
    width var(--motion-standard) var(--ease-standard),
    transform var(--motion-fast) var(--ease-standard);
}

.featureBookCard .bookCover {
  transform: translate3d(0, 0, 0) scale(1);
  transition: transform var(--motion-fast) var(--ease-standard);
}

.featureBookCard:active .bookCover {
  transform: translate3d(0, 1px, 0) scale(0.97);
}

.featureBookCard:active .continueChevron {
  transform: translate3d(2px, 1px, 0);
}
```

Extend reduced-motion coverage so these targets have no transform or transition in reduced-motion mode.

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

- [ ] **Step 2: Refresh preview and handoff**

Start a fresh production preview on a free port, create a Cloudflare quick tunnel, verify the HTML and CSS return `200`, and update `HANDOFF.md` with the latest code commit, summary, verification results, and preview URL.

- [ ] **Step 3: Push and check PR**

Run:

```powershell
git push origin codex/custom-background-settings
gh pr checks 1 --watch --interval 10
gh pr view 1 --json headRefName,headRefOid,mergeStateStatus,statusCheckRollup,url
```

Expected: PR points at the pushed HEAD, CI passes, and merge state is `CLEAN`.
