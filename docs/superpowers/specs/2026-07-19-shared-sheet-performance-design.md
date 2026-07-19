# Shared Sheet 120Hz-Oriented Performance Design

Date: 2026-07-19

## Objective

Remove the visible hitch when a Library book's More button opens the book
action sheet, and apply the same rendering fix to every shared bottom sheet.
Preserve the current visual design, navigation model, gestures, accessibility,
themes, and reduced-motion behavior.

The implementation must be designed for an 8.33ms 120Hz frame budget. Automated
Chromium can verify compositor-friendly behavior, stable 60Hz cadence, absence
of long tasks, and absence of layout shift. It cannot prove physical iPhone
Safari/PWA 120fps; that remains a real-device acceptance item.

## Scope

In scope:

- The shared `MotionSheet` overlay, backdrop, and panel entrance/exit path.
- Every sheet route rendered through that shared component, including book
  actions, deletion, group management, reader settings, table of contents, Ask
  AI, reading goal, batch actions, and collection creation.
- A real Library More-button performance regression test.
- Shared sheet functional, motion, theme, and accessibility regression coverage.

Out of scope:

- Redesigning sheet content, geometry, typography, colors, shadows, or timing.
- Changing navigation history, drag-dismiss thresholds, focus order, or data
  operations.
- Pre-mounting every possible sheet.
- Claiming verified 120fps without a physical 120Hz iPhone Safari/PWA trace.

## Evidence and Root Cause

The Library More button performs only one navigation operation:
`presentSheet("book-actions", { entityId: book.id })`. Book lookup and Library
filtering are not performed in the click handler.

The shared sheet currently drives its backdrop through an inherited CSS custom
property on the overlay while also animating opacity on the overlay parent. The
custom property changes every animation frame and can invalidate style across
the sheet subtree. Parent opacity also groups the moving panel and backdrop into
one animated transparency layer instead of keeping their responsibilities
separate.

A local production-build probe using the real More button recorded:

- First unthrottled click-to-panel-mount: 24.7ms; warmed samples: 8.0ms and
  4.2ms.
- Stable unthrottled 60Hz cadence after mounting, with no long task or layout
  shift.
- Under 4x CPU throttling, one sample contained a 49.9ms frame and a 58ms long
  task.
- A preliminary unthrottled entrance trace over roughly 700ms reported 56
  style updates, 75 Paint events, and 559 RasterTask events. Its temporary
  probe was deleted before the acceptance method was fixed, so later runs could
  only recreate it from prose. Those event counts remain historical diagnostic
  context, not a matched baseline or a source for acceptance ceilings.

Temporary diagnostic scripts were stored only under gitignored `test-results`,
then deleted. The local server was stopped and the tracked worktree remained
clean.

## Considered Approaches

### 1. Separate compositor-owned backdrop and panel (selected)

Render an explicit backdrop sibling inside the static overlay. Bind the shared
progress MotionValue directly to that element's `opacity`. Keep the panel on its
existing `y` transform. Remove the overlay parent's opacity animation and the
inherited per-frame custom property.

This directly removes the measured invalidation path, keeps visual behavior
unchanged, and creates two bounded animation responsibilities that browsers can
composite independently.

### 2. Register a non-inheriting CSS custom property

Use `@property` with `inherits: false` for the backdrop value and keep the
pseudo-element. This is smaller but still drives a custom property instead of a
native opacity style and adds a less robust Safari compatibility dependency.

### 3. Pre-mount all sheets

Keep hidden sheet DOM ready before interaction. This can reduce some cold-mount
work but increases DOM size, memory, state synchronization, and accessibility
risk. It does not address the measured per-frame style and paint path.

## Component Design

### Static overlay

`MotionSheet` retains one fixed overlay responsible for viewport placement,
pointer capture, z-order, and outside-tap dismissal. The overlay itself does not
animate opacity or any layout-affecting property.

### Explicit backdrop

The overlay renders one non-interactive backdrop element before the panel. Its
only animated property is native `opacity`, bound directly to the existing sheet
progress MotionValue. It uses the existing `rgba(0, 0, 0, 0.28)` visual value.

The backdrop receives a narrowly scoped compositing hint only while the sheet is
mounted. It never receives pointer events, so outside taps continue to land on
the overlay.

### Transform-only panel

The panel keeps its interruptible `y` MotionValue, spring entrance, timed exit,
drag control, containment, rounded corners, borders, fill, and shadow. Its only
animated entrance/exit property is `transform`. A narrowly scoped compositing
hint exists only while the mounted sheet may move.

The current 300ms sheet-enter token, 250ms exit token, spring parameters, and
gesture-settle behavior remain unchanged unless measurement proves the timing
itself is defective. No blur, filter, shadow, border radius, height, top, or
layout property is animated.

## State and Interaction Flow

