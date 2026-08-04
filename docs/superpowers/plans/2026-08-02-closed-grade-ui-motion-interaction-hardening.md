# Closed-Grade UI Motion and Interaction Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task by task. This execution is intentionally single-agent because the user explicitly requested no subagents.

**Goal:** Improve the existing PWA's animation, touch feedback, readability, responsive behavior, and sheet interactions to a polished commercial-software standard without changing product structure or introducing large visual redesigns.

**Architecture:** Keep existing React components, CSS Modules, semantic global tokens, and `MotionSheet` primitives. Add deterministic component state only where browser pseudo-state is unreliable, consolidate sheet dismissal decisions into the existing navigation gesture policy, and keep expensive full-screen visual effects off high-frequency input paths.

**Tech Stack:** Next.js, React, TypeScript, CSS Modules, Vitest, Playwright, OpenNext for Cloudflare Workers.

---

## Constraints

- Preserve all existing worktree changes; never use `git reset`, `git clean`, or destructive checkout commands.
- Make focused interaction-quality changes only—no navigation, information architecture, or brand redesign.
- Write or strengthen a failing regression test before each production change.
- Respect `prefers-reduced-motion`, keyboard input, pointer cancellation, safe areas, and semantic HTML.
- Keep all frequently used interactive targets at least 44 × 44 CSS pixels.
- Keep meaningful text and placeholders at WCAG AA contrast (4.5:1 for normal text).
- Finish with the complete unit, lint, build, and two-project Playwright verification gates before deployment.

## Task 1: Deterministic action-row press feedback

**Files:**

- Modify: `lib/accessibilityIntegration.test.ts`
- Modify: `app/LibrarySheetPages.tsx`
- Modify: `app/page.module.css`
- Verify: `e2e/interaction-fluidity.spec.ts`

### Steps

1. Add a source-contract test requiring `ActionRow` to expose deterministic pressed state and requiring a matching CSS rule.
2. Run the focused Vitest file and the existing isolated Playwright press-feedback test; preserve the failing output as the RED evidence.
3. Add local pointer/keyboard pressed state to `ActionRow`:
   - activate on pointer down and Space/Enter key down;
   - clear on pointer up, pointer cancel, pointer leave, lost capture, blur, and key up;
   - expose `data-pressed="true"` only while active.
4. Style the pressed state on the target row itself with an immediate background change and subtle one-pixel translation. Retain `:active` as a fallback and remove the translation under reduced motion.
5. Run focused Vitest and isolated Playwright tests until green.

## Task 2: Semantic text contrast and minimum touch geometry

**Files:**

- Modify: `lib/semanticTokens.test.ts`
- Modify: `lib/accessibilityIntegration.test.ts`
- Modify: `app/globals.css`
- Modify: `app/page.module.css`
- Verify: `e2e/accessibility-hardening.spec.ts`

### Steps

1. Extend token tests to require separate `--text-placeholder`, `--text-disabled`, and `--icon-tertiary` roles in every supported theme.
2. Extend CSS contract tests to require at least 44px height for workspace segments/actions/retries/material actions, reader settings rows, custom-background header controls, search controls, rename inputs, and manual-model inputs.
3. Run focused tests and confirm they fail before production edits.
4. Split decorative/disabled color roles from meaningful tertiary text:
   - use an AA-compliant tertiary/placeholder color in light, dark, and sepia themes;
   - preserve intentionally quieter icon and disabled roles separately;
   - remove placeholder opacity that reduces effective contrast.
5. Raise only the undersized control hit areas to 44px, preserving their current visual density through padding and internal alignment.
6. Add a concise `prefers-contrast: more` enhancement for borders and secondary text without changing default appearance.
7. Run focused unit tests and accessibility Playwright coverage.

## Task 3: Commit-based background slider and opaque content sheets

**Files:**

- Modify: `lib/settingsSurface.test.ts`
- Modify: `app/CustomBackgroundSettingsSurface.tsx`
- Modify: `app/page.module.css`
- Modify: `e2e/interaction-fluidity.spec.ts`

### Steps

1. Add tests requiring the slider to maintain a local draft value and commit preferences only at an interaction boundary; add a CSS assertion that high-frequency preview changes do not animate a blur filter.
2. Add an end-to-end assertion that the reading-workspace content sheet is visually opaque over library content.
3. Run the focused tests and confirm RED.
4. Implement a synchronized local opacity draft:
   - update only the low-cost preview overlay on `input`;
   - commit once on pointer up, pointer cancel, blur, or keyboard key up;
   - ignore duplicate commits when the value already matches persisted preferences.
