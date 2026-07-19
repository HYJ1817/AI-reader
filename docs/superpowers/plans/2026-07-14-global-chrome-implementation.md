# Global Chrome and Navigation Scale Implementation Plan

**Goal:** Execute Phase 2 of the UI quality roadmap by compacting root titles and bottom navigation while preserving navigation architecture and interaction reliability.

**Architecture:** Keep `AppNavigation` and the persistent root stack intact. Add active-destination semantics to the existing buttons, express the compact geometry through CSS tokens, and retain the shared Motion indicator as a transparent track containing a small visible tint line.

**Execution:** Inline execution is pre-authorized by the user. Follow TDD, inspect both iPhone screenshots, deploy only after the full local gate, and check the roadmap phase only after production evidence exists.

## Task 1: Lock the approved chrome contract in failing tests

- [x] Create `lib/navigationChrome.test.ts` for title scale, navigation tokens, 44px targets, quiet material, active semantics, indicator shape, and safe-area clearance.
- [x] Extend `e2e/native-navigation.spec.ts` with computed geometry, `aria-current`, active-state switching, and screenshot evidence.
- [x] Run the focused Vitest and iPhone 14 browser test and confirm failures describe only the missing Phase 2 behavior.

## Task 2: Implement the minimal chrome changes

- [x] Add an accessible name to the root navigation and `aria-current="page"` to exactly the active destination without changing click paths.
- [x] Add root-navigation dimension tokens and update content/batch-bar clearance to use them.
- [x] Reduce the root title to 34px/750 and normalize header action targets to 44px.
- [x] Reduce the tab bar to 60px, quiet its material, remove the decorative glint, and use 24px icons with 11px labels.
- [x] Replace the active capsule material with a centered 24px by 2px moving tint line while retaining the shared Motion track and spring.
- [x] Run focused Vitest plus the iPhone 14 browser test and confirm GREEN.
- [x] Inspect library, reading, settings, and mid-transition screenshots; tighten a failing assertion before any corrective styling.
- [x] Commit the verified implementation separately from closeout documentation.

## Task 3: Run the full local gate

- [x] Run full Vitest, configured ESLint, webpack build, and `git diff --check`.
- [x] Run the complete native-navigation suite on iPhone 14 and iPhone 15 Pro Max.
- [x] Run Phase 1 reader-typography regression on both iPhone projects.
- [x] Confirm generated artifacts remain ignored and no unrelated user files changed.

## Task 4: Deploy and close Phase 2

- [x] Build and deploy with the established Windows OpenNext sequence.
- [x] Verify the production root and every discovered JS/CSS asset return 200 and contain the Phase 2 markers.
- [x] Run the focused production chrome test, critical navigation smoke, and screenshot capture on iPhone 14.
- [x] Update `HANDOFF.md` with implementation commit, Worker version, local/production evidence, screenshot paths, and remaining physical-device risk.
- [x] Check every Phase 2 roadmap child item, then check Phase 2 itself.
- [x] Run the documentation diff gate, commit closeout documentation, push the current branch without rewriting history, and confirm local/remote equality.
