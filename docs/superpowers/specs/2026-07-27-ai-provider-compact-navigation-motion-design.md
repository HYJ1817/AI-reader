# AI Provider Compact Navigation Motion Design

**Date:** 2026-07-27

## Goal

Make the transition between the AI provider list and the add/edit provider page feel as light and continuous as the existing root navigation transition, while preserving the established Motion system, native back behavior, accessibility settings, and the behavior of unrelated push routes.

The objective is perceptual consistency and 120 Hz readiness. The application cannot guarantee a physical 120 frames per second on every browser or device, but this transition must avoid unnecessary main-thread and paint work and stay within the available frame budget on supported iPhones.

## Current Problem

The root navigation content uses a compact directional transition:

- incoming content moves roughly 22 px to its resting position;
- outgoing content moves roughly 12 px in the opposite direction;
- opacity crossfades the two surfaces;
- the transition uses the shared navigation spring.

The AI provider configuration route currently uses the generic full-screen push model:

- the incoming page travels from 100% of the viewport width;
- the previous page retreats by 30%;
- a depth overlay and large edge shadow are applied.

Although frame-cadence measurements can pass, the larger travel distance and extra depth effects make the transition feel heavier than the bottom navigation. Existing tests measure runtime stalls and layout shift but do not verify the perceptual motion geometry.

## Chosen Design

Introduce a route-scoped **compact push motion profile** for `ai-provider-configure`. Do not change the default push profile used by collections, backgrounds, or other settings routes.

### Forward transition

- The provider configuration page enters from `x: 22px` and `opacity: 0` to `x: 0` and `opacity: 1`.
- The provider list moves from `x: 0` and `opacity: 1` to `x: -12px` and `opacity: 0`.
- Both surfaces use the existing `MOTION_SPRING.navigation` transition.
- The generic push depth overlay and large edge shadow are disabled for this compact route.

### Back transition

- The forward transition is reversed: the configuration page fades and moves right by 22 px while the provider list fades in from -12 px.
- The header back action and browser/history back action use the same route exit choreography.

### Interactive edge swipe

- Keep the existing full-width, finger-tracked interactive edge-back gesture while the pointer is active.
- Once released, settle with the existing navigation spring.
- The compact automatic transition must not reduce the gesture's travel range or detach the page from the finger.

This deliberately distinguishes an interactive navigation gesture from a non-interactive route animation: the former follows physical input, while the latter uses the compact root-navigation language.

### Reduced motion

- Continue to honor the application's current reduced-motion policy.
- Preserve the content change and opacity semantics without introducing new decorative movement.

## Architecture

Keep the decision in the shared navigation motion layer rather than provider-page CSS.

- Add a small, typed motion-profile selector/helper in `lib/navigationMotion.ts`.
- Select the compact profile when the pushed route is `ai-provider-configure`.
- Let `NavigationStack` consume the profile for incoming, outgoing, exit, overlay, and shadow behavior.
- Mark the compact push surface with a stable attribute or class only where CSS must suppress the generic edge shadow.

This keeps provider components focused on content and makes the motion rule independently testable.

## State and Lifecycle

- The exiting layer determines its profile from its own route entry, so popping the route cannot accidentally switch it back to the generic push animation mid-exit.
- The underlying provider list remains mounted during the crossfade, matching the existing navigation stack lifecycle.
- No new React state, timers, animation loops, or layout measurements are required.
- The transition animates only compositor-friendly `transform` and `opacity` properties.

## Testing

### Unit and source integration tests

- `ai-provider-configure` resolves to the compact profile.
- Unrelated push routes continue to resolve to the existing full push profile.
- Compact forward and reverse geometry matches the root-navigation distances (22 px incoming, 12 px outgoing) and uses the shared navigation spring.
- Compact pushes disable the depth overlay and generic push shadow.

### Browser tests

- A real click from the provider list to the configuration page records compact initial transforms and opacity crossfade rather than a viewport-width slide.
- Back navigation records the inverse transition.
- No long task or layout shift is introduced during the transition.
- Reduced-motion mode follows the existing reduced-motion behavior.
- The edge-back gesture remains interactive and completes or cancels correctly.
- Validate on the existing iPhone 14 and iPhone 15 browser profiles.

## Non-goals

- Changing every push transition in the application.
- Adding a shared-element/card morph.
- Reworking provider form layout or data loading.
- Claiming guaranteed 120 fps independent of hardware, browser scheduling, and display refresh rate.

## Acceptance Criteria

1. Opening add/edit provider uses the same compact fade-slide language and navigation spring as root navigation.
2. The transition no longer uses 100% automatic travel, a 30% background retreat, depth overlay, or large push shadow for this route.
3. Back navigation is the exact perceptual inverse.
4. Edge-swipe back remains finger-tracked.
5. All unrelated push routes retain their current behavior.
6. Motion, reduced-motion, unit, integration, lint, and build checks pass.
