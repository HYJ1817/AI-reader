# Reader Menu and View Motion Design

## Goal

Make reader controls reliably appear after a stationary body tap, remove the reading-goal shortcut from the reader menu, and give sheets and nested views a consistent high-frame-rate transition.

## Interaction

- A stationary TXT or EPUB body tap toggles reader controls.
- Native TXT scroll events update progress but do not independently hide controls.
- A deliberate vertical drag or mouse wheel hides reader controls.
- The reader menu contains contents, appearance, reading mode, and AI only.
- Bottom sheets enter after an initial painted frame and exit before unmounting.
- Opening collections or AI provider configuration slides the incoming view 36 px toward rest while fading in.
- Forward navigation enters from the right; back navigation enters from the left.

## Motion Protocol

- Duration: 210 ms for entrances, 160-180 ms for exits.
- Easing: `cubic-bezier(0.32, 0.72, 0, 1)` for view movement.
- Animated properties: `transform` and `opacity`.
- `will-change` is limited to active transition classes.
- Existing reduced-motion settings collapse animations to effectively instant transitions.

## Scope

- `app/page.tsx`
- `app/ReadingSession.tsx`
- `app/ReaderControls.tsx`
- `app/BottomSheet.tsx`
- `app/LibrarySurface.tsx`
- `app/AiSettingsSheet.tsx`
- `app/page.module.css`
- focused regression tests under `lib/`
