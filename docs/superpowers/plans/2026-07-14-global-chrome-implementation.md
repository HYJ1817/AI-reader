# Global Chrome and Navigation Scale Implementation Plan

**Goal:** Execute Phase 2 of the UI quality roadmap by compacting root titles and bottom navigation while preserving navigation architecture and interaction reliability.

**Architecture:** Keep `AppNavigation` and the persistent root stack intact. Add active-destination semantics to the existing buttons, express the compact geometry through CSS tokens, and retain the shared Motion indicator as a transparent track containing a small visible tint line.

**Execution:** Inline execution is pre-authorized by the user. Follow TDD, inspect both iPhone screenshots, deploy only after the full local gate, and check the roadmap phase only after production evidence exists.

## Task 1: Lock the approved chrome contract in failing tests

- [ ] Create `lib/navigationChrome.test.ts` for title scale, navigation tokens, 44px targets, quiet material, active semantics, indicator shape, and safe-area clearance.
- [ ] Extend `e2e/native-navigation.spec.ts` with computed geometry, `aria-current`, active-state switching, and screenshot evidence.
- [ ] Run the focused Vitest and iPhone 14 browser test and confirm failures describe only the missing Phase 2 behavior.

## Task 2: Implement the minimal chrome changes

- [ ] Add an accessible name to the root navigation and `aria-current="page"` to exactly the active destination without changing click paths.
- [ ] Add root-navigation dimension tokens and update content/batch-bar clearance to use them.
- [ ] Reduce the root title to 34px/750 and normalize header action targets to 44px.
- [ ] Reduce the tab bar to 60px, quiet its material, remove the decorative glint, and use 24px icons with 11px labels.
- [ ] Replace the active capsule material with a centered 24px by 2px moving tint line while retaining the shared Motion track and spring.
- [ ] Run focused Vitest plus the iPhone 14 browser test and confirm GREEN.
- [ ] Inspect library, reading, settings, and mid-transition screenshots; tighten a failing assertion before any corrective styling.
- [ ] Commit the verified implementation separately from closeout documentation.

## Task 3: Run the full local gate

- [ ] Run full Vitest, configured ESLint, webpack build, and `git diff --check`.
- [ ] Run the complete native-navigation suite on iPhone 14 and iPhone 15 Pro Max.
- [ ] Run Phase 1 reader-typography regression on both iPhone projects.
- [ ] Confirm generated artifacts remain ignored and no unrelated user files changed.

## Task 4: Deploy and close Phase 2

- [ ] Build and deploy with the established Windows OpenNext sequence.
- [ ] Verify the production root and every discovered JS/CSS asset return 200 and contain the Phase 2 markers.
- [ ] Run the focused production chrome test, critical navigation smoke, and screenshot capture on iPhone 14.
- [ ] Update `HANDOFF.md` with implementation commit, Worker version, local/production evidence, screenshot paths, and remaining physical-device risk.
- [ ] Check every Phase 2 roadmap child item, then check Phase 2 itself.
- [ ] Run the documentation diff gate, commit closeout documentation, push the current branch without rewriting history, and confirm local/remote equality.

