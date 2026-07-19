# Reading Week Bars Polish Plan

## Objective

Polish the Reading tab's seven-day bar chart with a small CSS-only motion and
state hierarchy improvement.

## Steps

1. Add focused dashboard CSS coverage before implementation:
   - `.weekBars > div` has transform baseline and transition.
   - `.weekBarTrack span` uses bottom-origin transform and enter animation.
   - `@keyframes weekBarIn` animates opacity and `scaleY`.
   - `.weekBarToday .weekBarTrack` transitions box-shadow and transform.
   - `.weekBarToday small` transitions color and transform.
   - reduced-motion rules disable animation, transition, and transform.
2. Run `npm.cmd run test -- lib/readingDashboardCss.test.ts` and confirm the
   new test fails for the missing polish.
3. Update `app/page.module.css`:
   - add stable transform baselines to week day cells;
   - animate bar fills from the bottom;
   - add a subtle today lift/ring and label lift;
   - add reduced-motion coverage.
4. Re-run focused tests, then full verification:
   - `npm.cmd run test -- lib/readingDashboardCss.test.ts`
   - `npm.cmd run test`
   - `npm.cmd exec -- eslint app lib`
   - `npm.cmd run build`
   - `git diff --check`
5. Commit implementation, refresh `HANDOFF.md`, push, verify PR checks, and
   refresh the preview link if the build changes assets.
