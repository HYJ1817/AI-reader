# Reader Settings Micro-Press Design

## Goal

Make high-frequency reader settings taps feel more coherent by letting the
inner affordances move with the pressed surface.

This is the second incremental motion polish pass after bottom sheet settling.
The change stays inside the existing reader settings sheet and does not alter
layout, copy, reader preferences, or sheet behavior.

## Scope

- `app/page.module.css`
- `lib/motionCss.test.ts`

The relevant UI is already implemented in `app/ReaderSettingsPanel.tsx`:

- mode/theme popover rows;
- popover check and icon affordances;
- custom settings entry button and gear icon.

## Non-Goals

- Do not change reader settings layout.
- Do not change theme or mode selection behavior.
- Do not add JavaScript state for press handling.
- Do not introduce an animation library.
- Do not animate layout properties.
- Do not bring back character-built or emoji-built slider icons.

## Interaction Model

Popover rows already press the row surface with a small downward movement and
scale. This pass makes the row's internal check and icon participate:

- the check mark scales slightly on row press;
- the icon scales slightly on row press;
- both use the existing `--motion-fast` and `--ease-standard` protocol;
- selected and unselected rows keep the same layout.

The custom settings entry already scales its pill surface. This pass makes the
gear icon move with the press:

- the gear icon scales slightly on button press;
- the icon has its own compositor-friendly transition;
- the button remains a single text-plus-icon control.

## Motion Protocol

Animated properties:

- `transform`
- `opacity` only if an existing rule already uses it

Timing:

- `--motion-fast`
- `--ease-standard`

Reduced motion:

- popover check/icon transitions are disabled;
- custom gear icon transitions are disabled;
- active transforms are removed.

## Testing

Update `lib/motionCss.test.ts` before implementation:

- assert `.readerSettingsPopoverCheck` and `.readerSettingsPopoverIcon` have
  transform transitions;
- assert `.readerSettingsPopoverRow:active` scales both child affordances;
- assert `.readerCustomEntryButton:active .readerCustomGearIcon` scales the
  gear icon;
- assert reduced-motion coverage includes these child affordances.

## Acceptance

- Pressing mode/theme popover rows makes the row and its icon/check feel like
  one object.
- Pressing the custom settings entry gives the gear icon a matching tactile
  response.
- The changes remain CSS-only and compositor-friendly.
- Focused motion tests fail before implementation and pass after it.
- Full tests, lint, build, and whitespace checks pass before push.
