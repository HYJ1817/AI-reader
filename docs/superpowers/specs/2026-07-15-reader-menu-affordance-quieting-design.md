# Reader Menu Affordance Quieting Design

**Status:** Approved on 2026-07-15.

**Scope:** A focused post-roadmap refinement of the persistent reader menu toggle. The completed UI quality roadmap remains closed.

## Problem

The reader menu toggle is deliberately always available because direct taps inside EPUB content proved unreliable on iPhone Safari. Its collapsed treatment is already smaller than the open-state control, but the three-line icon and edge surface still compete with long-form text during stable reading.

The refinement must preserve the reliability work that made the control continuously tappable. It must not return to iframe-dependent tap handling, introduce a second control, or reduce the semantic touch target below 48px by 48px.

## Goals

- Reduce the painted weight of the closed reader menu toggle in light, dark, sepia, and custom-background reading sessions.
- Preserve one continuously available 48px by 48px button and the existing open/close interaction path.
- Keep the open state, keyboard focus, press feedback, accessible name, and expanded-state semantics clear.
- Avoid new timers, scroll listeners, persistence, onboarding state, or layout changes.
- Verify the result on both configured iPhone viewports before deployment.

## Non-goals

- Removing the menu toggle or relying on TXT/EPUB canvas taps as the only entry point.
- Adding first-use discovery, coach marks, help pages, or saved dismissal state.
- Redesigning the reader action menu, page indicator, close button, typography, pagination, or gestures.
- Changing reader body padding, EPUB publisher styles, custom layout preferences, or the unresolved dark EPUB ambient canvas behavior.
- Reopening UI quality roadmap Phases 1 through 6.

## Considered Approaches

### A. Static quiet collapsed state, chosen

Keep the existing `visible`-derived collapsed and expanded classes. Make the collapsed state a restrained right-edge cue while leaving the button box and behavior intact. This is deterministic, CSS-led, and has the smallest regression surface.

### B. Time- or scroll-adaptive fading

Fade the toggle after inactivity and restore it after scrolling or tapping. This could become quieter, but it introduces timers, event ownership, state transitions, and a control that changes without an explicit user action. The additional complexity is not justified for this refinement.

### C. Remove the persistent toggle

Use content taps alone to reveal reader chrome. This conflicts with the established iPhone reliability evidence and is rejected.

## Chosen Design

`ReaderControls` continues to render one native button. The existing `visible` prop remains the sole state authority:

- **Collapsed:** the 48px by 48px button remains fully present, visible to accessibility APIs, pointer-active, and positioned inside the existing safe-area geometry. Only a narrow trailing-edge surface is painted. The surface has no drop shadow, uses a lower-contrast border/background mix, and the menu glyph is smaller and less opaque than today. The transparent portion of the hit area does not paint over text.
- **Expanded:** the same button keeps the current complete circular surface, clearer glyph, border, and shadow so it remains a recognizable anchor for closing the action menu.
- **Focus and press:** `:focus-visible` must remain visibly distinct in every theme. Press feedback may use the existing transform and color tokens. Reduced-motion mode removes transforms and transitions as it does today.

No inactivity timer or automatic state transition is added. The visual state changes only when the existing reader chrome state changes.

## Architecture and Files

### `app/ReaderControls.tsx`

No behavioral change is expected. The component retains the single button, `aria-label`, `aria-expanded`, `data-reader-menu-toggle`, `onWakeMenu`, and the two `visible`-derived classes. Markup changes are allowed only if needed to make the visual layer independently testable without duplicating the control.

### `app/page.module.css`

Refine the collapsed pseudo-element and glyph treatment. Reuse existing color, motion, and focus tokens. The base button remains 48px by 48px with `pointer-events: auto` and `visibility: visible`. The expanded rule remains materially stronger than the collapsed rule.

### Tests

Extend the existing reader menu and motion contract tests instead of creating a parallel suite. The tests should lock the interaction and accessibility invariants while allowing future numerical tuning within the approved quiet direction.

## Edge Cases

- Light, dark, sepia, and custom ambient surfaces must retain sufficient cue contrast without an opaque floating plate.
- The collapsed cue must not disappear in reduced-motion mode; only its movement is removed.
- The expanded toggle must remain visibly associated with the open menu.
- The control must remain tappable both while the menu is closed and while its rows animate out.
- Safe-area positioning and the current bottom-corner location remain unchanged.
- TXT and EPUB reading paths use the same control and receive no content-specific behavior.

## Verification Strategy

1. Update focused contract tests first so they fail against the current collapsed styling and preserve the 48px, pointer, visibility, accessibility, and state-class invariants.
2. Implement the minimum CSS/markup change needed to satisfy the approved quiet treatment.
3. Run focused reader-menu, reader-chrome, motion, and ambient regression tests.
4. Run the full Vitest suite, configured ESLint, webpack production build, and `git diff --check`.
5. Run the local Playwright suites on iPhone 14 and iPhone 15 Pro Max, including a reader menu open/close check and light/dark screenshots of the collapsed state.
6. Inspect the screenshots for text competition, safe-area placement, theme contrast, and clear expanded-state feedback.
7. Build and deploy through the documented Windows OpenNext standalone sequence, verify the production root and discovered JS/CSS assets, and rerun the focused production reader case.
8. Record the implementation commit, verification evidence, and Worker version in `HANDOFF.md` without reopening the completed roadmap.

## Completion Criteria

- The closed toggle reads as a quiet edge cue rather than a floating control.
- The open toggle remains obvious and the same button opens and closes the menu.
- The interactive target remains 48px by 48px and retains its current accessibility contract.
- Focus, press, reduced-motion, safe-area, TXT, and EPUB regressions remain covered.
- Full local verification passes, production assets are healthy, and `HANDOFF.md` reflects the deployed state.
