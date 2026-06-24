# Reading Goal Fullscreen Redesign

## Goal

Replace the current reading-goal bottom sheet with a focused full-screen
progress view matching the approved reference:

- an open semicircular progress arc,
- a large hours-and-minutes reading total,
- remaining-time feedback,
- and a touch-friendly minute wheel for editing the daily target.

The screen must remain consistent with AI Reader's existing themes, safe-area
handling, local storage, and accessibility expectations.

## Scope

### Included

- Replace the goal `BottomSheet` presentation with a dedicated full-screen
  overlay.
- Keep the existing entry points from the Reading and Settings surfaces.
- Show today's reading duration as `H:MM`.
- Show the configured daily target below the duration.
- Show an open semicircular progress arc whose progress moves from left to
  right.
- Show today's remaining minutes and an encouraging or completed-state
  message.
- Replace the range slider with a minute wheel covering `1–1440`.
- Save a changed target only after the user presses `完成`.
- Discard an unconfirmed target when the user closes the screen or exits target
  editing.
- Support light, dark, sepia, and system appearances.
- Respect safe areas and reduced-motion preferences.
- Support touch, pointer, keyboard, and screen-reader operation.

### Excluded

- No share button or system share integration.
- No continue-reading button.
- No changes to reading-stat persistence.
- No weekly or historical goal analytics on this screen.
- No new route or URL state.
- No native iOS code.

## Presentation Architecture

Create a dedicated full-screen overlay instead of stretching the existing
`BottomSheet`.

The overlay:

- is mounted through `AppOverlays`,
- covers the application viewport,
- sits above bottom navigation and reading chrome,
- uses the current application background and theme tokens,
- includes a circular close button in the top-right safe area,
- locks interaction with the surfaces underneath,
- and restores focus to the control that opened it when closed.

The component remains a client component and receives the same reading values
and save callbacks currently supplied to `ReadingGoalSheet`.

## Default Progress State

The default state is vertically organized as:

1. top safe-area spacing and close button,
2. open semicircular progress arc,
3. today's reading duration centered inside the arc,
4. target text directly below the duration,
5. a subtle horizontal divider,
6. progress heading,
7. remaining-time or completed-state text,
8. supporting status text,
9. bottom safe-area action labeled `调整目标`.

Do not include a page title above the arc. The visual hierarchy should begin
with the progress graphic.

## Progress Arc

Use SVG paths for both the track and progress.

- The path is an open upper semicircle from the lower-left endpoint to the
  lower-right endpoint.
- The track uses a subdued theme-aware neutral.
- Progress uses the existing tint/accent token.
- The progress amount is clamped to `0–100%`.
- At zero progress, no colored segment is shown.
- At or above the target, the entire open arc is colored.
- Both endpoints use round line caps.
- The arc itself does not animate when reduced motion is enabled.

The existing `getReadingGoalArcPercent` behavior remains the source for the
clamped progress percentage.

## Reading Duration and Copy

Format today's reading duration from integer minutes as:

- `0` -> `0:00`
- `5` -> `0:05`
- `65` -> `1:05`
- `1440` -> `24:00`

The target line is:

```text
（目标 120 分钟）
```

When the target has not been reached:

```text
今日阅读进度
还需 120 分钟
你正朝着每日目标奋进
```

Remaining minutes are:

```text
max(targetMinutes - todayMinutes, 0)
```

When the target is reached or exceeded:

```text
今日阅读进度
今日目标已完成
继续保持阅读节奏
```

Do not show negative remaining time.

## Target Editing State

Pressing `调整目标` opens an inline editor in the lower half of the same
full-screen overlay.

The editor contains:

- heading `每日阅读目标`,
- unit label `分钟/天`,
- a vertically centered minute wheel,
- and a bottom action labeled `完成`.

The progress arc and progress copy remain visible above the editor. Opening the
editor must not navigate or open another sheet.

## Minute Wheel

The wheel supports values from `1` through `1440`, inclusive, with a step of
one minute.

Visual behavior:

