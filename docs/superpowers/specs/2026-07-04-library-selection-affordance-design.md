# Library Selection Affordance Design

## Goal

Make selected books in Library edit mode read as a deliberate state, not only a
static checkmark.

This follows the content-transition pass. The next most useful polish area is
selected-state hierarchy: when users batch-select books, the selected marker
should feel like it belongs above the book surface.

## Scope

- `app/page.module.css`
- `lib/motionCss.test.ts`

Existing markup already exposes:

- `.selectionBadge` for grid selection state;
- `.selectionBadgeInline` for list selection state;
- `.bookSelected` on selected grid cells and list rows.

## Non-Goals

- Do not change edit-mode selection logic.
- Do not change batch action behavior.
- Do not change book card, row, cover, or title layout.
- Do not add JavaScript animation state.
- Do not animate blur, filter, width, height, margin, or layout.

## Interaction Model

The selection badge should behave like a small stateful control layered above
the book:

- unselected badges keep the current muted circular style;
- selected badges gain a slightly stronger shadow and a tiny scale lift;
- background, border color, box-shadow, and transform transition together;
- grid and list badges use the same selected-state contract.

The selected badge should be noticeable but not compete with the cover ring or
the tinted title in list view.

## Motion Protocol

Animated properties:

- `background`
- `border-color`
- `box-shadow`
- `transform`

Timing:

- `--motion-fast`
- `--ease-standard`

Reduced motion:

- selection badge transforms collapse to none;
- transition is disabled for the badge group.

## Testing

Update `lib/motionCss.test.ts` before implementation:

- assert `.selectionBadge, .selectionBadgeInline` transition background,
  border-color, box-shadow, and transform;
- assert selected grid/list badges scale to `1.06`;
- assert selected badges use a stronger shadow;
- assert reduced-motion coverage disables transition and transform for badges
  and selected badge states.

## Acceptance

- Selected grid and list badges feel like elevated state indicators.
- Book selection behavior and layout do not change.
- The implementation remains CSS-only.
- Reduced motion disables the selected-badge transform.
- Focused motion tests fail before implementation and pass after it.
- Full tests, lint, build, and whitespace checks pass before push.
