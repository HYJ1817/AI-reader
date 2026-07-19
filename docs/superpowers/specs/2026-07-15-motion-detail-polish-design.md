# Motion Detail Polish Design

**Status:** Approved on 2026-07-15 through the motion critique and the user's instruction to execute the recommended defaults without further confirmation.

**Scope:** Refine the existing navigation, sheet, reader, and Library progress motion. The completed UI roadmap remains closed; this work addresses only the five findings in the latest motion critique.

## Problem

AI Reader already has a restrained native motion system, shared-cover reader continuity, reduced-motion support, and disciplined gesture ownership. The remaining friction comes from inconsistent modal focus ownership, a reader close that is slower than a repeated utility action should be, a missing progress-settle confirmation on return to Library, weak first-use discovery of auto-hidden reader controls, and duplicated timing ownership.

The solution should make the app feel faster and more coherent without adding decorative effects, new visual vocabulary, dependencies, or persistence migrations.

## Goals

- Make `MotionSheet` the shared owner of initial focus, Tab containment, background isolation, and post-exit focus restoration.
- Keep the shared-cover opening moment while reducing reader opening to about 300ms and closing to about 220ms with no inherited exit delay.
- Animate Library featured and list progress over the existing local-state duration when reading progress changes.
- Keep reader controls expanded for a first-time user until the first explicit tap toggles them, then remember that discovery locally.
- Consolidate motion roles in `motionSystem.ts`, align the CSS role variables through a parity test, and give reader swipe-settle duration one pure owner.
- Preserve reduced-motion, browser Back, shared origins, focus return, gestures, themes, IndexedDB content, and current reader behavior.

## Non-goals

- Adding page-load choreography, pulsing hints, tooltips, tours, confetti, bounce, blur reveals, or another motion runtime.
- Redesigning Reader Appearance, the Library layout, navigation structure, or reading settings.
- Changing EPUB pagination, reading-position semantics, book persistence, sync, AI behavior, or deployment architecture.
- Reopening completed UI phases or attempting the unresolved EPUB dark-canvas issue.

## Considered Approaches

### A. Shared contracts and quiet state feedback, chosen

Centralize modal behavior and timing roles, shorten the repeated reader exit, use the progress bar as the completion cue, and keep the first-use control visible until one explicit toggle. This fixes the observed friction while preserving the current product vocabulary.

### B. Add contextual chips and richer reader choreography

Show a one-time `更多选项` chip and add more staged reader motion. This is more explicit, but adds copy, persistence, layout pressure, and animation to a reading canvas that is intentionally quiet.

### C. Timing-only cleanup

Normalize durations without changing focus or discovery behavior. This is lower risk but leaves the only P1 accessibility issue unresolved and does not improve first-use comprehension.

## Chosen Experience

### Shared sheet focus contract

When a sheet mounts, `MotionSheet` records the active element and the original inert state of the app-shell siblings. It then isolates all siblings outside the active sheet host and focuses either the supplied `initialFocusRef`, the first focusable element, or the panel fallback. Tab and Shift+Tab wrap inside the panel. Escape retains the existing close behavior.

The isolation remains active throughout the exit animation. Cleanup restores each sibling's original inert state and then restores the opening control when it is still connected. Nested sheets may unmount their opener; in that case the remounted parent sheet applies its own initial-focus contract.

`ReadingGoalSheet` supplies its close button as the initial focus target and removes its duplicated focus capture, Tab loop, and focus restoration. Its draft-discard behavior remains local to the goal flow.

### Reader transition and completion feedback

The shared cover remains the signature transition. Opening uses a 300ms reader role with a short content reveal delay. Closing uses a distinct 220ms role, starts content fade immediately, and does not inherit the opening delay. Focus restoration continues only after the exit completes.

When the updated reading progress appears in Library, both the featured track and list-row track transition their width over the 200ms local-state role. App-level and OS reduced-motion policies keep the transition effectively instant.

### First-use reader-control discovery

One local boolean records whether the user has discovered the reader controls. On a fresh installation, the reader chrome remains visible and ignores automatic hide requests caused by scroll, page turn, or opening state. The first explicit tap on the reading canvas or menu control performs the normal toggle and records discovery. Returning users retain the current auto-hide behavior.

