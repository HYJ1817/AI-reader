# AI Reader UI Quality Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AI Reader's daily iPhone reading path book-first, typographically comfortable, visually quiet, semantically clear, and accessible, raising the Impeccable critique baseline from 26/40 to at least 32/40 with no P0 or P1 findings.

**Architecture:** This is a coordination roadmap for five independent UI subprojects. Only one phase may be active at a time; each phase receives its own approved design spec and detailed implementation plan before code changes, then completes focused tests, full regression, production verification, and handoff refresh before its top-level checkbox is marked complete.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS Modules, Motion, Vitest, Playwright, OpenNext for Cloudflare Workers.

---

## Working Rules

- Preserve IndexedDB books, progress, groups, settings, custom backgrounds, AI providers, and backups.
- Do not run `git reset`, `git clean`, or overwrite unrelated user changes.
- Keep `https://881817.xyz` as the primary preview and production URL.
- Do not resume speculative EPUB dark-canvas CSS work without the affected EPUB or Safari Web Inspector evidence.
- Do not mix phases in one implementation commit. Finish, verify, deploy, and check off one phase before starting the next.
- A phase is complete only when every child checkbox is complete. Code completion alone does not count.
- Update this roadmap with a small patch after each completed phase. Change `[ ]` to `[x]`; do not rewrite the file wholesale.

## Progress

- [x] **Phase 0: Establish the baseline and master tracker**
  - [x] Inspect the current iPhone screenshots and representative source files.
  - [x] Compare the product with current Apple Books and Apple HIG guidance.
  - [x] Record the 26/40 critique baseline in `.impeccable/critique/2026-07-14T05-35-13Z__app.md`.
  - [x] Create this ordered roadmap with measurable completion gates.

- [x] **Phase 1: Reading typography and unobstructed reading canvas**
  - [x] Approve `docs/superpowers/specs/2026-07-14-reader-typography-design.md`.
  - [x] Create the phase implementation plan under `docs/superpowers/plans/`.
  - [x] Add failing regression coverage for English, Chinese, and mixed-language TXT typography.
  - [x] Implement explicit preference-driven alignment while preserving the approved line rhythm and paragraph spacing.
  - [x] Prevent the reader menu affordance from obscuring readable text.
  - [x] Verify focused typography, reader chrome, EPUB ambient, and motion tests.
  - [x] Run the full Vitest, ESLint, webpack build, native-navigation E2E, and `git diff --check` gates.
  - [x] Deploy to `https://881817.xyz` and verify the production assets and reading path.
  - [x] Confirm the visible result with iPhone-sized screenshots; physical-iPhone confirmation remains a documented non-blocking risk until a device is available.
  - [x] Refresh `HANDOFF.md`, commit the phase, and mark Phase 1 complete.

- [x] **Phase 2: Distill global chrome and navigation scale**
  - [x] Approve `docs/superpowers/specs/2026-07-14-global-chrome-design.md` and `docs/superpowers/plans/2026-07-14-global-chrome-implementation.md`.
  - [x] Add failing CSS and integration coverage for compact titles, tab-bar dimensions, active state, safe areas, and 44px minimum targets.
  - [x] Reduce the visual weight of large titles, the 72px tab bar, active-tab capsule, highlights, and shadows without changing the three root destinations.
  - [x] Preserve root state, focus restoration, reduced motion, edge Back, and reader presentation behavior.
  - [x] Run focused motion/navigation tests and both iPhone Playwright projects.
  - [x] Run the full Vitest, ESLint, webpack build, and `git diff --check` gates.
  - [x] Deploy, verify production screenshots and frame cadence, refresh `HANDOFF.md`, commit, and mark Phase 2 complete.

- [ ] **Phase 3: Redesign the Reading tab's low-data experience and semantics**
  - [ ] Approve a low-data information-architecture design spec and phase implementation plan.
  - [ ] Decide explicitly whether the destination remains `阅读`, becomes `进度`, or opens the most recent book directly.
  - [ ] Add failing tests for empty library, imported-but-unread, active-reading, and populated-week states.
  - [ ] Make continue/import the primary low-data action and progressively reveal goals and charts only when they carry information.
  - [ ] Preserve reading-minute calculations, goals, streak data, and continue-reading behavior.
  - [ ] Run focused dashboard tests plus full Vitest, ESLint, webpack build, native-navigation E2E, and `git diff --check`.
  - [ ] Deploy, verify every data state on production, refresh `HANDOFF.md`, commit, and mark Phase 3 complete.

