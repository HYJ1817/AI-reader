# Reading Goal Ring Theme Fidelity Design

## Goal

Restyle the compact reading-goal indicator on the Reading dashboard to match
the supplied dark and light references while preserving live reading progress,
the existing goal-edit action, accessibility, and motion behavior.

## Scope

This change applies only to the compact goal indicator rendered by
`ReadingDashboard`. It does not change the full-screen `ReadingGoalSheet`, the
goal wheel, target persistence, or reading-stat calculations.

## Visual contract

The indicator uses a circular surface with a U-shaped arc that has rounded end
caps and an intentional gap at the bottom.

- Dark theme: near-black circular surface, restrained gray rim, cyan base arc,
  brighter cyan progress segment, cyan current minutes, and white target
  minutes.
- Light theme: white circular surface, fine light-gray rim, cyan base arc,
  brighter cyan progress segment, cyan current minutes, and black target
  minutes.
- Sepia follows the light structural treatment while using the existing sepia
  surface and text tokens.
- The current-minute value is centered above the target value. Both use
  tabular numerals and remain legible for three- and four-digit targets.
- The base cyan arc remains visible at zero progress, matching the supplied
  `0 / 120` references. A brighter overlay segment communicates actual progress
  without removing the reference appearance.

## Implementation approach

Replace the CSS `conic-gradient` ring with an inline SVG inside
`ReadingDashboard`:

- one path draws the permanent cyan U-shaped base arc;
- one identical path draws progress with `pathLength="100"` and a dash length
  derived from the existing goal percentage;
- CSS owns theme colors, surface, rim, sizing, round caps, typography, and the
  existing press transform;
- the SVG is decorative and hidden from assistive technology because the
  surrounding button already has an accessible name and visible numeric text.

`page.tsx` will pass the existing normalized goal percentage instead of a
generated background string. No reading data or persistence flow changes.

## Alternatives considered

1. Continue using a conic gradient. This is smaller but cannot match the open
   bottom gap and rounded arc ends precisely.
2. Use the supplied JPG files as theme assets. This matches a fixed screenshot
   but cannot display live numbers or progress, scales poorly, and duplicates
   theme logic.

The SVG approach provides the closest reference match while remaining dynamic,
theme-aware, sharp, and accessible.

## Testing

- Add a source/CSS contract test that fails until the dashboard uses an SVG
  base arc and progress arc with the required theme tokens and no conic
  background prop.
- Extend Reading dashboard Playwright coverage to assert the ring geometry,
  bottom gap, theme colors, visible values, and progress dash behavior in light
  and dark themes on both configured iPhone sizes.
- Run focused tests, full Vitest, ESLint, webpack build, and the complete
  Playwright suite before deployment.
- Deploy through the established Windows OpenNext flow, then verify production
  assets and focused light/dark screenshots.

## Non-goals

- No changes to target-minute editing or storage.
- No changes to the full-screen goal overlay.
- No new image assets or server storage.
- No unrelated Reading dashboard layout changes.
