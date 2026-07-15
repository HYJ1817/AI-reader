# EPUB Page Status Design

## Problem

The reader initializes every book with `{ current: 1, total: 1 }`. EPUB page
information only replaces that value after epub.js generates a whole-book CFI
location table. Slow or failed generation therefore presents `1/1页` as if it
were a real result. Generation failures are swallowed, and epub.js
`locations.total` is a zero-based last index rather than a count.

## Approved behavior

- TXT page information remains numeric and continues using rendered scroll or
  horizontal dimensions.
- A newly opened EPUB displays `正在计算页数…` until whole-book information is
  available.
- A successful epub.js location build displays the current generated location
  and uses `locations.total + 1` as the total count.
- A malformed EPUB whose location build fails displays `页数未知`; reading
  remains available.
- A publisher-provided EPUB page list remains authoritative.
- The table-of-contents header uses the same status-aware label and must not
  expose placeholder numbers.

## Design

Keep the existing numeric `ReaderPageInfo` shape for compatibility and add an
optional `status` field with `calculating` and `unavailable` values. The absence
of a status means the numeric values are ready. Formatting stays centralized in
`lib/readerPageInfo.ts`.

`useReaderBookState` sets `calculating` only for EPUB books. `EpubReader` marks
the result ready when a valid relocation is reported, awaits `reportLocation`
after generation, and emits `unavailable` only when generation fails before any
valid page information was produced.

## Verification

Tests must cover both status labels, the zero-based epub.js total conversion,
the EPUB initialization path, the generation failure path, and the existing TXT
page helpers. Run focused Vitest first, then the full test suite, ESLint, and the
webpack production build.