Storage failure degrades to the existing returning-user behavior so private or unavailable storage does not show the first-use state on every visit.

### Motion role ownership

`MOTION_DURATION` is the TypeScript source for press, local state, root tab, push enter/exit, sheet enter/exit, reader enter/exit, chrome enter/exit, gesture settle, and reduced crossfade roles. CSS keeps mirrored millisecond variables because CSS Modules cannot import TypeScript, and a focused test enforces parity.

Reader controls consume the chrome roles instead of literals. Edge Back consumes the gesture-settle role. `getReaderSwipeSettleDuration` becomes the single pure owner of the accepted-swipe and rebound durations used by both the outer TXT reader and EPUB iframe reader.

## Architecture and Files

- `app/MotionSheet.tsx`: shared focus, Tab trap, sibling inert ownership, and restoration.
- `app/ReadingGoalSheet.tsx`: provide initial close-button focus and remove duplicate modal focus code.
- `app/SharedBookTransition.tsx`: separate entrance and exit timing so exit has no delay.
- `app/ReaderControls.tsx`: consume shared chrome timing roles.
- `app/page.tsx`: initialize and persist reader-control discovery; consume shared swipe-settle duration.
- `app/EpubReader.tsx`: consume the same pure swipe-settle duration.
- `app/LibrarySurface.tsx`: retain semantic progress values; CSS supplies the state transition.
- `app/page.module.css`: align motion variables and animate featured/list progress width.
- `lib/motionSystem.ts`: define the complete duration role table.
- `lib/readerChromeState.ts`: represent the pending discovery state and ignore automatic hide until explicit discovery.
- `lib/readerControlDiscovery.ts`: resilient local discovery persistence.
- `lib/readerSwipe.ts`: pure swipe-settle duration owner.
- Focused Vitest integration and unit files lock every behavior before production code changes.

## Error and Edge Cases

- A sheet with no focusable child focuses the dialog panel through `tabIndex={-1}`.
- An opener removed during a nested-sheet transition is not focused after disconnect; the newly mounted sheet establishes fresh focus.
- Existing inert attributes on app-shell siblings are restored exactly, not blindly removed.
- Rapid close requests remain idempotent and do not restore focus before the visual exit is complete.
- Reduced-motion mode uses existing crossfade/instant policies and does not introduce spatial travel.
- Unavailable or throwing localStorage skips first-use persistence without breaking the reader.
- Automatic scroll, page-turn, and explicit hide events cannot collapse controls before first discovery; selection can still reveal controls afterward.
- Swipe duration is zero under reduced motion, 160ms for an accepted page turn, and 180ms for rebound.

## Test Strategy

1. Extend modal integration contracts first and verify failure before implementing shared focus and inert ownership.
2. Extend motion-system and shared-reader-transition contracts first, verify failure, then implement asymmetric timing and progress CSS.
3. Add pure discovery-state and storage tests first, verify failure, then integrate the behavior into `page.tsx`.
4. Add swipe-duration and CSS parity tests first, verify failure, then remove duplicated literals from both reader owners.
5. Run focused Vitest after each task and commit each green checkpoint.
6. Run full Vitest, ESLint, webpack build, `git diff --check`, and targeted Impeccable detection.
7. Run local Playwright on iPhone 14 and iPhone 15 Pro Max for sheet focus containment, first-use reader controls, reader close/focus restoration, and Library progress behavior.
8. Update `HANDOFF.md` with exact commits and verification. Deployment is performed only after the complete local verification gate passes.

## Completion Criteria

- Generic sheets focus inside, trap Tab, isolate the background, and restore a connected opener after exit.
- Reader close completes with the 220ms role and no inherited opening delay.
- Library progress tracks settle smoothly and remain reduced-motion safe.
- Fresh users see reader controls until one explicit toggle; returning users keep current auto-hide behavior.
- Reader controls, edge Back, CSS role variables, TXT swipe, and EPUB swipe no longer own duplicated duration literals without a parity guard.
- Full automated verification and both configured iPhone browser projects pass before deployment or completion claims.
