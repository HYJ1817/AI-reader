# Native Navigation and Motion Design

## Status

Approved direction: full native-style navigation stack with shared elements,
interactive back gestures, coordinated sheets, and application-wide motion.

Target personality: quiet, native, focused. The motion should feel closer to a
well-made iOS reading utility than a decorative web application.

Primary runtime: recent iPhones running Safari or the installed PWA. The design
still provides reduced-motion and low-cost fallbacks.

## Goals

- Replace independent page animations with one coherent spatial navigation
  model.
- Cover the whole application: root tabs, pushed subviews, the full-screen
  reader, bottom sheets, Ask AI, list editing, settings controls, and reading
  statistics.
- Preserve EPUB and TXT reading gestures, scrolling, keyboard behavior, local
  state, and browser back behavior.
- Make transitions interruptible and responsive to touch instead of forcing
  users to wait for a fixed animation to finish.
- Maintain 60 fps on recent iPhones for normal navigation and gestures.
- Respect both the system reduced-motion setting and the app setting.

## Non-Goals

- Recreating private Apple APIs or copying Apple visual assets.
- Adding decorative continuous motion, bounce, elastic easing, confetti, or
  page-load choreography.
- Moving book, AI, database, or settings business state into the navigation
  system.
- Replacing epub.js gesture handling with the navigation stack.
- Making horizontal swipes switch root tabs.

## Current-State Problems

The app currently renders root surfaces in parallel and applies CSS classes for
before, active, and after positions. The reader has a separate two-frame
presentation state. Subviews use isolated entry keyframes. Bottom sheets own a
manual pointer state machine and CSS transition phases. These systems work in
isolation but do not share progress, origin geometry, interruption rules, or
browser history.

The result is visually fragmented:

- A source control does not remain connected to the surface it opens.
- Enter and exit animations can use different timing and geometry.
- Reader chrome elements animate independently rather than as one state.
- Back navigation does not have one spatial model across subviews, sheets, and
  the reader.
- Several components permanently carry `will-change`, increasing compositing
  cost even while idle.

## Navigation Model

The application uses four explicit layers.

### Root Tab Layer

`library`, `reading`, and `settings` remain mounted root surfaces. Selecting a
tab does not push a history entry and does not enable an interactive horizontal
swipe. Each tab preserves its own scroll position and local view state.

Tab changes use a short directional transition based on stable tab order. The
old surface moves about 12 px away from the destination. The new surface starts
about 22 px from its resting position. The shared tab indicator follows the
selection with the navigation spring.

### Push Layer

Subview destinations such as collections, AI provider configuration, model
selection, and custom background settings become navigation entries rather than
components with unrelated entry classes.

On push, the incoming page moves from the right edge to rest. The previous page
moves left by about 30 percent and darkens slightly. On pop, both movements
reverse. Only the top two entries remain visually active during a transition.

An edge-back gesture can start only within the first 20 px of the left edge.
The gesture completes when horizontal distance exceeds 30 percent of the width
or release velocity exceeds 620 px/s in the return direction. Vertical intent,
multi-touch, and starts on form controls cancel navigation ownership.

### Reader Presentation Layer

Opening a book is a full-screen presentation, not a normal push. The selected
book cover receives a stable shared layout identity. A transition clone keeps
the source geometry available while the reader mounts.

The cover lifts, expands toward a centered transitional frame, and hands its
visual emphasis to the active ambient background. Reader content begins a
crossfade during the middle of that transition so the interface never pauses
on an empty screen.

Closing reverses to the source cover when that cover is still mounted and
visible. When filtering, deletion, or scrolling removes the origin, dismissal
uses a centered scale and fade fallback. EPUB iframe geometry is never measured
or included in a shared layout animation.

The reader does not support edge-back because horizontal input belongs to page
turning. It closes through the existing close command and a coordinated
full-screen exit. Vertical reading scroll is never captured for dismissal.

### Sheet Layer

