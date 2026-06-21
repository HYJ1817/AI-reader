# Navigation Motion And Reader Modes Design

## Goal

Make primary navigation and reading controls feel coherent on iPhone while
preserving the existing vertical reading experience and adding an optional
paginated mode.

The visible outcome is:

- Library, Reading, and Settings switch with one consistent transition.
- The bottom navigation uses one shared moving indicator.
- Reader controls no longer surround the text with large top and bottom frames.
- Scroll remains the default reading mode.
- Pagination is optional and remembered separately for each book.

## Confirmed Direction

The user selected the progressive floating-tools direction:

- No persistent top bar.
- No persistent bottom toolbar or action-panel frame.
- The back action is an unframed chevron with a 48 px transparent hit area.
- A compact lower-right menu button reveals individual tools in sequence.
- Tool items rise by at most 8 px and fade in with a 35 ms stagger.
- The sequence uses restrained ease-out motion, never bounce or elastic motion.
- Reduced motion removes translation and staggering.

## Scope

This implementation covers three related surfaces:

1. Main-tab navigation motion.
2. Reader chrome simplification.
3. Scroll and paginated reading modes for TXT and EPUB.

It does not redesign the library, fallback book covers, AI provider settings,
or storage architecture beyond the optional per-book reading-mode field needed
for compatibility.

## Main Navigation

### Persistent surfaces

Library, the Reading dashboard, and Settings remain mounted after application
startup. Each surface owns its own scroll container so switching tabs does not
reset scroll position.

The active surface is visible and interactive. Inactive surfaces remain mounted
but use `opacity`, a horizontal translation of at most 8 px, delayed
`visibility: hidden`, and `pointer-events: none`.

Surface order is fixed:

1. Library
2. Reading
3. Settings

A surface before the active index rests 8 px to the left. A surface after the
active index rests 8 px to the right. Changing the active index therefore gives
both outgoing and incoming views a consistent spatial relationship.

### Timing

- Surface enter and exit: 190-220 ms.
- Properties: `opacity` and `transform` only.
- Easing: the existing project ease-out quart/quint tokens.
- No generic keyframe that runs only on mount.
- Reduced motion: no translation and effectively immediate visibility changes.

### Shared tab indicator

The bottom bar contains one indicator element behind the three buttons.
Changing the active tab moves that indicator by `translate3d()` between three
fixed positions. Individual tab buttons no longer create and remove their own
selected backgrounds.

Icons, labels, and the indicator use the same active index. The indicator
transition is 200-220 ms and uses the existing emphasized ease-out curve.

## Reader Chrome

### Default state

Reader chrome remains hidden while reading. A stationary tap on a
non-interactive part of the text toggles it, preserving the current gesture
reliability rules.

When visible, the reader shows:

- One unframed back chevron in the upper-left corner.
- One compact menu button in the lower-right corner.
- No top hint pill.
- No page-number badge.
- No large action-panel container.
- No always-visible reading-goal ring.

Progress remains available in the Contents tool label and in existing reading
dashboards.

### Floating tools

Opening the menu reveals these individual tools:

1. Contents
2. Appearance
3. Reading mode
4. Ask AI
5. Reading goal

Each item has its own compact background for legibility, but there is no shared
panel behind them.

Items enter from the menu outward:

- 0, 35, 70, 105, and 140 ms delays.
- 160-190 ms item duration.
- Maximum 8 px translation.
- Total reveal completes within 330 ms.

Closing reverses the visual order, uses no stagger longer than 20 ms, and
finishes faster than opening. Tapping the reading body, turning a page,
scrolling, opening a tool, or hiding reader chrome closes the tool list.

### Reading-mode submenu

The Reading mode tool opens a small two-option segmented choice adjacent to the
tool:

- `滚动`
- `分页`

Changing mode preserves the current approximate reading position, closes the
submenu, and leaves the main tool list visible long enough to confirm the
selected state. The selected option is announced through normal button state
semantics, not color alone.

## Reading Mode Data

Introduce:

```ts
export type ReaderMode = "scroll" | "paged";
```

Add an optional field to `ReadingPosition`:

```ts
readingMode?: ReaderMode;
```

This does not require an IndexedDB schema migration because the
`readingPositions` store key remains `bookId` and Dexie stores object fields
without a declared column.

Compatibility rules:

- Missing `readingMode` means `scroll`.
- Existing books and reading positions continue to load unchanged.
- Existing version 1 backups remain valid.
- New backups naturally include the optional field because reading-position
  objects are already exported as structured data.
- Restoring an old backup defaults every book to scroll mode.
- API keys remain excluded from backups.

