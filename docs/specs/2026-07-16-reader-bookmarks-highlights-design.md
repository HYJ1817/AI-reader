# Reader Bookmarks and Highlights Design

Date: 2026-07-16
Status: Approved interaction direction

## Context

The reader contents sheet currently renders three tabs, but only the chapter tab is wired. The database already contains an `annotations` table and backup support for annotation records, while the reading surfaces already report selected text and save reading positions. The missing pieces are annotation type, precise selection locators, creation and deletion actions, persisted rendering, and navigation back to the saved location.

This feature must work for both EPUB and TXT books, remain local-first, survive reopening the app, and stay compatible with existing backups.

## Goals

- Turn the existing Bookmarks and Highlights tabs into real, useful views.
- Let the reader create or remove a bookmark for the current reading position.
- Let the reader highlight selected text in yellow, green, or blue.
- Persist bookmarks and highlights in IndexedDB and include them in backup export and restore.
- Render saved highlights again when a book is reopened.
- Navigate from a bookmark or highlight to the saved source location.
- Support EPUB and TXT in paged and scrolling modes.
- Preserve the current restrained, one-handed reader interface and reduced-motion behavior.

## Non-goals

- Notes attached to highlights or bookmarks.
- Cloud synchronization or sharing annotations.
- Searching across annotations from the library.
- Exporting highlights as a separate document.
- Arbitrary custom highlight colors.

The existing optional `note` field remains compatible but does not receive new UI in this release.

## Chosen Architecture

Bookmarks and highlights share the existing annotations table. This keeps cascade deletion, backup, restore, and per-book loading in one system. Separate database tables would duplicate these flows, while percentage-only locators would drift after font, viewport, or reader-mode changes.

### Annotation model

Extend `AnnotationRecord` with:

- `kind: "bookmark" | "highlight"`
- `locator: string`
- `text: string`
- `color?: "yellow" | "green" | "blue"`
- `progressPercent?: number`
- `pageNumber?: number`
- `createdAt: string`

`text` stores selected text for a highlight and a nearby text excerpt for a bookmark. `color` is required only for highlights. The current `note` field remains optional.

Existing annotation records without `kind` are interpreted as yellow highlights. Records without a usable locator remain visible in the list as unavailable and can be deleted, instead of being discarded silently. Backup validation accepts the new optional fields and remains compatible with older payloads.

IDs must be generated through a compatibility helper that uses `crypto.randomUUID()` only when it is a callable function and otherwise falls back to a secure-enough local identifier. Feature code must not directly call `crypto.randomUUID()` so older Android WebViews can create annotations.

### Locator strategy

EPUB uses the book's native CFI values:

- Bookmark: the current start CFI reported by the rendition.
- Highlight: the CFI range supplied by the EPUB selection event.

TXT uses a versioned serialized locator:

- Bookmark: the nearest visible paragraph index plus a progress fallback.
- Highlight: start paragraph and character offset, end paragraph and character offset, plus a progress fallback.

TXT paragraphs receive stable `data-paragraph-index` values. Navigation first attempts the paragraph and offset locator, then falls back to `progressPercent` if the DOM anchor cannot be resolved. This works across paged and scrolling reader modes.

## Interaction Design

### Opening the sheet

The existing contents action always opens the combined sheet, including for TXT books and EPUB books without a chapter table. In those cases the Chapters tab shows its teaching empty state while Bookmarks and Highlights remain available.

### Tabs

The segmented control becomes a real tablist:

- Chapters
- Bookmarks with count
- Highlights with count

The active tab uses the current selected pill treatment. Switching tabs crossfades the list and moves the selected state without moving the sheet or reader content. Reduced-motion mode changes state instantly.

### Creating bookmarks

The normal reader action menu gains a bookmark row. Its label reflects the current state:

- `添加书签`
- `移除本页书签`

The Bookmarks tab also exposes a compact `添加当前页书签` or `移除当前页书签` action above the list. Both entry points call the same toggle operation.

Adding a bookmark captures the current locator, progress, current page number when available, and a short nearby text excerpt. A successful toggle updates its label and the tab count immediately. Repeating the action at the same locator removes the bookmark instead of creating a duplicate.

### Creating highlights

Text selection produces a structured selection containing the selected text and precise locator. When a valid selection is active, the reader action surface exposes three 44-pixel color targets:

- Yellow, default
- Green
- Blue

Tapping a color creates the highlight immediately, clears the native selection, and renders the saved highlight in place. The last used color is remembered locally and receives a check indicator, but color is never communicated by color alone because every target has an accessible label.