Catalog, Ask AI, reader settings, confirmation, goal, grouping, and book action
surfaces use one motion sheet implementation.

The sheet owns drag progress. The presenting surface reads that progress to
scale toward 0.98, gain a bounded corner radius, and darken slightly. Backdrop
opacity follows drag progress. A release is resolved from distance and velocity
through one spring contract.

Dragging starts from the grabber or a defined non-scrolling header region. A
scrollable sheet body can transfer downward movement to the sheet only when its
scroll position is at the top. Text selection, sliders, wheels, and horizontal
controls keep gesture ownership.

## Component Architecture

### `AppMotionRoot`

Responsibilities:

- Load `motion/react` through strict `LazyMotion` with `domMax` so animation,
  layout projection, shared `layoutId`, and drag features are available.
- Own the reactive reduced-motion source by combining the app setting with a
  `useSyncExternalStore` subscription to the system media query.
- Provide `MotionConfig` with the combined policy as `always` or `never`
  without remounting the app tree when that policy changes.
- Expose `useAppMotionPolicy()` and `useAppReducedMotion()` as the authoritative
  reactive context for Motion components.
- Expose motion tokens as typed values and CSS custom properties.
- Host the fixed portal layers for transition clones, reader presentation, and
  sheets.

### `NavigationProvider`

Responsibilities:

- Own the root tab selection and pushed navigation entries.
- Own reader and sheet presentation entries.
- Coordinate browser History and focus restoration.
- Expose commands instead of exposing mutable state.

Public commands:

- `selectTab(tab)`
- `push(route, options)`
- `pop(options)`
- `presentReader(bookId, origin)`
- `dismissReader(options)`
- `presentSheet(sheet, options)`
- `dismissSheet(options)`

The provider does not own book records, AI conversations, preferences, or
database data. Route payloads contain stable identifiers, while existing page
state remains authoritative.

### `NavigationStack`

Responsibilities:

- Render the active root surface and pushed entries.
- Keep outgoing entries mounted until exit completion.
- Drive push, pop, and interactive edge progress.
- Restore the previous page's focus and scroll position after pop.

### `SharedBookTransition`

Responsibilities:

- Register source cover geometry and layout identity.
- Render the transition clone above root surfaces and below reader controls.
- Choose reverse shared transition or centered fallback on close.
- Clear stale origins after filters, list mode changes, and unmounts.

### `MotionSheet`

Responsibilities:

- Replace the existing sheet phase and timer implementation with Motion drag
  values and presence completion callbacks.
- Coordinate panel, backdrop, presenting surface, and focus trap as one state.
- Remain interruptible during entry, spring settling, and dismissal.

### Surface Adapters

Existing business components receive thin adapters rather than being rewritten
around navigation internals:

- `LibrarySurface` registers book cover origins and pushes collection routes.
- `ReadingSession` consumes reader presentation progress but retains EPUB/TXT
  pointer ownership.
- `SettingsSurface` pushes settings routes.
- `AppOverlays` maps existing open states to sheet entries during migration,
  then becomes a sheet-content registry.
- `AppNavigation` consumes tab selection and shared indicator progress.

## State and History Flow

Navigation entries have stable keys and one of these kinds:

- `tab-root`
- `push`
- `reader`
- `sheet`

Each entry stores only navigation data: route identifier, stable entity ID,
direction, optional source identity, focus return target, and scroll snapshot.

The initial state uses `history.replaceState`. Push pages, readers, and sheets
use `history.pushState`. Browser `popstate` resolves through the same reducer as
visible back buttons and gestures. Tab changes update the current root selection
without creating a chain of tab history entries.

On reload, unsupported or stale history payloads recover to the corresponding
root tab. Missing books, groups, or provider records do not leave an empty
animated frame; the entry is removed and the user returns to the nearest valid
surface.

Rapid repeated commands are serialized by transition identity, not by globally
blocking input. A newer valid command can interrupt an active transition and
continue from current motion values.

## Motion Language

### Durations

