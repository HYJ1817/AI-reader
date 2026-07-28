# PWA Interaction Fluidity Design

## Status

Approved on 2026-07-28.

This specification defines the application-wide interaction and rendering
contract for the installed iPhone PWA. It keeps the current web architecture
and brings root navigation, pushed pages, the reader, sheets, Workspace, AI,
and local component state under one coherent motion system.

Primary device: iPhone 15 Pro Max running the home-screen PWA.

Product personality: quiet, native, focused. Motion communicates hierarchy,
continuity, and direct manipulation; it is not decoration.

Where this document conflicts with earlier motion timing or sheet-transition
specifications, this document is authoritative. Existing navigation roles,
storage behavior, and product information architecture remain authoritative
unless this document explicitly changes them.

## Decision Summary

The project will remain a PWA. It will not use SwiftUI or add a native wrapper.
The chosen approach is to establish a unified interaction grammar and apply it
to every visible state transition, rather than patching only the most obvious
animations.

The work has five central decisions:

1. Shorten and simplify spatial transitions so the interface responds sooner.
2. Replace independent nested sheets with one persistent sheet container and
   an internal navigation stack.
3. Cover local state changes inside Workspace, AI, settings, lists, and the
   reader, not only outer page navigation.
4. Separate immediate feedback, visual motion, rendering, persistence, and AI
   streaming into independent scheduling lanes.
5. Treat interruption, the software keyboard, app suspension, orientation,
   accessibility, and real-device performance as first-class behavior.

## Goals

- Make every navigation and state change feel immediate on iPhone 15 Pro Max.
- Preserve spatial continuity between a control and the surface it opens.
- Allow rapid input to retarget motion from its current frame without queues,
  flashes, or replayed entrances.
- Give every popup family consistent presentation, dismissal, focus, keyboard,
  and drag behavior.
- Keep reading, Workspace composition, and AI streaming responsive while data
  is loaded or persisted.
- Define measurable browser gates and a physical-device acceptance contract.
- Preserve all existing book, Workspace, backup, reader, and AI behavior.

## Non-Goals

- Migrating the application to SwiftUI or adding a native iOS shell.
- Rebranding the visual system or changing the root information architecture.
- Adding a fourth root tab or redesigning Workspace as a dashboard.
- Changing IndexedDB schemas, backups, AI provider contracts, or reading data
  unless a UI-state correction strictly requires it.
- Copying OpenMinis implementation code. Only independently reimplemented
  interaction and performance principles may be used.
- Adding decorative bounce, ambient drift, parallax loops, staggered spectacle,
  or motion without a state or hierarchy purpose.

## Evidence and Current-State Diagnosis

### Local Baseline

The application already has a substantial motion foundation:

- three persistent root tabs;
- four pushed route families;
- a full-screen reader presentation;
- thirteen sheet routes;
- a shared `MotionSheet` with drag, focus trapping, `inert`, visual viewport
  handling, and interruptible settling;
- a navigation stack with root preservation and edge-back support;
- central durations and springs in `lib/motionSystem.ts`.

Production measurements on an iPhone 15 Pro Max Playwright profile passed the
existing 60 Hz gates:

- book action sheet click-to-mount: 27.8 ms;
- representative transitions: about 16.7 ms p95 frame interval;
- no observed long task of 50 ms or more;
- cumulative layout shift: 0.

These results show that the reported lack of fluidity is not one universal
frame-rate failure. The stronger causes are incomplete coverage, discontinuous
state changes, excessive perceived duration, overlapping text during root-tab
motion, and conflicting component-level behavior.

### Specific Problems

1. Root-tab content currently spends about 420 ms translating and fading two
   full surfaces. Mid-transition captures show visible text ghosting and make
   an otherwise stable frame cadence feel slow.
2. `AppOverlays` renders only the last sheet route. Opening a nested sheet
   immediately unmounts the previous sheet and mounts a new bottom-entry sheet,
   so the popup loses visual continuity.
3. Outer page and sheet navigation is animated, but several state-heavy
   interiors replace content abruptly. This includes Workspace conversations,
   Workspace materials, AI settings, the table of contents, and reader setting
   states.
4. Animation, measurement, content rendering, persistence, and streaming can
   compete in the same update window even when each path is acceptable alone.
5. Keyboard, background/resume, rotation, cancellation, and missing-entity
   behavior do not yet share one explicit final-state contract.

### OpenMinis Principles Rechecked

