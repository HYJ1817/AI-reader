# Reader Chrome Interaction Design

## Goal

Make one tap on any non-interactive reading area reliably show or hide the
reader controls in both TXT and EPUB readers.

## Interaction Rules

- A stationary tap anywhere in the reading body toggles the controls.
- Horizontal swipes turn pages and never toggle the controls.
- Vertical scrolling hides the controls and never toggles them.
- Text selection shows the controls so the AI action remains reachable.
- Buttons, links, form controls, and existing reader controls do not toggle the
  controls behind them.
- A tap immediately reverses an in-progress show or hide transition.
- TXT and EPUB use the same tap and scroll thresholds.

## Motion

- Enter: opacity plus 8px maximum movement, 220ms, ease-out.
- Exit: opacity plus 8px maximum movement, 180ms, ease-out.
- The reading text never moves or changes padding.
- Reduced motion makes the transition effectively instant.

## Scope

This change does not redesign the control layout, settings sheets, page
turning, or library navigation. Edge-tap page turning is removed from the
reading surface because it conflicts with reliable control toggling; horizontal
swipe remains available for page turning.

## Verification

- Pure state tests cover tap, scroll, selection, and rapid reversal.
- Source integration tests verify TXT no longer branches to edge-tap page
  turning.
- Existing motion CSS tests continue to enforce restrained durations and
  curves.
- iPhone acceptance: ten taps across left, center, and right reading areas must
  alternate controls on and off without a missed tap.
