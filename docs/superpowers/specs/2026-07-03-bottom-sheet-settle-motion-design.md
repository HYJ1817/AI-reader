# Bottom Sheet Settle Motion Design

## Goal

Make shared bottom sheets feel more continuous after a user releases a drag,
without changing sheet layout, content, or dismissal rules.

This is an incremental polish pass on the existing `BottomSheet` motion system.
The current sheet already supports enter, open, drag, close, interruptible
dismissal, backdrop tracking, and reduced-motion fallbacks. This change adds a
separate release-settle phase so an undecided drag returns to rest with a
deliberate native-feeling timing instead of reusing the general sheet open
transition.

## Scope

- `app/BottomSheet.tsx`
- `app/page.module.css`
- `lib/motionInteractions.ts`
- `lib/motionInteractions.test.ts`
- `lib/motionCss.test.ts`

Reader settings, table of contents, custom background, AI provider, and other
existing shared bottom sheets should benefit automatically because they use the
same component.

## Non-Goals

- Do not redesign any sheet content.
- Do not change custom background, AI provider, or reader settings behavior.
- Do not introduce a new animation library.
- Do not animate layout-driving properties such as height, top, margin, or left.
- Do not add bounce, overshoot, blur animation, or decorative motion.

## Interaction Model

The sheet keeps the existing phases and adds one explicit release phase:

- `entering`: mounted at a small downward offset, then moves to rest.
- `open`: resting and interactive.
- `dragging`: follows the grabber with no transition.
- `settling`: returns from the released drag offset to rest.
- `closing`: exits from the current offset and unmounts after the transform
  transition finishes.

Release behavior:

- If `shouldDismissSheet` returns true, the sheet enters `closing`.
- If dismissal is not committed, the sheet enters `settling`.
- During `settling`, the panel animates `transform` back to
  `translate3d(0, 0, 0)`.
- The backdrop opacity returns to `1` on the same frame as the panel settles.
- When the panel transform transition ends, the sheet returns to `open`.
- Reduced motion skips the visible settle and returns to `open` immediately.

Interrupt behavior:

- A sheet can still be grabbed during `entering`, `open`, `settling`, and
  `closing`.
- Starting a drag during `settling` reads the current transform, disables the
  active transition, and continues from that visual position.
- Starting a drag during `closing` preserves the existing interruption behavior
  and cancels the pending close callback.

## Motion Protocol

Add one token for drag release:

```css
--motion-sheet-settle: 220ms;
```

The settle phase uses the existing `--ease-sheet-settle` curve. This gives the
release a shorter, more responsive return than opening a sheet, while keeping
the same calm curve family as sheet dismissal.

Animated properties:

- Panel: `transform`
- Backdrop: `opacity`

No new persistent `will-change` should be added outside active transition
classes.

## Testing

Add or update focused tests before implementation:

- `motionInteractions.test.ts`
  - `canInterruptSheetPhase` accepts `settling`.
- `motionCss.test.ts`
  - the app defines `--motion-sheet-settle: 220ms`;
  - `.motionSheetSettling .bottomSheet` uses `transform`,
    `--motion-sheet-settle`, and `--ease-sheet-settle`;
  - reduced motion removes visible settling movement.
- Existing sheet dismissal tests continue to pass unchanged.

Implementation tests can remain source/CSS-level because the existing repo
already validates this shared motion layer through pure helpers and CSS
contracts.

## Acceptance

- A short downward drag that is not dismissed visibly settles back to rest.
- A committed downward drag still closes the sheet.
- Dragging can interrupt a settling sheet without jumping back to the original
  pointer-down position.
- Closing remains interruptible.
- Reduced motion keeps state changes immediate.
- Test, lint, build, and whitespace checks pass after implementation.
