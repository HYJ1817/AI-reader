# Library Book-First Design

## Goal

Make the Library root read like a shelf of books and reading states, not a file
manager, while preserving import, search, collections, grid/list switching,
selection, pagination, actions, focus restoration, and reader navigation.

## Evidence

The current root puts a full-width Collections row before the shelf. List rows
then prioritize `TXT · 1 KB`, while progress is oversized and last-opened context
is absent. The stored `BookRecord` has no author field, so presenting an author
would be invented data. It does have title, original file name, created time,
last-opened time, groups, and reading progress.

## Approved hierarchy

1. Keep `书库` and its Edit/Import actions.
2. When books exist, show search and the grid/list control as quiet utilities.
3. Put the shelf heading before book content. Its trailing action opens
   Collections and carries the active collection/count context, replacing the
   standalone Collections row.
4. For each book, prioritize cover, title, reading progress, and recent-reading
   time. Use the original file-name stem as a source only when it differs from
   the title; otherwise use the honest fallback `本地图书`.
5. Keep format and byte size in the existing book-details sheet, not the root.
6. In list mode, show one compact source/time line and one progress row with a
   track only after progress begins. In grid mode, keep one compact progress or
   recent-reading label below the title.
7. Keep groups as tertiary context and keep all existing More/edit/selection
   behavior.

## States

- Empty: import remains the only primary action; no empty Collections row.
- Unread: `未开始` and `尚未阅读`, without an empty progress track.
- Active: `已读 N%` plus the last-opened relative date.
- Finished: `已读完` plus the last-opened relative date.
- Filtered/no result: preserve the current no-match state and active collection
  semantics.

## Non-goals

- No author schema or EPUB metadata migration.
- No change to sorting, pagination, persistence, import, or navigation.
- No redesign of the book-details or book-actions sheets.
- No new cards, gradients, badges, or decorative chrome.

## Acceptance

- Root source contains no `formatBookSize` or format metadata.
- Collections remains directly accessible from the shelf heading.
- Grid/list, editing, selection, More actions, groups, filters, and pagination
  keep their handlers and behavior.
- Presentation helpers are deterministic and covered for source fallback,
  unread/active/finished progress, and recent-reading labels.
- Both iPhone projects and production evidence show the book-first hierarchy.