OpenMinis was rechecked at public commit
[`9cf3a85`](https://github.com/OpenMinis/OpenMinis/commit/9cf3a855fecd27bb5735b84cacbd56852a3ab8dd)
and against its recent public release notes. The relevant lessons are
principles rather than source to port:

- navigation uses short, role-specific transitions with faster exits;
- anchored popups use a faster scale/fade contract than full sheets;
- chat rendering coalesces streaming updates and bounds the rendered tail;
- message measurement and layout work are cached or batched;
- when a streaming conversation is bottom-pinned, message geometry settles
  directly while one viewport quantity follows with a short eased motion;
- programmatic following stops while the user is scrolling or decelerating;
- provider and persistence work is kept off the immediate interaction path.

AI Reader will reproduce these principles through its own React, Motion, CSS,
and IndexedDB architecture. OpenMinis is GPL-3.0; no source code is copied.

## Interaction Model

Every visible change belongs to one of six roles. A component must select a
role instead of inventing a duration, easing curve, or entrance direction.

### 1. Immediate Feedback

Press feedback begins within 80 ms of pointer-down or keyboard activation.
Buttons, rows, covers, chips, segmented controls, and menu actions provide a
small opacity, scale, fill, or highlight response appropriate to their shape.

The feedback releases from its current value. It does not wait for navigation,
network work, or persistence, and it does not use a looping ripple.

### 2. Root Selection

Root tabs are peers, not a back stack.

- Content duration: 160 ms.
- Selection-indicator duration: 220 ms.
- The destination content uses a short directional offset and opacity change.
- Translation is bounded so two pages never produce a readable double image.
- The old surface becomes non-interactive when the new selection is committed.
- Preserved scroll and local state do not replay page-load choreography.

Root-tab input can retarget the indicator and content immediately. Ten rapid
selections must resolve to the final requested tab without queued intermediate
animations.

### 3. Push and Pop

Pushed pages express parent/child hierarchy.

- Push duration: 280 ms.
- Pop duration: 200 ms.
- The destination owns the dominant horizontal movement.
- The parent uses a restrained counter-motion and opacity adjustment.
- Push and pop are exact directional counterparts.
- Browser back, visible back, and completed edge-back use the same state path.

During an interactive back gesture, motion follows the pointer directly. A
release settles from current progress and velocity; it does not restart a
fixed keyframe.

### 4. Reader Presentation

The reader remains a dedicated full-screen presentation because horizontal
input inside it belongs to reading.

- Open duration: 280 ms.
- Close duration: 210 ms.
- A valid visible cover origin may preserve cover-to-reader continuity.
- If the origin is stale or missing, a centered bounded fade/scale is used.
- EPUB iframe content is not layout-projected.
- Reader chrome coordinates as one state rather than several unrelated
  entrances.

Reader opening must display a meaningful visual first frame before expensive
content preparation. Closing never waits for reading-position persistence.

### 5. Sheet Presentation

Bottom sheets express temporary tasks over the current context.

- Enter duration: 280 ms.
- Exit duration: 220 ms.
- Panel translation, backdrop opacity, and presenting-surface treatment are
  driven by one shared progress value.
- Sheet drag, interruption, and programmatic dismissal settle from the current
  value.
- Blur is not animated frame by frame.

Opening a sheet keeps the trigger-to-surface relationship clear. Dismissal
returns focus to the exact trigger when it still exists.

### 6. Popover and Inline State

An anchored popover is smaller and faster than a sheet:

- Popover enter: 180 ms.
- Popover exit: 120 ms.
- Transform origin follows the trigger when geometry is available.
- Only a bounded scale and opacity change are used.

Inline component-state changes use:

- Enter/change: 160 ms.
- Exit/reversal: 120 ms.
- Layout settles before optional opacity or bounded transform motion.
- Numeric values preserve digit width.
- Lists move neighboring rows coherently rather than replacing the full list.

Examples include segmented content, selected rows, empty/results/error states,
saved indicators, retry state, switches, settings summaries, Workspace tabs,
conversation selection, and material previews.

## Easing and Animation Properties

The motion kernel exposes semantic roles rather than arbitrary public numbers.
Implementation may tune curves during device verification, but it must keep
these properties:

- entry decelerates into rest;
- exit accelerates and completes faster;
- direct manipulation follows the pointer without easing;
- settlement has no visible oscillation or decorative bounce;
- interrupted motion begins from the current rendered value;
- full-surface animation uses only transform and opacity;
- measurement and layout settle before the viewport follows them.

Permanent `will-change` is prohibited. Compositing hints are active only while
a surface is entering, dragging, settling, or exiting.

## Persistent Sheet Navigation

The existing one-route-at-a-time sheet rendering is replaced by one persistent
sheet presentation with an internal navigation stack.

### Container Responsibilities

The container owns:

- one backdrop;
- one drag and dismissal state;
- one focus trap and accessible dialog boundary;
- visual viewport and safe-area behavior;
- the sheet stack and internal history;
- content-height measurement and settling;
- the presenting surface's coordinated treatment.

The backdrop and outer panel do not leave when an inner sheet destination is
opened. The current sheet page remains mounted until its internal transition
completes.

### Internal Push and Back

Nested actions such as rename, delete confirmation, group selection, custom
reader settings, and related Workspace flows push an internal page.

- Internal push uses a restrained horizontal transition.
- Internal back reverses it.
- The title and navigation controls change with the page, not by replacing the
  outer dialog.
- A height change measures the destination once and settles the outer panel
  without fighting the horizontal content transition.
- Browser back first pops an internal sheet page, then dismisses the sheet.
- A destructive confirmation remains visually connected to the action sheet
  that opened it.

### Dismissal and Scroll Handoff

The sheet owns a vertical gesture only when it starts in its header/grabber or
when a scrollable body is at its top and the gesture is downward. Sliders,
text selection, option wheels, inputs, and horizontal controls keep ownership.

If the keyboard is visible, focus and viewport settlement complete before a
sheet drag or height transition starts.

## Complete Coverage Matrix

### Root Surfaces

- Library, Reading, and Settings tab selection.
- Tab indicator movement and icon/label state.
- Root scroll preservation and return state.

### Pushed Routes

- Collections.
- AI providers.
- AI provider configuration.
- Custom background configuration.
- Visible, browser, and edge-gesture back paths.

### Reader

- Book open and close.
- Reader chrome show and hide.
- Table of contents and reader settings presentation.
- EPUB/TXT page, scroll, selection, pinch, and link gesture coexistence.
- Mode, theme, type, spacing, and progress state changes.

### Sheet Routes

- Reader settings and custom reader settings.
- Table of contents.
- Ask AI.
- Reading goal.
- Book actions, rename, delete, and groups.
- Reading Workspace.
- Batch groups and batch delete.
- Collection creation.

Every parent/child sheet pair uses the persistent internal stack.

### Workspace and AI

- Conversation/material segmented selection.
- Session creation and selection.
- Empty, loading, result, streaming, stopped, error, retry, and offline states.
- Material save, preview, rename, export, delete, and memory revocation.
- Composer focus, keyboard geometry, Send, Stop, and draft preservation.

### Local Components

- Menus and popovers.
- Segmented controls, switches, sliders, wheels, and chips.
- List insertion, removal, filtering, reordering, and empty states.
- Book selection, batch mode, progress, toast, inline validation, and success or
  failure feedback.

No component with a user-visible state replacement is exempt merely because it
does not change the route.

## Rendering and Scheduling Contract

Fluidity depends on what runs with an interaction, not only on animation CSS.
The application separates five lanes.

### Immediate Interaction Lane

Pointer feedback, gesture progress, and visual selection update first. Raw
pointer movement does not cause React state updates on every frame.

### Visual Transition Lane

Motion values update transform and opacity on isolated layers. A route commits
its logical destination promptly, but outgoing presentation state can remain
until visual completion.

### Content Rendering Lane

The destination renders a useful first frame from available local state.
Expensive Markdown, long lists, EPUB work, image decoding, and derived summaries
are deferred, chunked, memoized, or bounded as appropriate.

### Persistence Lane

IndexedDB writes, reading-position saves, preference persistence, and backups
do not delay press feedback or route presentation. Failures surface truthfully
after control has moved to the requested visual state.

### Streaming Lane

Provider chunks are coalesced. The complete response remains authoritative,
while the rendered tail and Markdown conversion are bounded according to the
Workspace specification.

When the thread is bottom-pinned, message geometry settles without animating
every row. Only viewport follow may ease, for roughly 200 ms, and it begins
from the current offset. Programmatic follow stops while the user is tracking,
scrolling, or decelerating and resumes only after an explicit return to the
bottom.

## Interruption and State Authority

Logical navigation state is authoritative. Visual state represents progress
toward it.

- The last valid user intent wins.
- A new intent cancels or retargets the active visual transition from its
  current frame.
- Transition generation IDs reject stale completion callbacks.
- Commands are not globally queued behind animation timers.
- Exits and completion callbacks run exactly once.
- A missing or deleted entity removes the invalid entry and resolves to the
  nearest valid stable surface.
- The application never animates into a destination known not to exist.

## Gesture Ownership

Gesture ownership is decided once per pointer sequence in this priority order:

1. Native input, link, text selection, slider, option wheel, and control use.
2. Reader horizontal page-turn or reading interaction.
3. Scrollable content with available movement in the requested direction.
4. Sheet vertical dismissal from an eligible origin.
5. Application left-edge back when no reader or sheet has claimed the gesture.

After intent crosses its threshold, lower-priority systems cannot take over.
`pointercancel`, lost capture, browser interruption, and multi-touch changes
always settle the claimed surface safely.

## Keyboard and Viewport Behavior

- Focused inputs remain visible above the software keyboard.
- Sheet remeasurement and full spatial navigation do not run simultaneously
  with keyboard geometry changes.
- Drafts survive sheet closure, page changes, backgrounding, and recoverable
  provider failures according to their owning feature contract.
- Search, rename, collection creation, Ask AI, and Workspace share the same
  keyboard-avoidance mechanism.
- Save failure preserves input and returns focus and operability to the same
  control.
- Keyboard dismissal does not cause a second replayed page or sheet entrance.

## Suspension, Resume, and Orientation

On `pagehide`, backgrounding, or loss of animation frames, logical state is
preserved. On resume the UI snaps to the final valid state; stale entrances do
not replay.

On orientation or safe-area changes:

1. Cancel active spatial motion.
2. Measure the new visual viewport once.
3. Resolve constraints and scroll/focus visibility.
4. Present the stable final state.

The application does not attempt to interpolate between obsolete portrait and
landscape geometry.

## Loading, Failure, and Optimistic State

- Navigation and visual feedback occur before asynchronous data work.
- Loading uses a stable local skeleton or inline status, never a full-page
  white flash.
- Empty, offline, error, and retry states occupy the same semantic region as
  the content they replace.
- Optimistic failure rolls back only the affected component through its local
  transition role; it does not replace the page.
- User-entered content is retained whenever retry is possible.
- If the animation layer fails or the environment is overloaded, functionality
  falls back to settled state or a short crossfade.

## Reduced Motion and Accessibility

Reduced motion is active when either the system or app policy requests it.

- Spatial movement and layout projection become an approximately 100 ms
  crossfade or an immediate settled update.
- Gesture alternatives remain visible and functional.
- Outgoing surfaces become `inert` during ownership transfer.
- Focus moves only after the destination is visible and stable.
- Dismissal returns focus to the exact trigger when it remains available.
- Outgoing and incoming copies never produce duplicate accessible
  announcements.
- Streaming uses status semantics without announcing each token.
- State must remain understandable without motion or color.
- Interactive targets remain at least 44 by 44 CSS pixels.
- 200 percent text sizing, contrast, safe areas, and VoiceOver reading order are
  release requirements.

## Performance Contract

### Automated Gates

Representative root, push, reader, sheet, Workspace, and rapid-interruption
tests must meet all of the following on the iPhone 15 Pro Max browser profile:

- press feedback begins within 80 ms;
- click to destination mount is no more than 50 ms;
- p95 frame interval is no more than 16.7 ms;
- no main-thread long task reaches 50 ms;
- cumulative layout shift during the transition is 0;
- ten rapid operations resolve with no incorrect destination, stuck overlay,
  lost focus trap, duplicate history entry, or unhandled error.

The automated 60 Hz gate is a regression floor, not the final quality claim.

### Physical iPhone Acceptance

On an iPhone 15 Pro Max home-screen PWA:

- direct manipulation should normally stay within the 8.33 ms ProMotion frame
  budget when the browser schedules at 120 Hz;
- transitions must not exhibit visible double text, white frames, backdrop
  flashes, stale surfaces, delayed press feedback, or end-of-animation jumps;
- scrolling and AI composition remain responsive during streaming;
- keyboard open/close, background/resume, rotation, reduced motion, VoiceOver,
  rapid taps, interrupted gestures, and weak-network behavior are exercised;
- a screen recording is reviewed at normal speed and frame by frame for each
  transition family.

Safari may choose a lower refresh cadence under power or thermal constraints.
Acceptance therefore evaluates consistent delivery at the cadence provided,
not an unconditional claim that all frames will render at 120 Hz.

## Verification Matrix

### Themes and Viewports

- Light, dark, sepia, and custom book background.
- iPhone 14 and iPhone 15 Pro Max automated viewports.
- Portrait and landscape where the current product supports them.
- Standalone PWA and Safari fallback behavior.

### Interaction Evidence

- Start, midpoint, interrupted, reversed, and completed captures for root,
  push, reader, sheet, internal sheet push, popover, and inline-state roles.
- Frame cadence, long-task, mount-latency, and layout-shift traces.
- Rapid-retarget tests for root tabs, push/back, open/close, and nested sheets.
- Gesture arbitration tests for reader, sheet, edge back, scrolling, selection,
  inputs, sliders, and wheels.
- Focus, `inert`, screen-reader announcement, reduced-motion, and 200 percent
  text tests.

### Regression Scope

- Existing unit, component, navigation, reader, Workspace, backup, lint, type,
  production-build, and PWA tests continue to pass.
- Production verification confirms the deployed build ID and core assets only
  after explicit deployment authorization.

## Delivery Sequence

The complete approved scope is delivered in phases so each regression surface
and rollback boundary stays attributable.

### Phase 0: Instrumentation

Add shared probes and fixtures for press latency, destination mount, frame
cadence, long tasks, layout shift, rapid interaction, transition captures, and
physical-device recording checklists. Preserve the current UI as the baseline.

### Phase 1: Motion Kernel

Introduce semantic roles, authoritative durations/easing, interruption IDs,
reduced-motion behavior, animation-layer isolation, and shared completion
semantics. Replace duplicated constants without changing information
architecture.

### Phase 2: Root and Push Navigation

Shorten root transitions, eliminate double-text ghosting, unify push/pop, and
verify edge/browser/visible back equivalence and rapid retargeting.

### Phase 3: Persistent Sheet Stack

Keep one panel and backdrop mounted, add internal push/back and height settling,
migrate every nested sheet pair, then verify focus, history, keyboard, drag,
scroll handoff, and destructive confirmation behavior.

### Phase 4: Reader

Apply the revised presentation duration, visual-first rendering, coordinated
chrome, source fallback, gesture ownership, and persistence decoupling to EPUB
and TXT modes.

### Phase 5: Workspace and AI

Animate internal semantic state, isolate composer/streaming work, implement
bounded viewport following, and harden keyboard, offline, error, retry, and
long-content transitions.

### Phase 6: Micro-Interactions

Audit every visible component state and move it onto the press, popover, or
inline role. Remove redundant keyframes, timers, permanent compositing hints,
and whole-section replacements.

### Phase 7: Physical-Device Closeout

Run the full automated matrix, build a production candidate, install and test
it as a home-screen PWA on the target iPhone, tune only central tokens, record
evidence, and close documented exceptions. Deployment and publication still
require explicit user authorization.

## Rollback and Change Discipline

- Each phase and major interaction family is committed separately.
- Motion roles and identifying data attributes are centralized so regressions
  can be located and reverted by subsystem.
- Storage migrations are outside this design, so visual rollback does not
  require data rollback.
- Legacy behavior is removed only after the replacement passes focused and
  full regressions.
- Each phase must be stable before the next begins; no phase relies on a large
  final cleanup to become functional.

## Acceptance Criteria

1. Every visible transition uses one documented role and central token set.
2. Root tabs respond immediately, complete in the approved duration, and show
   no readable double image at transition midpoint.
3. Push, visible back, browser back, and edge back resolve through the same
   state model and can be interrupted safely.
4. All nested popup flows preserve one backdrop and panel while their content
   pushes and pops internally.
5. Reader, sheet, edge-back, scroll, form, selection, slider, and option-wheel
   gestures never steal ownership from one another.
6. Workspace and AI state changes are visually continuous, the composer stays
   responsive during streaming, and auto-follow never fights user scrolling.
7. Keyboard, rotation, background/resume, missing entities, cancellation,
   offline state, save failure, and optimistic rollback end in a stable and
   truthful UI.
8. Reduced motion retains all functionality with no required spatial motion.
9. Automated performance gates pass for all representative transition
   families and ten-operation interruption cases.
10. Physical iPhone 15 Pro Max home-screen PWA review finds no material
    ghosting, flashing, jumping, blocked input, stale overlay, or avoidable
    frame-cadence issue.
11. Existing product behavior, accessibility, storage, backup, reader, and AI
    regressions remain green.
