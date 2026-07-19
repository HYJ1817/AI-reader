# Collection Active Affordance Design

## Goal

Make the active collection row in Library feel like a selected navigation state,
not just a tinted row.

This continues the selected-state and hierarchy polish after selected book
badges. The target is the Collections screen, where users choose between all
books, ungrouped books, and custom groups.

## Scope

- `app/page.module.css`
- `lib/motionCss.test.ts`

Existing markup already exposes:

- `.collectionRow` for each row;
- `.collectionRowActive` for the currently active filter row;
- `.collectionRowIcon` and `.collectionRowChevron` inside the row.

## Non-Goals

- Do not change collection filtering, editing, renaming, deletion, or creation.
- Do not change collection row layout, row height, icon size, or labels.
- Do not add JavaScript state.
- Do not animate width, height, margins, padding, or position.
- Do not change the create-collection row.

## Interaction Model

The active collection row should read like a current navigation destination:

- active row keeps its subtle tint background;
- active row gains an inset leading highlight and a slightly stronger surface
  shadow without affecting layout;
- active icon turns tint and scales slightly;
- active chevron turns tint and shifts slightly to the right;
- inactive rows keep their quiet list style.

The effect is static state hierarchy with small transform affordances, not a
new press interaction.

## Motion Protocol

Animated properties:

- `background`
- `box-shadow`
- `color`
- `transform`

Timing:

- `--motion-fast`
- `--ease-standard`

Reduced motion:

- active icon and chevron transforms collapse to none;
- transitions are disabled for the active row affordance group.

## Testing

Update `lib/motionCss.test.ts` before implementation:

- assert `.collectionRow` transitions background, box-shadow, and transform;
- assert `.collectionRowIcon` and `.collectionRowChevron` transition color and
  transform;
- assert `.collectionRowActive` has `box-shadow`;
- assert active icon scales to `1.04`;
- assert active chevron translates `2px`;
- assert reduced-motion coverage disables transitions/transforms for the active
  row affordance group.

## Acceptance

- The active collection row is clearer as the current Library filter.
- The change does not alter collection behavior or row layout.
- The implementation remains CSS-only and compositor-friendly.
- Reduced motion disables active icon/chevron movement.
- Focused motion tests fail before implementation and pass after it.
- Full tests, lint, build, and whitespace checks pass before push.
