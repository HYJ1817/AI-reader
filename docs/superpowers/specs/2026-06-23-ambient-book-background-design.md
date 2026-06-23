# Ambient Book Background Design

## Goal

Add a cover-derived ambient background that remains visible across the library,
reading dashboard, settings, and EPUB/TXT reading surfaces. The effect should
feel cover-led and immersive while preserving the existing quiet iOS-style
product hierarchy.

## Confirmed Direction

- Use the most recently opened book as the single background source.
- Apply the background to all three primary tabs and the active reader.
- Use the strongest reviewed visual treatment: enlarged cover color, strong
  blur, and clearly visible saturation.
- Preserve the same source while switching tabs or entering the reader.
- Do not expose a new user setting for this feature.

## Component Boundary

Create an `AmbientBookBackground` client component mounted once near the root of
`app/page.tsx`.

Inputs:

- Featured `BookRecord | null`
- Whether reduced motion is active

Responsibilities:

- Acquire and release real cover object URLs through `lib/blobUrlCache.ts`.
- Render a deterministic fallback derived from the existing fallback-cover
  palette when no real cover exists.
- Crossfade when the featured book changes.
- Render no interactive or accessible content.

The component must not own book selection, persistence, reader state, or theme
preferences.

## Book Selection

Reuse the existing `selectFeaturedLibraryBook(books)` result. It already follows
the desired recent-reading order through `lastOpenedAt`, with creation time as a
fallback.

When a book is opened, the existing save-and-refresh path updates
`lastOpenedAt`; the ambient source then changes without introducing a new
database field or schema version.

If the featured book is deleted or no books exist, the component fades back to
the normal themed application background.

## Visual Layers

The background uses three fixed viewport layers:

1. A scaled cover image or deterministic fallback color field.
2. Strong blur and moderate saturation to remove readable cover details.
3. A theme-aware surface veil that stabilizes text contrast.

The cover layer remains static. It must not pan, zoom continuously, respond to
scroll position, or run a decorative loop.

The selected strong treatment applies throughout the product. Theme-specific
veil tokens may differ between system/light, sepia, and dark modes so that the
perceived strength stays similar without hard-coding text colors.

## Surface Integration

The ambient component sits behind the persistent navigation surfaces and reader.
The following opaque layers become theme-aware translucent layers:

- Application root background
- Library, reading dashboard, and settings surfaces
- Reader shell and reader stage
- TXT reader body

Ordinary rows and controls keep their current surface tokens. The feature does
not convert content sections into glass cards.

## EPUB Integration

EPUB content is rendered inside an iframe. The existing EPUB theme registration
currently forces an opaque body background, so root-level ambience cannot be
visible through it.

Change the EPUB reader theme rules so:

- EPUB `html` and `body` backgrounds are transparent.
- Foreground colors remain explicitly controlled by the existing reader theme.
- The outer reader shell supplies the theme-aware veil and ambient background.
- Publisher-provided content backgrounds must not override the transparent
  reading canvas.

The EPUB tap, selection, scrolling, and swipe handlers are not changed by this
feature.

## Motion

- On featured-book change, crossfade the ambient source once.
- Do not animate filter radius, layout, or viewport scale.
- When application or system reduced motion is enabled, replace the source
  immediately.
- Tab changes and reader presentation do not restart the ambient transition.

## Performance And Lifecycle

- Reuse `acquireBlobUrl` and `releaseBlobUrl`; do not call
  `URL.createObjectURL` directly in the component.
- Keep at most the outgoing and incoming background layers during a crossfade.
- Remove the outgoing layer after the transition.
- Use fixed positioning and compositor-friendly opacity changes.
- Avoid canvas color extraction and continuous image processing.
- The image must use a bounded oversized layer rather than an unbounded blur
  surface to limit iPhone GPU cost.

## Accessibility

- Mark the component `aria-hidden="true"`.
- Set `pointer-events: none`.
- Preserve current foreground and semantic color tokens.
- Respect both `prefers-reduced-motion` and the application reduce-motion
  preference.
- Verify readable contrast in light, dark, sepia, and system themes.

## Testing

Automated tests must cover:

- The root mounts one shared ambient component.
- The existing featured-book selector supplies its source.
- A real cover uses the shared Blob URL cache and releases it on change/unmount.
- A book without a cover renders a deterministic fallback.
- No book renders only the normal themed background.
- Reduced motion disables the crossfade.
- EPUB theme rules use a transparent canvas while preserving foreground colors.
- Reader and primary surfaces expose the ambient layer instead of replacing it
  with opaque root backgrounds.

Verification must include:

- Full Vitest suite
- ESLint
- Production build
- `npm audit --json`
- `git diff --check`
- Browser checks at 390 x 844 for library, reading dashboard, settings, TXT, and
  EPUB
- Light, dark, and sepia theme screenshots
- Console error and warning inspection

Real-iPhone verification remains required for final performance judgment,
especially EPUB scrolling and page swipes.

## Non-Goals

- No IndexedDB schema changes
- No import, backup, AI, reading-progress, or reader-control behavior changes
- No cover color extraction
- No animation library
- No per-page background selection
- No manual background picker
- No continuous parallax or decorative motion
