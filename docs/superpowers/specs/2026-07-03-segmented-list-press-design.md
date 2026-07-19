# Segmented and List Press Design

## Goal

Make secondary segmented controls and collection rows feel consistent with the
newer tab, sheet, and Library book press feedback.

This is the fifth incremental motion polish pass. It targets compact controls
that are used often but still feel flatter than the recently polished surfaces:
settings segmented buttons, Library grid/list view buttons, and collection
rows.

## Scope

- `app/page.module.css`
- `lib/motionCss.test.ts`

Existing markup already exposes:

- `.settingsSegmentControl button` for compact settings segmented buttons;
- `.libraryViewToggle button` and `.libraryViewActive` for Library view mode;
- `.collectionRow` for collection list rows and the create-collection row;
- `.collectionRowMain` for the tappable main area inside editable collection
  rows.

## Non-Goals

- Do not change collection editing, renaming, deletion, filtering, or creation.
- Do not change settings segmented control values.
- Do not change Library grid/list behavior.
- Do not alter row heights, icon sizes, labels, or layout.
- Do not introduce JavaScript press state.
- Do not animate blur, filter, width, height, or margins.

## Interaction Model

The app now has a consistent press language for primary controls. This pass
extends that language to smaller controls:

- settings segmented buttons gain compositor-only transform transitions;
- pressing a segmented button gives a compact scale response;
- Library grid/list buttons gain the same compact scale response;
- active view/segment buttons stay visually stable and layout-neutral;
- collection rows and their nested main buttons gain subtle down-press motion;
- editable row action buttons remain independent controls.

For collection rows, the structure matters. Existing collections render as a
non-button `.collectionRow` containing `.collectionRowMain`, plus optional edit
actions. The create row renders as a button with `.collectionRow`. Therefore
both `.collectionRow` and `.collectionRowMain` need their own transform
contracts.

## Motion Protocol

Animated properties:

- `transform`
- existing `background`, `color`, and `box-shadow` where already present

Timing:

- `--motion-fast`
- `--ease-standard`

Reduced motion:

- segmented control transforms collapse to none;
- Library view toggle transforms collapse to none;
- collection row and row-main transforms collapse to none;
- transition is disabled for this local group.

## Testing

Update `lib/motionCss.test.ts` before implementation:

- assert settings segmented buttons transition transform;
- assert pressed settings segmented buttons scale down;
- assert Library view toggle buttons transition transform;
- assert pressed Library view toggle buttons scale down;
- assert active view buttons keep `transform: scale(1)`;
- assert collection rows and nested row-main buttons transition transform;
- assert row and row-main pressed states move down with `translate3d`;
- assert reduced-motion coverage disables transitions/transforms for this group.

## Acceptance

- Compact segmented buttons no longer feel static when tapped.
- Library grid/list toggle has the same tactile response as bottom tabs and
  chips, but without changing dimensions.
- Collection list rows feel tappable without moving edit buttons as a group.
- The change remains CSS-only and compositor-friendly.
- Focused motion tests fail before implementation and pass after it.
- Full tests, lint, build, and whitespace checks pass before push.
