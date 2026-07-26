# EPUB Page and Location Semantics Design

**Date:** 2026-07-26

## Problem

The reader currently generates an epub.js CFI location table with a fixed
360-character interval when an EPUB does not provide a publisher `page-list`.
Those stable reading locations are then formatted, announced, and persisted as
pages. The resulting total is not rendered pagination and cannot match Apple
Books reliably because reflowable layout changes with viewport, typography,
spacing, images, and reader-specific layout rules.

## Decision

Represent the semantic unit in `ReaderPageInfo`:

- `page` means a publisher-provided EPUB page boundary or an actual TXT
  rendered page.
- `location` means a generated whole-book CFI location used only when a valid
  EPUB `page-list` is unavailable.

The default remains `page` so existing TXT callers and page-list callers stay
compatible. Generated EPUB locations are labelled as reading positions rather
than pages.

## User Experience

- A valid EPUB `page-list` continues to display `135/480页` and
  `第 135 页（共 480 页）`.
- A generated EPUB location displays `位置 288/901` in the compact control and
  `位置 288（共 901 个）` in the contents sheet.
- The initial EPUB state says `正在计算阅读位置…`, covering the asynchronous
  lookup without claiming a page total.
- If neither a publisher page nor generated location can be resolved, the UI
  says `阅读位置未知`.
- TXT pagination and all existing TXT labels remain unchanged.

## Data Flow

`getEpubBookPageInfo()` first validates the publisher `page-list`. A valid
published page produces `unit: "page"`. Otherwise, a valid generated CFI index
produces `unit: "location"`.

`normalizeReaderPageInfo()` preserves the unit while clamping the numeric
values. The shared label and summary formatters select page or location text
from that unit, so the reading controls and contents sheet cannot diverge.

`EpubReader` publishes every resolved value immediately. It copies the current
number into annotation snapshots only when the unit is `page`; generated
location indexes continue to use the existing CFI locator and progress fields
and are not persisted as `pageNumber`. Existing annotation records remain
readable and no database or backup migration is required.

## Alternatives Considered

1. Estimate characters per screen from current layout. This might look closer
   for plain text but remains wrong for images, headings, CSS, and font fallback,
   and changes whenever reader settings change.
2. Pre-render every spine item offscreen and count app-specific screens. This
   adds startup work, memory pressure, and repeated repagination on layout
   changes, while still not matching Apple Books exactly.
3. Hide the metric entirely when `page-list` is absent. This is semantically
   safe but discards a useful stable whole-book navigation cue.

The selected page/location distinction is accurate, inexpensive, and keeps the
useful whole-book location index.

## Verification

- Unit tests distinguish publisher pages from generated locations and verify
  both compact and summary labels.
- Integration coverage verifies the EPUB calculation lifecycle and ensures
  generated locations do not become annotation page numbers.
- Browser coverage imports a long EPUB without a `page-list`, waits for a
  whole-book `位置` total greater than one, and confirms the placeholder never
  becomes a false `1/1页` result.
- Run the focused tests first, then the complete Vitest, ESLint, and production
  build checks before publication.
