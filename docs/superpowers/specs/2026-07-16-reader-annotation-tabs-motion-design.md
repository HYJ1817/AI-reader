# Reader Annotation Tabs Motion Design

Date: 2026-07-16
Status: Approved

## Goal

Make Chapters, Bookmarks, and Highlights feel like three adjacent iOS pages
instead of three unrelated hard-swapped states. Users can tap a tab or swipe the
content horizontally. Empty annotation tabs keep the same sheet height as the
chapter tab.

The performance target is at least 90 FPS on a 120 Hz-capable iPhone ProMotion
device. Hardware, thermal state, and book size still affect the result, so the
implementation contract is to use native scrolling and compositor-friendly
transforms without React state updates on every scroll frame. Automated mobile
emulation may enforce architecture and long-frame budgets, but only ProMotion
hardware can confirm the final 90+ FPS acceptance target.

## Interaction Model

- The three tab panels live side by side in one horizontal native scroll
  viewport.
- The viewport uses horizontal scroll snapping. A finger swipe follows the
  gesture continuously and settles on the nearest panel.
- Tapping a tab scrolls the viewport to the matching panel. Full motion uses
  smooth native scrolling; reduced motion uses an immediate jump.
- The selected tab changes when the nearest snapped page changes. The tab's
  selected semantics, panel accessibility state, and indicator stay aligned.
- The active capsule moves horizontally between the three tab positions rather
  than appearing and disappearing.
- Rapid taps and interrupted swipes converge on the nearest final panel without
  queuing animations.

## Gesture Ownership

- Horizontal movement belongs to the tab viewport.
- Vertical movement belongs to the active panel's scroll area.
- The horizontal viewport is marked as a sheet gesture exclusion zone so the
  parent bottom sheet does not begin a vertical dismiss drag from the same
  pointer sequence.
- Sheet dismissal remains available from the grabber/header. This avoids
  ambiguous nested horizontal and vertical drags on iOS Safari.
- Native browser axis arbitration and scroll snapping are preferred over a
  JavaScript drag loop.

## Layout

- `TocDrawer` has a stable height of `min(92dvh, 760px)`, subject to the
  existing safe-area padding and viewport geometry.
- The horizontal viewport consumes the remaining flex height below the tabs.
- Every panel is exactly one viewport width and fills the available height.
- Each panel owns an independent vertical scroll area. Empty Bookmarks and
  Highlights panels therefore remain full-height and never collapse the sheet.
- Chapter incremental rendering continues to observe the chapter panel's own
  vertical scroll root.

## Motion and Performance

- Horizontal content movement is native scrolling, not a React-driven `x`
  value.
- Scroll synchronization is settled with `scrollend` when available and a
  requestAnimationFrame-debounced nearest-page fallback elsewhere.
- No width, height, margin, left, or top values animate during switching.
- The active capsule uses a transform-based shared Motion layout transition.
- The existing `MOTION_DURATION.tab` timing and a non-bouncy navigation spring
  are reused for consistency.
- No permanent `will-change` is added.
- A physical ProMotion trace should sustain at least 90 FPS during repeated tab
  swipes. Local automation rejects layout animation, per-frame React state, and
  long frames but is not reported as proof of 90+ FPS.
- Reduced-motion mode disables smooth programmatic scrolling and the moving
  capsule transition while preserving swipe, tap, focus, and selected state.

## Accessibility

- The tablist retains three native buttons with `role="tab"`, `aria-selected`,
  and `aria-controls`.
- All three `tabpanel` elements remain mounted so native scroll snapping is
  stable.
- Inactive panels are `aria-hidden` and inert so their buttons do not enter the
  keyboard or assistive-technology focus order.
- Changing panels by swipe updates the selected tab semantics.
- Tapping a tab does not move focus into panel content automatically.

## Component Changes

- `TocDrawer.tsx` owns tab order, viewport refs, nearest-index synchronization,
  tab click navigation, and the active capsule.
- `MotionSheet.tsx` recognizes a declarative horizontal-gesture exclusion
  attribute when deciding whether it may start sheet dismissal.
- `page.module.css` owns stable sheet height, horizontal snap layout, panel
  vertical scrolling, scrollbar suppression, and reduced-motion fallbacks.
- Existing annotation persistence, navigation, deletion, and chapter selection
  callbacks do not change.

## Testing

- Unit/integration coverage verifies all panels remain mounted, tabs and panels
  remain linked, the moving indicator exists, and the sheet uses a fixed height.
- Gesture arbitration coverage verifies a horizontal tab viewport cannot start
  the parent sheet drag.
- Playwright covers tab clicks, a real touch-style horizontal swipe, empty-tab
  height stability, vertical chapter scrolling, rapid switching, and reduced
  motion.
- Full Vitest, ESLint, production build, and existing mobile E2E suites remain
  required before deployment.

## Non-goals

- No changes to annotation storage, EPUB/TXT locators, highlight colors, or
  bookmark behavior.
- No new decorative motion outside this tab relationship.
- No claim of 90+ FPS based only on 60 Hz browser emulation.