- Press feedback: 90 to 140 ms, CSS.
- Small state changes: 180 to 220 ms.
- Root tab content: 260 ms.
- Push and pop: 340 to 380 ms.
- Reader shared presentation: 420 to 480 ms.
- Exit durations: about 75 percent of matching entry durations.

### Springs

- Navigation: stiffness 380, damping 38, mass 0.9.
- Sheets: stiffness 420, damping 42, mass 0.92.
- Shared book transition: stiffness 360, damping 36, mass 0.95.

These values are starting contracts and may be tuned from iPhone recordings,
but bounce remains zero and settling must not visibly oscillate.

### Root Tabs

- Shared indicator moves with the navigation spring.
- Icon and label state changes remain CSS transitions.
- Content transitions preserve scroll positions.
- Root tab surfaces do not replay entrance choreography on every selection.

### Reader Chrome

- Menu button, menu rows, page pill, and close button use one parent presence
  state.
- Rows expand from the lower-right control origin with 30 to 40 ms spacing.
- Dismissal reverses the order and completes faster than entry.
- Scroll-triggered chrome dismissal starts from current progress and never
  disables the wake button.

### Ask AI

- Sending optimistically clears the composer and places the user message.
- The assistant response container enters once when the first response content
  arrives.
- Streaming text does not animate every token.
- Keyboard geometry changes use layout animation only on the composer and
  thread viewport, not the entire sheet.

### Lists and Editing

- Insert, remove, view-mode change, and reorder operations use layout animation.
- Removed items retain an exit clone until neighbors finish moving.
- Infinite-scroll batches do not stagger more than the first six newly visible
  items and cap total delay at 180 ms.
- Existing items do not replay an entrance after filtering or returning from a
  detail page.

### Settings and Statistics

- Switches, segmented controls, and slider feedback share one timing contract.
- Settings subviews use the Push layer rather than standalone keyframes.
- Numeric reading statistics use a short crossfade with tabular digit width.
- Week bars animate only on first meaningful data appearance or real data
  change, not every tab selection.

### Ambient Background

- Background layers crossfade only when the selected book or custom background
  changes.
- A slight bounded scale can accompany a book transition.
- There is no continuous drift, parallax loop, or decorative motion.

## Gesture Arbitration

Gesture ownership is decided once per pointer sequence.

Priority order:

1. Native form, text-selection, slider, wheel, and link interaction.
2. EPUB/TXT reader page-turn gesture inside the reader.
3. Scrollable content with available movement in the gesture direction.
4. Sheet dismissal from an eligible sheet region.
5. Edge-back from an eligible Push page.

Once a gesture crosses its intent threshold, lower-priority systems cannot take
ownership. Pointer cancellation restores the current surface through the same
spring used for an incomplete gesture.

## Reduced Motion

Reduced motion is active when either the system preference or the app setting
requests it.

`AppMotionRoot` owns this combined policy. Its system preference store listens
to `(prefers-reduced-motion: reduce)` changes and updates the app context at
runtime. Motion 12 VisualElements snapshot `MotionConfig.reducedMotion` when
they are created, so `MotionConfig` is not the reactive authority by itself.
Every Motion component must consume `useAppMotionPolicy()` or
`useAppReducedMotion()` to select reduced variants and to disable layout
projection and drag when the policy is reduced. Policy changes update the
existing tree; they must not force-remount it.

In reduced motion:

- Shared element transitions become a 120 ms crossfade.
- Push parallax and interactive edge movement are disabled.
- Sheets appear and disappear with a short opacity transition; dragging remains
  available only where needed for dismissal.
- Layout changes update instantly or use a bounded crossfade.
- Focus, history, and state completion semantics remain identical.

## Accessibility

- Transition wrappers do not change semantic ownership or duplicate accessible
  content.
- Outgoing surfaces become inert once the incoming surface owns focus.
- Focus moves to the new heading, dialog, or reader command after entry and
  returns to the exact source control after exit when it still exists.
