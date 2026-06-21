# Reader Motion System Design

## Goal

Make the reader feel calm, responsive, and native-like on iPhone without letting animation interfere with reading, scrolling, selection, or progress persistence.

## Current Problems

1. Reader chrome is hidden from every TXT scroll event and every EPUB progress callback. Progress updates can therefore immediately undo a user tap that just showed the controls.
2. The outer reader listens to both Pointer Events and Touch Events. On iPhone the same gesture can travel through both paths, producing duplicate or conflicting tap/swipe decisions.
3. Reader controls animate opacity, translation, scale, and blur together with mismatched durations. Multiple large translucent layers also animate at once, which reads as decorative glass rather than restrained system UI.
4. The reader stage declares transitions and `will-change` for padding even though its visible and hidden padding are identical. This creates unnecessary layout work.
5. Bottom sheets use entrance-only keyframes. They unmount immediately when closed, cannot be interrupted, and do not follow a finger during dismissal.
6. TXT scroll handling updates several React states and writes IndexedDB on every scroll event. This can rerender the full `Home` tree and create storage pressure during momentum scrolling.
7. Progress bars animate `width`, a layout-driving property.
8. Switching away from an open book unmounts the reader. Returning remounts EPUB/TXT content, which can flash and makes the transition feel like a web page reload.
9. Reader preference changes can reflow text without preserving the current reading anchor.

## Motion Language

- Reader chrome enter: 220ms, opacity plus 8px translation, ease-out-quint.
- Reader chrome exit: 180ms, opacity plus 8px translation, ease-out-quart.
- Sheet enter: 240ms, backdrop fade plus vertical translation.
- Sheet exit: 180ms, interruptible from the current drag offset.
- Press feedback: 100-120ms, opacity or at most `scale(0.98)`.
- Page/tab transition: 180-220ms, small translation and opacity only.
- Theme color transition: 180ms.
- No bounce, rotation, blur animation, flash animation, or large scale changes.
- Reduced motion: no translation or interpolation; state changes remain immediate and readable.

## Interaction Architecture

### Reader gesture controller

The outer TXT reader uses one Pointer Events path. It records pointer-down coordinates and rejects taps after movement, long press, selection, or interaction with controls. EPUB continues to attach handlers inside epub.js documents because iframe events do not bubble to React, but uses the same movement and timing thresholds.

Scrolling hides chrome once at interaction start. Progress changes never hide chrome by themselves.

### Scroll and persistence scheduling

TXT progress calculations run at most once per animation frame. IndexedDB persistence is delayed until scrolling has been quiet for 180ms. UI progress can remain current without writing storage for every pixel of movement.

EPUB progress callbacks are coalesced through the same frame scheduling rule before updating React state.

### Reader session lifetime

An open reader remains mounted while the user visits Library or Settings. Inactive reader UI is visually hidden and non-interactive rather than destroyed. Returning to Reading reveals the existing session and position without rebuilding the EPUB rendition.

### Bottom sheets

A shared `BottomSheet` owns:

- backdrop and panel enter/exit state;
- pointer capture on the grabber;
- direct `translateY` tracking while dragged;
- velocity and distance based dismissal;
- close animation before invoking the parent callback;
- Escape key dismissal and reduced-motion fallback.

Reader settings, table of contents, reading goal, AI provider, and Ask AI use this shared behavior first. Existing library management sheets can adopt the same frame without changing their data operations.

## Rendering and Performance

- Use `transform` and `opacity` for motion.
- Use CSS custom properties and `scaleX` for progress indicators.
- Remove persistent `will-change`; add containment only around isolated reader overlays.
- Add `content-visibility: auto` to long library and table-of-contents rows, not to reader paragraphs because it would distort scroll metrics.
- Keep cover object URLs memoized and revoked as they already are.
- Preserve native momentum scrolling and avoid custom smooth scrolling.

## Reader Preferences

Theme colors crossfade on the reader surface. Font size, line height, and content width are not interpolated frame-by-frame because that would repeatedly lay out long text. Instead, the current progress anchor is captured before applying a preference and restored on the next frame, avoiding a visible jump while keeping layout work bounded.

## Acceptance

- A center tap consistently toggles reader controls after prolonged scrolling.
- Scrolling does not immediately re-hide controls after a tap unless a new scroll begins.
- Chrome appears in 180-240ms and disappears in 160-220ms without blur or large scale.
- Reader settings and TOC sheets follow a drag and dismiss according to distance or velocity.
- Closing a sheet animates out before unmount.
- TXT momentum scrolling remains native and progress persists after scrolling stops.
- Returning from Library to an already open book does not recreate the reader.
- Theme changes crossfade; typography changes preserve the reading anchor.
- `prefers-reduced-motion` and the in-app reduce-motion setting remove nonessential motion.

