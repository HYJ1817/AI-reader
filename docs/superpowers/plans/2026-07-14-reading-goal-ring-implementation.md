# Themed Reading Goal Ring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Match the compact Reading dashboard goal ring to the supplied dark and light references without changing goal data or editing behavior.

**Architecture:** Replace the dashboard's CSS conic-gradient ring with a decorative inline SVG containing a permanent cyan U-shaped base arc and a brighter progress overlay. Keep numeric values and the surrounding button semantic, pass a normalized percentage from `page.tsx`, and define explicit light/dark theme tokens in `globals.css`.

**Tech Stack:** React 19, TypeScript, CSS Modules, SVG, Vitest, Playwright, Next.js 16, OpenNext for Cloudflare.

---

### Task 1: Lock the visual and data contract

**Files:**
- Modify: `lib/readingDashboardCss.test.ts`
- Modify: `e2e/reading-dashboard.spec.ts`

- [ ] **Step 1: Add a failing source/CSS contract test**

Extend `lib/readingDashboardCss.test.ts` with assertions that require:

```ts
it("renders a theme-aware U-shaped reading goal ring", () => {
  expect(source).toContain('className={styles.dashboardGoalRingSvg}');
  expect(source).toContain('className={styles.dashboardGoalArcBase}');
  expect(source).toContain('className={styles.dashboardGoalArcProgress}');
  expect(source).toContain('pathLength="100"');
  expect(source).toContain("goalPercent");
  expect(source).not.toContain("goalRingBackground");

  expect(css).toContain("--goal-ring-surface");
  expect(css).toContain("--goal-ring-border");
  expect(css).toContain("--goal-ring-arc");
  expect(css).toContain("--goal-ring-progress");
  expect(rule(".dashboardGoalRing")).toContain("width: 64px");
  expect(rule(".dashboardGoalArcBase")).toContain("stroke-linecap: round");
});
```

- [ ] **Step 2: Add failing Playwright theme evidence**

In `e2e/reading-dashboard.spec.ts`, add a test that imports a book, opens the
Reading tab, and asserts:

```ts
const ring = dashboard.locator('[data-reading-goal-ring="true"]');
const arc = ring.locator('[data-goal-arc="base"]');
await expect(ring).toHaveCSS("width", "64px");
await expect(arc).toHaveCSS("stroke-linecap", "round");
await expect(ring.getByText("0", { exact: true })).toBeVisible();
await expect(ring.getByText("120", { exact: true })).toBeVisible();
```

Switch `[data-app-shell="true"]` between `light` and `dark`, verify the ring
surface/target colors change, and save `goal-ring-light.png` and
`goal-ring-dark.png`.

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```powershell
npm.cmd test -- --run lib/readingDashboardCss.test.ts
npx.cmd playwright test e2e/reading-dashboard.spec.ts --project=iphone-14 -g "theme-aware goal ring"
```

Expected: both commands fail because the SVG classes, theme tokens, 64px
geometry, and ring marker do not exist yet.

### Task 2: Implement the SVG goal ring

**Files:**
- Modify: `app/ReadingDashboard.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Modify: `app/page.module.css`
- Test: `lib/readingDashboardCss.test.ts`
- Test: `e2e/reading-dashboard.spec.ts`

- [ ] **Step 1: Replace the background prop with a percentage**

Change the dashboard prop from:

```ts
goalRingBackground: CSSProperties["background"];
```

to:

```ts
goalPercent: number;
```

In `page.tsx`, replace the conic-gradient string with:

```ts
const goalPercent = Math.round(todayGoalProgress * 1000) / 10;
```

and pass `goalPercent={goalPercent}` to `ReadingDashboard`.

- [ ] **Step 2: Render the permanent arc and live progress overlay**

Inside `.dashboardGoalRing`, render:

```tsx
<svg
  className={styles.dashboardGoalRingSvg}
  viewBox="0 0 64 64"
  aria-hidden="true"