1. A caller presents a sheet through the existing navigation state.
2. `MotionSheet` mounts the static overlay, explicit backdrop, and panel.
3. Existing focus capture and background `inert` behavior run unchanged.
4. The panel's `y` MotionValue animates toward zero.
5. The same progress value directly changes only the backdrop's opacity.
6. Dragging or interrupted dismissal retargets the existing MotionValue without
   starting a competing animation.
7. Exit moves the panel off-screen and fades the backdrop through progress;
   presence cleanup then restores focus and background interactivity.

No sheet-specific content needs to know about the rendering optimization.

## Accessibility and Reduced Motion

- Preserve `role="dialog"`, `aria-modal`, labels, focus placement, focus trap,
  Escape handling, focus restoration, and background `inert` management.
- Preserve the 44px Library More target and its native button semantics.
- With reduced motion enabled, set the panel and backdrop immediately to their
  destination states; do not leave a transition or running animation.
- Keep drag gestures, scrollable sheet content, and interactive controls from
  competing for the same pointer sequence.

## Visual Requirements

- Sheet fill, shadow, border, radius, safe-area padding, grabber, dimming amount,
  and content remain visually unchanged.
- Light, Sepia, Dark, and system-dark must retain their existing materials and
  contrast.
- The first visible sheet frame must be coherent: no flash, transparent panel,
  delayed backdrop, naked content, or jump caused by layout measurement.

## Testing Strategy

Test-driven implementation starts with failing source/CSS contract tests that
require:

- An explicit backdrop element driven by native opacity.
- A static overlay with no parent opacity animation.
- No inherited `--sheet-backdrop-opacity` frame path.
- A panel entrance/exit contract limited to transform.
- Narrow `will-change` usage only on the backdrop and moving panel.
- Unchanged reduced-motion, focus, inert, drag, and navigation contracts.

Browser coverage will:

- Import a book, switch to Library list mode, and click the real More button.
- Measure click-to-mount, frame intervals, long tasks, and layout shift during
  the book-action-sheet entrance.
- Exercise open, close, Escape, outside tap, drag dismiss, interrupted settle,
  and reduced motion through the shared sheet layer.
- Confirm every configured sheet route still mounts and dismisses.
- Run on iPhone 14 and iPhone 15 Pro Max Chromium profiles.
- Inspect representative Light, Sepia, Dark, and system-dark screenshots at
  original resolution.

The automated performance gate is stable 60Hz smoke evidence: P95 frame cadence
at or below 20ms, no frame above the explicit long-frame guard chosen by the
test, no long task, and zero layout shift. Source and computed-style assertions
enforce the 120Hz-oriented compositor-only architecture. Physical iPhone 120Hz
acceptance remains separate.

Trace acceptance uses a paired, reproducible A/B method. Build production
artifacts from the exact baseline and candidate revisions with the same build
command, then run one byte-identical temporary probe with the same Chromium
binary, iPhone profile, readiness sequence, real More-button pointer click, and
fresh isolated contexts. Capture three traces per revision and analyze the
exact click-relative interval `[0, 700ms)`. For each trace, sum `dur` separately
for `UpdateLayoutTree` and `Paint` on `CrRendererMain`, and for `RasterTask`
across renderer worker threads.

For each category, both the candidate median and the candidate maximum across
the three traces must be at most 50% of the matched baseline median. The matched
baseline medians establish absolute ceilings of `20.9585ms` for
`UpdateLayoutTree`, `8.5375ms` for Paint, and `33.959ms` for RasterTask. Event
counts are diagnostic only: `UpdateLayoutTree` is commonly emitted with
animation/rAF ticks, so its count can remain stable for less work per tick and
can rise on a 120Hz display. A fixed count ceiling must not substitute for the
matched duration gate.

## Quality Gates

Before completion:

- The new tests must fail against the current implementation for the expected
  rendering-contract reason, then pass after the minimal fix.
- Focused tests, full Vitest, full configured ESLint, and production webpack
  build must pass.
- Full shared native-navigation coverage must pass on both configured phone
  profiles.
- Matched before/after real-click traces must pass all three duration gates for
  `UpdateLayoutTree`, Paint, and RasterTask; event counts are recorded only as
  diagnostics.
- Impeccable's changed-source detector and `git diff --check` must pass.
- No deployment or push occurs unless the user authorizes it after local
  verification.

## Risks and Mitigations

- Direct backdrop opacity could alter dimming timing. Use the same progress
  MotionValue and compare start/mid/end screenshots.
- Layer hints can consume memory if applied broadly. Restrict them to the two
  mounted moving elements and remove both with sheet unmount.
- A synthetic Chromium profile cannot reproduce every WebKit compositor
  decision. Preserve the physical iPhone 120Hz test as an explicit acceptance
  risk instead of overstating automated evidence.
- Changes to the shared component affect every sheet. Keep content components
  untouched and run the full sheet-route matrix on both phone profiles.
