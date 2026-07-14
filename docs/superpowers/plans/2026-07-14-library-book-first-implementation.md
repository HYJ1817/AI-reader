# Library Book-First Implementation Plan

**Goal:** Reorder and rewrite Library metadata so books and reading state lead,
while all current shelf operations remain intact.

## Task 1: Lock the hierarchy in tests

- [ ] Extend `libraryPresentation.test.ts` for source fallback and relative
  recent-reading labels.
- [ ] Add a Library source/CSS contract requiring shelf-before-collections,
  semantic progress, no root `formatBookSize`, and compact progress type.
- [ ] Add Playwright evidence for unread and active books in grid/list modes.
- [ ] Run the focused tests and confirm the missing presentation API and markup
  fail for the intended reasons.

## Task 2: Implement book-first presentation

- [ ] Add deterministic source/recent-reading presentation helpers without
  changing `BookRecord` or persistence.
- [ ] Remove the standalone Collections row and move its handler/context into
  the shelf heading.
- [ ] Replace root format/size metadata with source, last-opened context, and
  semantic progress in list and grid modes.
- [ ] Keep empty, filtered, edit, selection, More, group, pagination, and Motion
  behavior unchanged.
- [ ] Inspect iPhone 14 and iPhone 15 Pro Max screenshots and fix only evidenced
  hierarchy or readability problems.

## Task 3: Verify, deploy, and close Phase 4

- [ ] Run focused and full Vitest, ESLint, webpack build, `git diff --check`, and
  the complete two-device Playwright suite.
- [ ] Run the Impeccable targeted scan on the changed Library source/CSS.
- [ ] Deploy with the established Windows OpenNext sequence.
- [ ] Verify production root/assets, Library states, actions, screenshots, and
  critical navigation.
- [ ] Update the roadmap and `HANDOFF.md`, commit, push, and confirm local/remote
  equality.
