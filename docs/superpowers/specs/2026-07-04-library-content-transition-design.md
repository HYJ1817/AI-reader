# Library Content Transition Design

## Goal

Make Library grid/list content changes feel intentional instead of instantly
swapping DOM.

This starts the post-press polish phase. Press feedback is now broad enough, so
this pass focuses on state-change motion: what the user sees after changing
view mode, filters, or search state.

## Scope

- `app/page.module.css`
- `lib/motionCss.test.ts`

Existing markup already remounts either:

- `.bookGrid` when Library view mode is grid;
- `.bookItems` when Library view mode is list.

That remount is enough for a CSS enter animation without adding JavaScript
state.

## Non-Goals

- Do not change Library view mode logic.
- Do not change search, filtering, grouping, pagination, or import behavior.
- Do not add delayed unmounts or cross-fade state.
- Do not animate individual book cards one by one.
- Do not animate blur, filter, width, height, or margins.
- Do not change selected-book behavior.

## Interaction Model

When Library content changes between grid/list or remounts after a filter
change, the container enters with:

- opacity from slightly transparent to full;
- a small downward-to-rest transform;
- the existing project `--motion-standard` timing and `--ease-standard` curve.

The motion is intentionally modest. It should read as content settling into the
surface, not as a decorative page transition.

## Motion Protocol

Animated properties:

- `opacity`
- `transform`

Timing:

- `--motion-standard`
- `--ease-standard`

Reduced motion:

- `.bookGrid` and `.bookItems` animation is disabled;
- transform collapses to none.

## Testing

Update `lib/motionCss.test.ts` before implementation:

- assert `.bookGrid` uses `libraryContentIn`;
- assert `.bookItems` uses `libraryContentIn`;
- assert `@keyframes libraryContentIn` only animates opacity and transform;
- assert reduced-motion coverage disables `.bookGrid` and `.bookItems`
  animation and transform.

## Acceptance

- Switching Library grid/list view no longer feels like an abrupt content swap.
- Search/filter remounts get a restrained content-settle affordance.
- The implementation remains CSS-only.
- Reduced motion disables the content enter animation.
- Focused motion tests fail before implementation and pass after it.
- Full tests, lint, build, and whitespace checks pass before push.