- Sheet and pushed-page gestures always have visible button alternatives.
- Screen reader announcements occur on state completion, not on every motion
  frame.

## Performance Budget

- Navigation frames target 60 fps on recent iPhones.
- Full-screen motion uses transform and opacity only.
- Existing small glass controls may retain static backdrop blur. Full-screen
  drag progress does not animate blur values.
- `will-change` exists only while a component is entering, dragging, settling,
  or exiting.
- EPUB iframes are isolated from Motion layout projection.
- A single gesture frame must not trigger React state updates for raw pointer
  movement. Motion values update outside React render.
- Navigation should not introduce a long task over 50 ms in normal transitions.
- Shared transition snapshots are released immediately after completion or
  cancellation.

## Error and Recovery Behavior

- A missing shared source uses the centered reader fallback.
- A missing pushed entity removes the invalid entry and returns to the nearest
  valid parent.
- A failed dynamic Motion feature load falls back to static CSS states and does
  not prevent navigation.
- Interrupted sheet and reader exits complete exactly once.
- Browser back during an active gesture cancels gesture ownership and resolves
  to the requested history entry.
- Keyboard open and orientation changes recompute constraints without snapping
  the active sheet off-screen.

## Implementation Sequence

The final scope remains the whole app, but implementation is staged so every
step has an attributable regression surface.

1. Install Motion and add motion tokens, `AppMotionRoot`, navigation reducer,
   History synchronization, and reduced-motion policy.
2. Move root tabs and pushed library/settings subviews onto `NavigationStack`.
3. Add shared book-cover presentation and coordinated reader chrome.
4. Replace `BottomSheet` internals with `MotionSheet`, then migrate all sheet
   consumers.
5. Add edge-back, sheet scroll handoff, and complete gesture arbitration.
6. Add list layout animation, Ask AI behavior, settings controls, statistics,
   and ambient background coordination.
7. Remove superseded CSS keyframes, timers, manual style mutation, and
   permanently active compositing hints.
8. Run full visual, interaction, accessibility, performance, and production
   deployment verification.

## Verification

### Unit and Component Tests

- Navigation reducer push, pop, replacement, interruption, and invalid-entry
  recovery.
- Browser History synchronization and `popstate` behavior.
- Edge-back and sheet gesture ownership, thresholds, velocity, and cancellation.
- Reduced-motion equivalence.
- Focus and scroll restoration.
- Shared book origin registration and fallback.
- Exactly-once sheet and reader completion.

### Browser Tests

- iPhone 14/15-class viewports in portrait and landscape.
- Root tab changes with retained scroll positions.
- Book open and close from grid and list modes.
- Source cover visible, partially visible, and no longer mounted.
- EPUB paged and scrolling modes, TXT scrolling and paged modes.
- Reader chrome tap, scroll dismissal, swipe-to-turn, text selection, and pinch
  zoom interaction.
- Every sheet open, drag, interruption, nested transition, keyboard state, and
  browser back path.
- Rapid repeated taps and transitions interrupted halfway.
- System and app reduced-motion settings.

### Visual and Performance Evidence

- Capture start, midpoint, and completion screenshots for root, push, reader,
  and sheet transitions.
- Record representative gestures at mobile viewport size and inspect for blank
  frames, overlap, clipping, or stale source clones.
- Measure frame cadence and long tasks during tab, push, reader, and sheet
  transitions.
- Confirm text and fixed controls do not shift or resize unexpectedly.

### Completion Criteria

- Every application surface uses the shared motion tokens and one of the four
  navigation layers.
- No legacy surface-level navigation keyframe remains active alongside the new
  stack.
- Browser back, visible back, and completed edge-back gestures produce the same
  navigation state.
- Reader and sheet gestures do not steal EPUB/TXT scroll, page turn, selection,
  input, slider, or wheel gestures.
- Reduced motion preserves all functionality without spatial motion.
- Full test, lint, production build, and production asset verification pass.
- Mobile visual and interaction evidence covers all transition families.