5. Keep preview blur static and remove `filter` from transitions so dragging does not repeatedly repaint an animated blurred layer.
6. Give full-height content sheets an opaque semantic surface while retaining translucency for compact contextual sheets.
7. Run focused unit and end-to-end tests.

## Task 4: Text scaling and reader-settings theme consistency

**Files:**

- Modify: `lib/motionCss.test.ts`
- Modify: `lib/accessibilityIntegration.test.ts`
- Modify: `app/globals.css`
- Modify: `app/page.module.css`
- Modify: `e2e/accessibility-hardening.spec.ts`

### Steps

1. Add tests requiring reader-settings surfaces to use semantic tokens rather than hard-coded cream/dark colors, and require setting rows to meet 44px geometry.
2. Strengthen the 200% text-scale Playwright scenario to open and interact with the main sheets instead of checking only a book title.
3. Run the focused tests and confirm RED.
4. Introduce reader-control surface, border, text, and accent tokens for light, dark, and sepia themes.
5. Replace hard-coded colors in reader settings and custom-reader settings with these tokens; convert touched text sizes to the existing semantic type scale or `rem` values.
6. Add wrapping/min-width safeguards for narrow widths, landscape viewports, text zoom, and the software keyboard.
7. Run unit and 200%-scale end-to-end tests.

## Task 5: One sheet-dismissal gesture policy

**Files:**

- Modify: `lib/navigationGestures.test.ts`
- Modify: `lib/motionInteractions.test.ts`
- Modify: `lib/motionInteractions.ts`
- Verify: `app/MotionSheet.tsx`

### Steps

1. Move all sheet-dismissal threshold boundary cases into `navigationGestures.test.ts` and add a contract check that no second dismissal policy remains in `motionInteractions.ts`.
2. Run focused tests and confirm the new single-source contract fails.
3. Remove the unused duplicate `shouldDismissSheet` implementation and its duplicate tests. Keep `MotionSheet` on `shouldCompleteSheetDismiss` from `navigationGestures.ts`.
4. Run both gesture test files and the sheet interaction Playwright tests.

## Task 6: Full verification and visual review

**Files:**

- Modify as needed only when verification exposes an in-scope regression.

### Steps

1. Run the full Vitest suite: `npm.cmd test`.
2. Run lint: `npm.cmd run lint`.
3. Run a production build: `npm.cmd run build` with the worktree trace root configured.
4. Run both Playwright projects with the repository's established command/configuration.
5. Inspect representative light, dark, sepia, 200%-text, narrow, and content-sheet screenshots.
6. Re-run any failed command after a root-cause fix; do not waive failures.

## Task 7: Document, deploy, and push

**Files:**

- Modify: `HANDOFF.md`
- Optionally update: `docs/superpowers/specs/2026-08-02-closed-grade-ui-motion-interaction-hardening-design.md`

### Steps

1. Record implemented behavior, verification results, remaining physical-device acceptance risk, commit, deployment version, and production smoke result in `HANDOFF.md`.
2. Review `git diff --check`, `git status -sb`, and the complete scoped diff.
3. Commit intentionally grouped changes on `feat/pwa-interaction-fluidity`.
4. Build and deploy with the repository's established OpenNext/Cloudflare sequence:

   ```powershell
   $env:NEXT_PRIVATE_STANDALONE='true'
   $env:NEXT_PRIVATE_OUTPUT_TRACE_ROOT=(Get-Location).Path
   npm.cmd run build
   node node_modules\@opennextjs\cloudflare\dist\cli\index.js build --skipNextBuild
   node node_modules\@opennextjs\cloudflare\dist\cli\index.js deploy
   ```

5. Smoke-test the production origin and record the exact deployed Worker version.
6. Commit the final handoff update, push the current branch to `origin`, and verify the remote branch/PR state.

## Acceptance checklist

- [ ] All audited actions show visible feedback within 80ms for touch, mouse, and keyboard.
- [ ] Meaningful tertiary text and placeholders meet 4.5:1 contrast in light, dark, and sepia themes.
- [ ] Audited frequent controls provide at least 44 × 44 CSS-pixel targets.
- [ ] Background-opacity dragging does not update the full-screen filter on every input event.
- [ ] Full-height content sheets do not reveal underlying library content.
- [ ] Reader settings remain usable at 200% text scale, narrow width, landscape, and keyboard-open states.
- [ ] Reader settings use semantic theme tokens consistently.
- [ ] Sheet dismissal has one policy source with tested boundaries.
- [ ] Reduced-motion behavior remains functional and non-disorienting.
- [ ] Unit tests, lint, production build, and both Playwright projects pass.
- [ ] Production smoke test succeeds and the branch is pushed.
- [ ] Physical iPhone Safari, VoiceOver, and high-refresh acceptance is explicitly recorded as completed or outstanding.
