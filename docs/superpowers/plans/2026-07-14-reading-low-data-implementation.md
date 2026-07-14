# Reading Low-Data Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan inline. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make import, start, or continue the first useful action on the Reading root and progressively reveal goal/history content across four data states.

**Architecture:** Add a pure `readingDashboardPresentation` state builder, then render `ReadingDashboard` from that result without changing persistence or handlers. Lock the behavior with unit/source contracts and IndexedDB-backed Playwright states.

**Tech Stack:** React 19, TypeScript, CSS Modules, Motion, Dexie/IndexedDB, Vitest, Playwright, OpenNext for Cloudflare Workers.

---

## File Structure

- Create `lib/readingDashboardPresentation.ts`: normalize inputs and return one of four display states plus visibility/action labels.
- Create `lib/readingDashboardPresentation.test.ts`: exercise all four states.
- Modify `app/ReadingDashboard.tsx`: render primary action first, then optional goal and week sections.
- Modify `lib/uiText.ts`: add the small set of reading-state labels.
- Modify `app/page.module.css`: compact goal geometry and style the open empty state.
- Modify `lib/readingDashboardCss.test.ts`: lock hierarchy, metadata removal, locators, and geometry.
- Create `e2e/reading-dashboard.spec.ts`: seed real IndexedDB states and capture iPhone screenshots.
- Modify roadmap and `HANDOFF.md` only after production evidence exists.

## Task 1: Add failing state and composition coverage

- [x] Create the pure state tests for `empty-library`, `imported-unread`, `active-reading`, and `populated-week` with explicit `showGoal`, `showWeek`, `showProgress`, and action-label assertions.
- [x] Extend the CSS/source contract to require primary-before-goal ordering, stable state locators, 52px goal ring, no `formatBookSize`, and conditional week rendering.
- [x] Create the four IndexedDB-backed Playwright cases and screenshot names `reading-empty.png`, `reading-unread.png`, `reading-active.png`, and `reading-week.png`.
- [x] Run `npm.cmd test -- lib/readingDashboardPresentation.test.ts lib/readingDashboardCss.test.ts` and the iPhone 14 Playwright file; confirm RED is caused by the missing helper and state markup.

## Task 2: Implement the state-aware hierarchy

- [x] Add `buildReadingDashboardPresentation` with `totalMinutes > 0` taking precedence for `populated-week`, followed by positive progress for `active-reading`, then imported and empty states.
- [x] Keep the label `阅读`; render import/start/continue first and attach the approved data attributes and accessible labels.
- [x] Remove file format/size from the Reading surface and show semantic progress only when useful.
- [x] Render the compact goal row only when a book exists and the week chart only when total minutes are positive.
- [x] Add only the approved copy tokens and CSS; retain existing handlers, Motion values, hairlines, and reduced-motion rules.
- [x] Run the focused Vitest and iPhone 14 Playwright cases until GREEN, then inspect all four screenshots.
- [x] Commit the implementation as `style: prioritize reading actions by data state`.

## Task 3: Full local verification

- [x] Run full Vitest, configured ESLint, webpack build, and `git diff --check`.
- [x] Run native-navigation on iPhone 14 and iPhone 15 Pro Max.
- [x] Run reader-typography and reading-dashboard Playwright on both iPhone projects.
- [x] Confirm generated artifacts remain ignored and no unrelated user files changed.

## Task 4: Deploy and close Phase 3

- [x] Deploy with `NEXT_PRIVATE_STANDALONE=true`, `NEXT_PRIVATE_OUTPUT_TRACE_ROOT`, webpack build, OpenNext build, and OpenNext deploy.
- [x] Verify the production root and all discovered JS/CSS assets return 200 and contain the new dashboard markers.
- [x] Run all four production dashboard states plus critical navigation on iPhone 14 and inspect the production screenshots.
- [x] Update `HANDOFF.md`, check every Phase 3 roadmap item and this plan, then commit `docs: complete reading low-data phase`.
- [x] Push the current branch without rewriting history and confirm local/remote equality.