- the selected value is centered over a subdued selection band,
- two neighboring values are visible above and below,
- neighboring values are smaller and lower contrast,
- edge fades may be used to keep focus on the selected value,
- and the wheel must not render all 1440 visible rows at once.

Interaction behavior:

- vertical drag or wheel input changes the draft value,
- keyboard `ArrowUp` and `ArrowDown` change it by one,
- `PageUp` and `PageDown` change it by ten,
- `Home` selects `1`,
- `End` selects `1440`,
- values are always clamped to the supported range,
- and the active value is announced through an accessible spinbutton or
  equivalent semantic control.

The implementation may use a bounded virtual window around the selected value
or a native scroll-snap list with bounded rendering. It must not create 1440
animated React elements.

## Draft and Save Semantics

Opening target editing copies the persisted target into a draft value.

- Wheel interaction changes only the draft.
- Pressing `完成` calls the existing save flow with the draft, updates the
  displayed target, and closes the editor.
- Closing the full-screen overlay while editing discards the draft.
- If the editor is closed without saving, reopening it starts from the current
  persisted target.
- The target remains stored through the existing reading-goal local-storage
  functions.

## Responsive and Theme Behavior

Primary target viewport: iPhone portrait.

- The layout must work at `390 x 844` and shorter supported phone heights.
- The close control and bottom action must respect `env(safe-area-inset-top)`
  and `env(safe-area-inset-bottom)`.
- The arc and wheel must fit without horizontal scrolling.
- On short screens, vertical spacing and arc size may reduce, but primary text
  must remain readable.
- The overlay may scroll vertically only when required by very short screens
  or enlarged accessibility text.
- Theme colors must come from existing semantic tokens rather than hard-coded
  white or black surfaces.
- The overlay must remain usable at 200% browser zoom.

## Motion

- Opening and closing use the existing restrained overlay motion language.
- Target-editor entry may use a short opacity and translate transition.
- Wheel movement follows direct manipulation and must not use bounce or elastic
  animation.
- All nonessential transitions are removed when application or operating-system
  reduced motion is enabled.

## Accessibility

- The overlay uses dialog semantics with an accessible name of `阅读目标`.
- Focus is trapped while the overlay is open.
- `Escape` closes the overlay on keyboard-capable devices.
- The close button has the existing localized close label.
- Progress exposes a readable label and current percentage.
- The wheel exposes its minimum, maximum, and current value.
- Touch targets are at least 44 by 44 CSS pixels.
- Color is not the only indicator of completed progress.

## Component Boundaries

Recommended units:

- `ReadingGoalSheet.tsx`: replace or rename as the full-screen goal overlay and
  own default/editing presentation state.
- `ReadingGoalWheel.tsx`: own minute-wheel rendering, keyboard input, drag or
  scroll interaction, clamping, and accessibility semantics.
- `lib/readingGoalDisplay.ts`: own duration formatting, remaining-time
  calculation, and completed-state display values.
- `app/page.module.css`: own overlay, arc, copy, wheel, responsive, theme, and
  reduced-motion styling.
- `AppOverlays.tsx` and `page.tsx`: retain orchestration and existing goal save
  callbacks with only the prop changes required by the new component contract.

Do not move reading-goal persistence into the presentation components.

## Testing

Add focused unit tests for:

- `H:MM` duration formatting,
- remaining-minute clamping,
- incomplete and completed copy states,
- minute-wheel clamping,
- keyboard step behavior,
- and draft save/cancel semantics.

Add source or component integration tests for:

- removal of `BottomSheet` from the goal presentation,
- presence of full-screen dialog semantics,
- absence of share and continue-reading actions,
- SVG open-arc structure,
- preserved `AppOverlays` orchestration,
- and the persisted save callback running only after `完成`.

Visual verification must cover:

- default and target-editing states at `390 x 844`,
- a shorter iPhone viewport,
- light and dark appearance,
- target values `1`, `120`, and `1440`,
- zero progress, partial progress, completed progress, and over-target progress,
- no overlap with safe areas,
- and no hidden or clipped wheel values.

After implementation, run:

```powershell
npm.cmd run test
npm.cmd exec -- eslint app lib
npm.cmd run build
npm.cmd audit --json
git diff --check
```