- [ ] **Phase 4: Make the Library book-first instead of file-first**
  - [ ] Approve a library information-hierarchy design spec and phase implementation plan.
  - [ ] Add failing coverage for title, author/source fallback, last-read position, progress, and missing-cover presentation.
  - [ ] Prioritize cover, title, author/source, current position, and last-read time; move file format and byte size to secondary detail.
  - [ ] Reduce duplicated collection/count/search/view-toggle visual weight while preserving edit, grouping, filtering, pagination, and import behavior.
  - [ ] Verify grid and list views, selection mode, book actions, collection filters, focus return, and large libraries.
  - [ ] Run focused library tests plus full Vitest, ESLint, webpack build, native-navigation E2E, and `git diff --check`.
  - [ ] Deploy, verify production library states, refresh `HANDOFF.md`, commit, and mark Phase 4 complete.

- [ ] **Phase 5: Accessibility and final interaction hardening**
  - [ ] Approve an accessibility hardening spec and phase implementation plan against the stabilized Phase 1-4 UI.
  - [ ] Add failing coverage for `:focus-visible`, non-color state cues, 200% text scaling, reduced motion, contrast-sensitive surfaces, and keyboard navigation.
  - [ ] Introduce scalable UI typography tokens and responsive stacking for crowded metadata and actions.
  - [ ] Restore a consistent visible focus treatment and audit accessible names, roles, disabled/loading states, and 44px targets.
  - [ ] Verify light, dark, sepia, custom-background, software-keyboard, and safe-area states.
  - [ ] Run full Vitest, ESLint, webpack build, both iPhone Playwright projects, production smoke, and `git diff --check`.
  - [ ] Deploy, complete real-iPhone verification where available, refresh `HANDOFF.md`, commit, and mark Phase 5 complete.

- [ ] **Phase 6: Final critique and closeout**
  - [ ] Re-run Impeccable critique against `app` and record the new score and trend.
  - [ ] Confirm a score of at least 32/40 with no P0 or P1 findings; if the gate fails, add only the remaining findings as new checked tasks below this phase.
  - [ ] Run the complete repository verification and deployed `https://881817.xyz` smoke suite once more.
  - [ ] Update `HANDOFF.md` with the final code commit, Worker version, completed roadmap, remaining physical-device risks, and next-chat opener.
  - [ ] Push the branch and confirm local and remote branch state match.
  - [ ] Mark Phase 6 complete and close the UI quality goal.

## Phase File Map

### Phase 1

- Modify: `app/ReadingSession.tsx`
- Modify: `app/ReaderControls.tsx`
- Modify: `app/page.module.css`
- Test: `lib/readerChromeIntegration.test.ts`
- Test: `lib/epubAmbientIntegration.test.ts`
- Create: `lib/readerTypography.test.ts`
- Create: `e2e/reader-typography.spec.ts`

### Phase 2

- Modify: `app/AppNavigation.tsx`
- Modify: `app/page.module.css`
- Test: `lib/motionCss.test.ts`
- Test: `lib/navigationMotion.test.ts`
- Create: `lib/navigationChrome.test.ts`
- Test: `e2e/native-navigation.spec.ts`

### Phase 3

- Modify: `app/ReadingDashboard.tsx`
- Modify: `app/AppNavigation.tsx` only if the approved design changes the destination label or behavior.
- Modify: `app/page.tsx` only if the approved design changes root orchestration.
- Modify: `app/page.module.css`
- Test: `lib/readingDashboardCss.test.ts`
- Create: `lib/readingDashboardIntegration.test.ts`
- Test: `e2e/native-navigation.spec.ts`

### Phase 4

- Modify: `app/LibrarySurface.tsx`
- Modify: `app/BookCover.tsx`
- Modify: `app/page.module.css`
- Modify: `lib/libraryPresentation.ts`
- Test: `lib/libraryPresentation.test.ts`
- Test: `lib/libraryDashboard.test.ts`
- Test: `lib/libraryBookActionsIntegration.test.ts`
- Test: `lib/libraryMotionIntegration.test.ts`

### Phase 5

- Modify: `app/globals.css`
- Modify: `app/page.module.css`
- Modify only the components whose approved accessibility tests expose concrete defects.
- Create: `lib/accessibilityIntegration.test.ts`
- Test: `lib/motionCss.test.ts`
- Test: `e2e/native-navigation.spec.ts`

## Standard Verification Gate

Run this gate before checking off any implementation phase:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-14
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-15-pro-max
git diff --check
git status -sb
```

Expected result: every command passes, generated artifacts remain ignored, and the status output contains only the intentional phase files.

For a production deployment, use the established Windows OpenNext sequence:

```powershell
$env:NEXT_PRIVATE_STANDALONE='true'
$env:NEXT_PRIVATE_OUTPUT_TRACE_ROOT=(Get-Location).Path
npm.cmd run build
node node_modules\@opennextjs\cloudflare\dist\cli\index.js build --skipNextBuild
node node_modules\@opennextjs\cloudflare\dist\cli\index.js deploy
```

Expected result: a new `ai-reader-pwa` Worker version is published to `881817.xyz/*`, the root and discovered JS/CSS assets return HTTP 200, and the deployed phase behavior matches the verified local build.