Every reading-position save includes the current mode so later progress writes
do not erase the per-book choice.

## TXT Reading

### Scroll mode

Keep the existing vertical reader behavior:

- Native momentum scrolling.
- Progress derived from `scrollTop`.
- Debounced position persistence.
- Existing typography and theme preferences.

### Paginated mode

Use a horizontally paged text surface based on CSS multi-column layout:

- The visible reader height defines the column height.
- Each column width equals the current content viewport width.
- A bounded column gap separates pages.
- Vertical overflow is disabled.
- Horizontal movement is controlled one viewport at a time.
- Paragraph `content-visibility` optimization is disabled only in paginated
  mode because deferred paragraph layout would make column count unstable.

The existing pointer gesture controller supplies direct horizontal feedback.
On release, it settles to the previous page, next page, or current page using
the existing swipe threshold helpers.

TXT paginated progress is derived from:

```ts
scrollLeft / (scrollWidth - clientWidth)
```

Page information is derived from the rounded horizontal offset and total
scrollable width. Changing font size, line height, content width, orientation,
or viewport size captures progress first, performs layout, and restores the
nearest page on the next animation frame.

Switching between scroll and paged mode maps through normalized progress rather
than raw pixels.

## EPUB Reading

### Scroll mode

Keep the existing epub.js configuration:

```ts
{
  flow: "scrolled",
  manager: "continuous",
  spread: "none",
  overflow: "auto"
}
```

### Paginated mode

Create the rendition with:

```ts
{
  flow: "paginated",
  manager: "default",
  spread: "none",
  overflow: "hidden"
}
```

`rendition.prev()` and `rendition.next()` remain the authoritative page-turn
operations. Horizontal swipe feedback uses the existing reader swipe system
and must not also toggle reader chrome.

Changing mode rebuilds only the epub.js rendition, not the book record or
reader session. Before rebuilding, retain the latest CFI locator in a ref.
Display that locator in the new rendition, then apply current appearance
preferences. If no in-memory locator exists, use the saved reading position.

The relocated event continues to save CFI and progress, now including the
current reading mode.

## Error And Edge Handling

- If EPUB paginated rendition creation fails, show the existing reader error
  state and retain the saved locator. Do not silently delete or rewrite data.
- If TXT has less than one full page, report page 1 of 1 and progress 0 until
  the reader reaches its natural end.
- Mode switching while text selection is active clears the temporary selection
  UI but never sends text to an AI provider.
- Opening a book with an unknown or malformed mode value defaults to scroll.
- Rapid mode changes invalidate stale EPUB rendition work so an older async
  initialization cannot replace the latest mode.
- Orientation and viewport changes restore normalized progress after layout.

## Accessibility

- Back and menu hit areas are at least 44 by 44 CSS pixels.
- Every floating tool has a Chinese accessible name.
- The mode selector exposes selected state using `aria-pressed`.
- Focus remains visible for keyboard and switch-control users.
- Reduced motion removes stagger and spatial movement but keeps state changes
  immediate and understandable.

## Testing

Automated tests cover:

- Main-tab ordering and before/active/after surface-state calculation.
- Shared indicator index calculation.
- Missing or invalid per-book reading mode defaults to scroll.
- Reading-position persistence preserves mode.
- TXT scroll and horizontal pagination progress conversions.
- TXT page count and current-page calculations.
- Mode changes preserve normalized progress.
- EPUB rendition options for scroll and paginated modes.
- Motion CSS has no `display: none` tab switching, mount-only `pageFade`, bounce,
  or persistent `will-change` on tab surfaces.
- Floating tool delays stay within the confirmed timing budget.
- Reduced-motion rules remove translation and staggering.

Manual iPhone acceptance:

1. Switch Library, Reading, and Settings repeatedly; no page flashes or
   one-direction-only fade should appear.
2. Confirm the bottom indicator follows all three tabs.
3. Open one TXT and one EPUB.
4. Confirm both default to scroll when no mode has been saved.
5. Open floating tools and verify the sequential reveal.
6. Confirm the back chevron has no persistent circular background.
7. Change each book to paginated mode, turn pages in both directions, close,
   reopen, and confirm mode and progress restore.
8. Return each book to scroll mode and confirm approximate progress is
   preserved.
9. Select text and confirm Ask AI still receives only selected text.
10. Enable Reduce Motion and confirm controls and tabs remain immediate without
    travel or stagger.

## Non-Goals

- No native iOS rewrite.
- No simulated page-curl effect.
- No spring, bounce, or elastic easing.
- No permanent `will-change` added to page surfaces.
- No full-book AI transmission.
- No backup-version break or IndexedDB reset.
