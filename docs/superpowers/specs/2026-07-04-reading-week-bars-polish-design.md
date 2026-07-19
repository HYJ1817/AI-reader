# Reading Week Bars Polish Design

## Goal

Make the Reading tab's seven-day bar chart feel like a live dashboard element
rather than a static decorative strip.

The change should be small, visual, and consistent with the existing restrained
iOS-like interface. It follows the recent motion polish work across Library,
tabs, sheets, and collection rows.

## Scope

- `app/page.module.css`
- `lib/readingDashboardCss.test.ts`

Existing markup already exposes:

- `.weekBars`
- `.weekBars > div`
- `.weekBarTrack`
- `.weekBarTrack span`
- `.weekBarToday`

## Non-Goals

- Do not change reading-stat calculation.
- Do not change the seven-day insight data model.
- Do not change labels, totals, or reading-goal behavior.
- Do not add JavaScript state.
- Do not add cards or shadows around the whole section.

## Interaction Model

The chart should remain quiet but more legible:

- each day cell gets a stable compositor baseline;
- filled bars animate in from the bottom using `scaleY`;
- today receives a stronger tint-colored ring and a subtle vertical lift;
- today's label moves up slightly and uses tint color;
- inactive days keep the current low-contrast style.

The effect should read as data state hierarchy, not a new button interaction.

## Motion Protocol

Animated properties:

- `opacity`
- `transform`
- `box-shadow`
- `color`

Timing:

- `--motion-standard`
- `--motion-fast`
- `--ease-standard`

Reduced motion:

- disable `weekBarIn`;
- collapse transforms on day cells, filled bars, and today's label;
- disable transitions for the week-bar affordance group.

## Testing

Update `lib/readingDashboardCss.test.ts` before implementation:

- assert `.weekBars > div` has transform baseline and transition;
- assert `.weekBarTrack span` uses `transform-origin: bottom` and `animation`;
- assert `@keyframes weekBarIn` exists and animates opacity plus scaleY;
- assert `.weekBarToday .weekBarTrack` transitions box-shadow and transform;
- assert `.weekBarToday small` transitions color and transform;
- assert reduced-motion coverage disables animation, transition, and transform.

## Acceptance

- The weekly chart is clearer without changing its layout or data.
- Today's bar reads as the current day.
- The implementation remains CSS-only and compositor-friendly.
- Reduced motion disables the added movement.
- Focused dashboard CSS tests fail before implementation and pass after it.
- Full tests, lint, build, and whitespace checks pass before push.
