# Reading Goal Option Wheel Design

**Status:** Approved on 2026-07-17

## Goal

Replace the current reading-goal minute picker with a direct product integration
of React Bits' Option Wheel. The control should match the supplied reference's
visual hierarchy and interaction model while continuing to use AI Reader's
existing goal draft, save, cancel, persistence, accessibility, and reduced-motion
contracts.

This change affects only the minute picker inside the existing Reading Goal
sheet. The goal progress arc, progress copy, sheet navigation, stored goal
format, and Reading dashboard remain unchanged.

## Reference Contract

The wheel will preserve the defining behavior and appearance of the React Bits
Option Wheel shown at:

- <https://reactbits.dev/components/option-wheel?curve=0&tilt=0&smoothing=250&fontSize=1.7>

The integration will use the reference settings:

- `curve = 0`
- `tilt = 0`
- `fontSize = 1.7rem`
- `spacing = 1.4`
- `blur = 2px` per step away from the center
- `fade = 0.25` per step away from the center
- `minOpacity = 0.05`
- `smoothing = 250ms`
- `loop = false`
- dragging enabled
- a short selection tick sound enabled

The center option is the strongest text layer. Neighboring options progressively
lose opacity and gain blur. There is no permanent highlighted selection band,
card-like wheel frame, or substitute visual treatment that would change the
reference's character.

## Values and Boundaries

- Supported values are every whole minute from `0` through `1440`, inclusive.
- Each wheel step changes the value by exactly one minute.
- The wheel stops at `0` and `1440`; it does not wrap.
- Arrow keys change the value by one minute.
- Page Up and Page Down retain the existing ten-minute jump.
- Home and End retain the existing direct boundary jumps.
- Existing stored values continue to load without migration. Values outside the
  supported range are clamped through the existing reading-goal sanitization.

## Component Architecture

`ReadingGoalWheel` remains the product-facing controlled component:

```ts
type ReadingGoalWheelProps = {
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
};
```

Its internal motion and rendering logic will be replaced with a TypeScript port
of the official React Bits Option Wheel implementation. The port will retain the
reference's target-position model, animation-frame smoothing, pointer dragging,
wheel input, selected-index updates, opacity/blur calculation, and tick-audio
behavior.

The official example has twelve options. AI Reader has 1,441 values, so rendering
and updating every item on every animation frame would be unnecessarily costly on
an iPhone. The integration therefore virtualizes the visual rows around the
current fractional position. It renders enough items above and below the center
to reproduce the reference's blur and fade falloff, while the position and
boundary calculations continue to operate over the complete `0...1440` range.
Virtualization must not change the reference's visible output or settle behavior.

No new animation or picker dependency will be added. The existing React runtime,
component-local animation frames, and CSS are sufficient.

## State and Save Flow

The existing two-stage goal flow is preserved:

1. Opening the editor initializes `goalInputValue` from the saved target.
2. Drag, wheel, and keyboard interaction update only `goalInputValue`.
3. Crossing an integer option updates the visible selected minute and emits the
   selection tick sound.
4. Pressing Done uses the existing `onSaveGoal` path and persists the value.
5. Closing the sheet before saving restores the saved `targetMinutes` through the
   existing `onBeforeClose` behavior.

The goal progress arc and dashboard do not react to unsaved draft movement.

## Sound

A short local tick asset will be included with the application and played when
the selected minute changes. The implementation follows the reference's behavior
but must remain suitable for a quiet reading product:

- playback is brief and restrained;
- rapid movement is rate-limited so overlapping audio does not build up;
- audio is loaded lazily after user interaction;
- browser autoplay rejection, a missing audio API, or playback failure is ignored
  without affecting selection;
- reduced motion does not automatically disable sound because they are separate
  accessibility preferences, but the sound remains nonessential feedback.

## Accessibility and Input

The control keeps AI Reader's numeric `spinbutton` semantics instead of adopting
the demo's generic listbox semantics. It exposes the minimum, maximum, current
value, and a Chinese minute label.

Supported inputs:

- vertical pointer and touch dragging;
- mouse or trackpad wheel movement;
- Arrow Up and Arrow Down;
- Page Up and Page Down;
- Home and End.

The wheel remains focusable with the shared visible focus treatment. The visual
rows remain presentation-only so assistive technology receives one stable numeric
control instead of a changing virtualized option list.

When reduced motion is active, the selected value changes immediately without
inertial interpolation. The center emphasis and static distance-based readability
remain available.

## Visual Integration

The wheel copies the reference's spacing, typography scale, fade, blur, and
center-selection treatment. Product theme tokens replace hard-coded demo colors
so the same hierarchy remains readable in light, dark, sepia, and custom ambient
themes.

The current `.goalWheelBand`, bordered card surface, wide shadow, and five-row
size hierarchy are removed. The Reading Goal sheet retains its existing overall
layout and bottom Done action.

## Failure Handling

- Invalid values are clamped to `0...1440`.
- Non-finite pointer, wheel, timing, or row-height input does not change the
  current selection.
- Pointer cancellation settles to the nearest valid minute.
- Component unmount cancels animation frames, wheel timers, and pending audio.
- A failed sound load or playback attempt is silent and does not block input.

## Verification

Unit coverage will verify:

- `0...1440` clamping and one-minute steps;
- virtual window values at the center and both boundaries;
- pointer target calculation and nearest-minute settling;
- keyboard mappings;
- non-looping bounds;
- rate-limited sound triggers and sound failure tolerance;
- cleanup of animation and timer resources.

Integration and browser coverage will verify:

- the Reading Goal editor shows the React Bits-style wheel;
- drag, wheel, and keyboard paths change the draft value;
- Done persists the selected minute;
- closing without saving restores the saved target;
- `0` and `1440` are reachable and cannot be exceeded;
- light and dark theme readability;
- reduced-motion behavior;
- an iPhone-sized viewport renders only a bounded virtual row count;
- the wheel settles smoothly without a long task or a large DOM subtree.

The focused goal tests will run before the full Vitest, ESLint, production build,
and relevant mobile Playwright checks.

## License and Attribution

The port is derived from David Haz's React Bits Option Wheel:

- <https://github.com/DavidHDev/react-bits>
- <https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md>

React Bits is distributed under the MIT License with Commons Clause. AI Reader
uses the component as part of the application and does not sell, sublicense, or
redistribute it as a standalone component or component bundle. The required
copyright and permission text will be retained in the repository's third-party
notice and near the derived source as appropriate.

## Out of Scope

- Redesigning the Reading Goal sheet outside the minute picker.
- Changing reading-stat calculations or the dashboard goal ring.
- Changing the stored reading-goal schema.
- Adding a looping picker.
- Adding haptic feedback, which is not reliably available to this PWA.
- Reusing the Option Wheel elsewhere in the application in this change.
