# Accessibility and Interaction Hardening Implementation Plan

**Goal:** Make the daily iPhone reading path visibly focusable, natively
keyboard-operable, semantically explicit, 44px-safe, and resilient to 200% text.

## Task 1: Lock the accessibility contract in failing tests

- [x] Add source/CSS coverage for the global focus ring, native Library row
  controls, view-mode pressed state, Ask AI status/names, and scalable tokens.
- [x] Add Playwright keyboard coverage for Library list open/More separation and
  visible focus.
- [x] Add Playwright geometry and 200% text-size coverage on both phone projects.
- [x] Run the focused tests and record only the intended failures.

## Task 2: Implement native semantics and focus

- [x] Add a theme-aware global `:focus-visible` treatment and remove the root-tab
  outline suppression.
- [x] Split Library list rows into a primary native button and separate More
  button while preserving selection, Motion, shared-cover, and press feedback.
- [x] Give Library view mode grouped pressed-state semantics.
- [x] Make Ask AI configuration/submit controls native and named; announce busy,
  message, success, and error state changes appropriately.
- [x] Add live status semantics to backup and model refresh feedback.

## Task 3: Harden target size and text reflow

- [x] Raise audited frequent compact controls to a 44px interactive box without
  enlarging their glyphs.
- [x] Add named `rem` typography tokens and migrate daily-path UI text.
- [x] Add responsive wrapping/stacking for headers, Library metadata, Settings
  rows, and compact action groups under enlarged text.
- [x] Inspect light/dark/sepia/custom-background, reduced-motion, software
  keyboard, and 200% screenshots; fix only evidenced defects.

## Task 4: Verify, deploy, and close Phase 5

- [x] Run focused and full Vitest, ESLint, webpack build, `git diff --check`, and
  the complete two-device Playwright suite.
- [x] Run the Impeccable targeted scan on changed components and CSS.
- [ ] Deploy with the established Windows OpenNext sequence.
- [ ] Verify production root/assets, keyboard path, geometry, enlarged text,
  screenshots, and critical navigation.
- [ ] Update the roadmap and `HANDOFF.md`, commit, push, and confirm local/remote
  equality. Physical-iPhone confirmation remains non-blocking when unavailable.
