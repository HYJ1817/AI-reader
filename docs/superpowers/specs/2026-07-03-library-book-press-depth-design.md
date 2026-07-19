# Library Book Press Depth Design

## Goal

Make tapping books in the Library feel less like a flat web scale and more like
a layered object press.

This is the third incremental motion polish pass after bottom sheet settling
and reader settings micro-press. It targets the most common Library interaction:
tapping a book in grid or list view.

## Scope

- `app/page.module.css`
- `lib/motionCss.test.ts`

The existing Library markup already exposes:

- `.bookGridItem` for grid book buttons;
- `.bookItem` for list rows;
- `.bookCover` inside both grid and list entries;
- `.bookGridMoreButton` and `.bookMoreButton` for secondary actions.

## Non-Goals

- Do not change Library layout.
- Do not change book opening, selection, filtering, grouping, or action-sheet
  behavior.
- Do not introduce JavaScript press state.
- Do not animate box-shadow or blur.
- Do not change cover loading or object URL behavior.

## Interaction Model

Grid and list book entries already scale their outer container on press. This
pass adds a small internal response:

- `.bookCover` has a transform transition;
- pressing a grid book nudges/scales the cover inside the already-scaling card;
- pressing a list book nudges/scales the cover inside the row;
- secondary more buttons gain transform transitions and a compact active scale;
- pressing a list row also gently scales the in-row more button so the row reads
  as one pressed object.

Grid more buttons sit as siblings beside `.bookGridItem`, so they keep their
own direct pressed state instead of trying to couple through structural CSS.

## Motion Protocol

Animated properties:

- `transform`
- existing `opacity` where already present

Timing:

- `--motion-fast`
- `--ease-standard`

Reduced motion:

- book cover transforms are disabled;
- grid/list more button transforms are disabled;
- active transforms collapse to none.

## Testing

Update `lib/motionCss.test.ts` before implementation:

- assert `.bookCover` has a transform transition;
- assert `.bookGridItem:active .bookCover` scales/translates the cover;
- assert `.bookItem:active .bookCover` scales/translates the cover;
- assert `.bookMoreButton` transitions transform;
- assert `.bookMoreButton:active` and `.bookItem:active .bookMoreButton`
  have compact scale responses;
- assert reduced-motion coverage includes book cover and more-button active
  transforms.

## Acceptance

- Tapping a grid book gives the cover a subtle internal press, not only an outer
  card scale.
- Tapping a list row gives the cover and more button a coherent micro-response.
- Secondary more buttons still work as independent controls.
- The changes remain CSS-only and compositor-friendly.
- Focused motion tests fail before implementation and pass after it.
- Full tests, lint, build, and whitespace checks pass before push.
