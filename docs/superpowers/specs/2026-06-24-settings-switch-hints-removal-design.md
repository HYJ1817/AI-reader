# Settings Switch Hint Removal

## Goal

Make the settings page quieter by removing explanatory secondary text from
switch rows.

## Scope

Remove the `<small>` hint below these four switches:

- Auto-open the last book
- Keep the screen awake
- Reduce motion
- Swipe to turn pages

Keep secondary status text on navigation rows, including:

- Active AI provider
- Current reader appearance
- Today's reading-goal progress

## Implementation

- Remove the four hint elements from `app/SettingsSurface.tsx`.
- Keep the switch labels, controls, state handling, and accessible form
  semantics unchanged.
- Do not hide the text with CSS.
- Let the existing row layout vertically center the remaining label.
- Only adjust row spacing or height if visual verification shows a layout
  problem.

## Verification

- Add or update focused source tests so the four switch hints cannot return
  accidentally.
- Confirm navigation-row status text remains present.
- Run the test suite, source ESLint, production build, and `git diff --check`.
- Check the settings page at an iPhone-sized viewport.