>
  <path
    className={styles.dashboardGoalArcBase}
    data-goal-arc="base"
    d="M 13 44 A 23 23 0 1 1 51 44"
    pathLength="100"
  />
  <path
    className={styles.dashboardGoalArcProgress}
    data-goal-arc="progress"
    d="M 13 44 A 23 23 0 1 1 51 44"
    pathLength="100"
    style={{ strokeDasharray: `${Math.max(0, Math.min(goalPercent, 100))} 100` }}
  />
</svg>
```

Keep the two animated numeric values above the SVG and add
`data-reading-goal-ring="true"` to the ring wrapper.

- [ ] **Step 3: Add theme tokens and reference-matched styling**

Add light defaults to `:root`, dark values to system dark and
`[data-reader-theme="dark"]`, explicit light values to
`[data-reader-theme="light"]`, and sepia-compatible values to
`[data-reader-theme="sepia"]`:

```css
--goal-ring-surface: #ffffff;
--goal-ring-border: rgba(60, 60, 67, 0.2);
--goal-ring-arc: #24bfdc;
--goal-ring-progress: #72e4f5;
--goal-ring-target: #111111;
```

Dark mode uses `#1c1c1e` for the surface, a restrained white rim, the same cyan
family, and white target text. Style `.dashboardGoalRing` as a 64px circular
surface with a fine rim; absolutely position the SVG; use `fill: none`, 7px
strokes, rounded caps, and a dash transition on the progress path. Preserve the
existing press transform and reduced-motion override.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```powershell
npm.cmd test -- --run lib/readingDashboardCss.test.ts lib/readingDashboard.test.ts
npx.cmd playwright test e2e/reading-dashboard.spec.ts --project=iphone-14 -g "theme-aware goal ring"
npm.cmd exec -- eslint app/ReadingDashboard.tsx app/page.tsx
```

Expected: all focused tests pass and light/dark screenshots contain the
reference-matched open-bottom cyan ring.

- [ ] **Step 5: Commit the implementation**

```powershell
git add app/ReadingDashboard.tsx app/page.tsx app/globals.css app/page.module.css lib/readingDashboardCss.test.ts e2e/reading-dashboard.spec.ts docs/superpowers/plans/2026-07-14-reading-goal-ring-implementation.md
git commit -m "style: match reading goal ring themes"
```

### Task 3: Verify, deploy, and close out

**Files:**
- Modify: `HANDOFF.md`
- Modify: `docs/superpowers/plans/2026-07-14-reading-goal-ring-implementation.md`

- [ ] **Step 1: Run the full local gate**

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd run test:e2e
git diff --check
```

Expected: full Vitest, ESLint, webpack, and both Playwright projects pass.

- [ ] **Step 2: Run the Impeccable changed-source detector**

```powershell
node C:\aaa\.agents\skills\impeccable\scripts\detect.mjs --json app\ReadingDashboard.tsx app\page.tsx
```

Expected: JSON `[]` and exit code 0.

- [ ] **Step 3: Deploy with the established Windows OpenNext sequence**

```powershell
$env:NEXT_PRIVATE_STANDALONE='true'
$env:NEXT_PRIVATE_OUTPUT_TRACE_ROOT=(Get-Location).Path
npm.cmd run build
node node_modules\@opennextjs\cloudflare\dist\cli\index.js build --skipNextBuild
node node_modules\@opennextjs\cloudflare\dist\cli\index.js deploy
```

Record the new Worker version.

- [ ] **Step 4: Verify production and close out**

Verify `https://881817.xyz` plus every discovered JS/CSS asset returns HTTP
200. Run the focused goal-ring Playwright test on both iPhone projects against
production and inspect light/dark screenshots. Update `HANDOFF.md` with the
implementation commit, Worker version, test totals, and next-chat opener.

- [ ] **Step 5: Commit, push, and verify equality**

```powershell
git add HANDOFF.md docs/superpowers/plans/2026-07-14-reading-goal-ring-implementation.md
git commit -m "docs: complete reading goal ring refresh"
git push origin codex/custom-background-settings
git status -sb
git rev-parse HEAD
git rev-parse origin/codex/custom-background-settings
```

Expected: working tree clean and local/remote commit hashes equal.