Selecting the same locator again updates the existing highlight color rather than adding a duplicate.

### Bookmark list

Each row contains:

- Page number when captured, otherwise reading percentage.
- A one or two line nearby-text excerpt.
- Creation date or time.
- A trailing delete button with a specific accessible label.

Tapping the row closes the sheet and navigates to the locator. The delete button removes only the record and does not trigger navigation.

### Highlight list

Each row contains:

- A small circular color marker and color name for assistive technology.
- A two or three line selected-text excerpt.
- Page number or reading percentage and creation date.
- A trailing delete button with a specific accessible label.

Tapping the row closes the sheet, navigates to the selection, and leaves the persisted highlight visible in the text.

### Empty and unavailable states

Empty states teach the next action without decorative artwork:

- Chapters: `这本书没有目录信息`
- Bookmarks: `还没有书签，在阅读菜单中添加当前位置`
- Highlights: `还没有高亮，长按正文选择文字`

If a stored locator can no longer be resolved, the row remains visible and reports `无法定位原文`. The reader may delete it. Navigation failures must not crash or close the reader unexpectedly.

## Rendering

### EPUB

`EpubReader` accepts the current book's highlights and synchronizes them through `rendition.annotations.highlight`. Each color maps to a translucent fill that preserves text contrast in light, dark, and sepia themes. Removing or recoloring a highlight removes the old rendition annotation before applying the new one. EPUB.js render hooks reapply annotations to newly rendered spine sections.

The reader handle exposes methods to return the current CFI and navigate to an annotation CFI. The selection callback returns both selected text and its CFI range.

### TXT

The TXT renderer converts highlight ranges into non-overlapping marked text runs per paragraph. Multi-paragraph selections create runs in every affected paragraph. The underlying paragraph text remains unchanged so copy, AI context, and locator offsets stay stable.

Reader-mode and preference changes rerender marks from stored offsets. Bookmark and highlight navigation scrolls the appropriate paragraph into view vertically or horizontally, depending on the active mode.

## State and Data Flow

A focused reader-annotations state module loads annotations whenever the open book changes and exposes:

- bookmarks and highlights derived from the same record list
- add or toggle bookmark
- add or recolor highlight
- delete annotation
- navigate to annotation
- current operation status for accessible feedback

Writes update IndexedDB first and publish the new local state after success. Failures preserve the previous state and expose a concise reader-safe error message. Opening another book resets transient selection state and loads only that book's records.

The existing selected-text AI flow continues to receive the plain selected string. The new structured selection is stored alongside it, so adding locator support does not change AI request payloads.

## Accessibility and Motion

- Tabs use `role="tab"`, `aria-selected`, and associated tab panels.
- All interactive targets are at least 44 by 44 CSS pixels.
- Delete buttons identify whether they remove a bookmark or a highlight.
- Color controls have visible selected state and accessible color names.
- Addition, recoloring, deletion, and navigation status is announced through a polite live region.
- Motion communicates tab selection and row insertion or removal only.
- `prefers-reduced-motion` and the app's reduced-motion preference remove transforms and staggered transitions.

## Testing and Acceptance

### Unit tests

- Annotation CRUD, sorting, deletion, and backward-compatible defaults.
- Backup validation, export, and restore with both annotation kinds and colors.
- Android-compatible ID generation fallback.
- TXT locator serialization, selection extraction, range splitting, and progress fallback.
- EPUB selection payload and rendition annotation synchronization helpers.
- Duplicate bookmark toggle and highlight recoloring behavior.

### Component and integration tests

- All three tabs expose correct selected state and counts.
- Empty states and unavailable-locator states render correctly.
- Bookmark and highlight rows navigate on row press and delete independently.
- TXT books and EPUBs without a table of contents can still open the sheet.
- Reader controls expose bookmark toggle and three-color highlight actions at the correct times.
- Reduced-motion styling removes nonessential motion.

### End-to-end checks

For one EPUB and one TXT book:

1. Add a bookmark and confirm it appears in the Bookmarks tab.
2. Create yellow, green, and blue highlights.
3. Close and reopen the book and confirm highlights remain rendered.
4. Navigate from each list to the correct source location.
5. Recolor a highlight and verify no duplicate is created.
6. Delete a bookmark and highlight and confirm both the list and text update.
7. Export and restore a backup and confirm annotations survive.
8. Verify the flow on an Android-sized viewport without callable `crypto.randomUUID()`.

Completion requires targeted tests, the full Vitest suite, lint, production build, and mobile browser verification.
