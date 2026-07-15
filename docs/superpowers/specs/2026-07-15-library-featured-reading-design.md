# Library Featured Reading Design

**Status:** Approved visually on 2026-07-15. Written specification pending user review.

**Scope:** A focused redesign of the populated Library root. The completed UI quality roadmap remains closed.

## Problem

The current Library root gives every visible book similar visual weight. This is efficient for browsing, but it does not immediately answer the most common return question: which book was I reading, and how do I continue?

The redesign should add one clear reading focus without turning the Library into a dashboard, reducing shelf density, or changing the behavior of search, collections, import, editing, selection, grid/list switching, incremental rendering, and book actions.

## Goals

- Promote the most recently opened book into one clear continuation target at the top of the populated Library root.
- Combine its cover, title, semantic progress, recent-reading context, and continuation affordance in one native button.
- Keep the remaining books in the existing grid or list presentation below the feature.
- Create editorial hierarchy through scale, spacing, and cover-to-type proportion while preserving the current system font and product vocabulary.
- Borrow only restrained state motion from the React Bits references, implemented with the existing `motion/react` runtime.
- Preserve light, dark, sepia, custom ambient, reduced-motion, focus, safe-area, and shared-cover behavior.

## Non-goals

- Adding recommendations, online metadata, author lookup, ratings, quotes, categories, or generated summaries.
- Turning the Library into a reading-statistics dashboard or duplicating the Reading root.
- Adding GSAP, `mathjs`, React Bits packages, remote images, new fonts, or another animation runtime.
- Changing the empty Library experience, book import, collections, search semantics, editing, selection, pagination, root navigation, or reader behavior.
- Reopening UI quality roadmap Phases 1 through 6.

## Considered Approaches

### A. Featured reading spread plus the existing shelf, chosen

Show one recently opened book as a horizontal, theme-aware feature above the shelf. The cover supplies visual identity; title, reading context, and progress form a compact editorial hierarchy. The remaining books retain the current grid/list system. This creates a noticeable improvement while keeping familiar product behavior.

### B. Full-height immersive cover

Let the active cover dominate most of the first viewport and move the shelf below it. This has the strongest atmosphere, but it slows library browsing, depends too heavily on cover quality, and raises theme and contrast risk.

### C. Magazine index

Use numbered rows, serif-led typography, and thin rules to make the Library resemble an editorial index. This is distinctive, but it moves furthest from the quiet iOS utility personality and invents a new component vocabulary for a standard book-browsing task.

## Chosen Experience

### Eligibility and content states

The featured reading spread appears only when all of these are true:

- at least one book has a valid `lastOpenedAt` value;
- the user is on the unfiltered all-books Library root;
- the search query is empty;
- Library editing mode is off.

The most recently opened eligible book is selected deterministically by `lastOpenedAt`. A newly imported but never opened book is not labelled as recent reading and does not create the feature. When no eligible book exists, the current shelf begins immediately after the search and view controls.

Search results, collection filters, and editing mode hide the feature so every visible item belongs to the active result or selection set. Empty, loading, import-error, and no-result states remain unchanged.

### Featured reading spread

The spread is one native button with a stable origin ID and the same open-book action used by grid and list items. It contains:

- the existing local cover or the current deterministic cover fallback;
- the stored book title;
- semantic recent-reading text from existing presentation data;
- progress only when progress is positive;
- an explicit `继续阅读` label and a trailing chevron.

The app does not currently store author metadata, so the spread must not invent or infer an author. If secondary identity text is needed, it uses the existing source fallback rules.

The spread uses a restrained secondary surface derived from the active theme. It does not use a decorative wide shadow, remote artwork, gradient text, or a permanently dark card. Editorial character comes from the larger cover, stronger title scale, asymmetric cover-to-copy proportion, and more deliberate vertical rhythm.

The entire spread is tappable, has a visible focus state, and exposes a concise accessible name that includes the book title and continuation action. It must not contain nested buttons.

### Remaining shelf

When the feature is visible, the featured book is omitted from the shelf below so it is not duplicated. The shelf heading changes to `其他书籍`; the existing collections action and count context remain available. Grid/list mode, load-more behavior, book actions, progress labels, selection semantics, and shared-cover origins remain unchanged for all remaining books.

When the feature is hidden, the shelf uses the current heading and contains the complete filtered set. Counts, incremental rendering, and select-all logic must be calculated from the exact dataset shown in that state.

### Motion

No orchestrated page-load sequence is added. Motion communicates only a featured-book state change:

- feature insertion or replacement: opacity plus at most 8px vertical travel;
- duration: 180 to 220ms using the existing exponential-style state transition;
- shelf reflow: existing layout motion only;
- book opening: existing shared-cover transition and navigation protocol.

Reduced-motion mode removes spatial travel and uses the existing reduced duration or an immediate state change. Book text is never split into words or characters, and blur is not used on book content.

## Architecture and Files

### `lib/libraryShelves.ts`

Add or refine a pure selector that chooses the most recently opened book without treating a newly imported book as recently read. Keep date parsing deterministic and cover invalid dates with tests.

### `lib/libraryHomePresentation.ts` or the nearest existing presentation module

Build a pure presentation result containing the optional featured book, the exact shelf dataset, the shelf heading state, and whether the feature should render. Inputs include books, search/filter state, and editing state. This prevents render counts and selection logic from diverging from the visible dataset.

### `app/page.tsx`

Use the presentation result as the source for incremental shelf rendering and pass the optional featured book to `LibrarySurface`. Preserve existing handlers and navigation state.

### `app/LibrarySurface.tsx`

Render the featured spread above the shelf when provided. Reuse `MotionBookCover`, `buildLibraryBookPresentation`, `pressBook`, the shared Motion runtime, and existing accessibility patterns. Keep search, view switching, editing, empty states, grid/list rendering, and book action paths intact.

### `app/page.module.css`

Add theme-aware layout and typography for the feature using existing visual tokens. Keep the current focus treatment, minimum 44px interaction target, compact product type scale, and reduced-motion rules. The layout must fit the configured iPhone 14 and iPhone 15 Pro Max viewports without horizontal overflow.

## Error and Edge Cases

- Invalid or missing `lastOpenedAt` values do not produce a featured-reading claim.
- Missing covers use the existing fallback and retain legible contrast.
- Zero progress may still represent an opened book; the spread shows continuation context without a misleading zero-percent progress track.
- A single opened book appears only in the feature, and the shelf may be absent if no other books remain.
- Entering search, a collection, or editing mode removes the feature and restores the complete relevant dataset without losing scroll, focus, or selection state.
- Returning from the reader may update `lastOpenedAt`; feature replacement must not steal focus or replay a page-load choreography.
- Light, dark, sepia, system-dark, and custom ambient themes retain readable text and a clear focus indicator.

## Test Strategy

1. Add pure selector and presentation tests first, and verify they fail before implementation.
2. Cover eligible recent books, newly imported unread books, invalid dates, single-book libraries, search, collection filters, editing, and exact shelf exclusion/count behavior.
3. Extend Library integration contracts for the single native feature button, accessible continuation label, existing open handler, stable origin, no duplication, and unchanged grid/list actions.
4. Extend motion contracts for the bounded opacity/vertical transition and reduced-motion behavior.
5. Run focused Library tests, the full Vitest suite, configured ESLint, webpack production build, and `git diff --check`.
6. Run local Playwright on iPhone 14 and iPhone 15 Pro Max for default, featured, search, collection, editing, grid, list, reduced-motion, and return-from-reader states.
7. Inspect light and dark screenshots for hierarchy, cover scaling, type truncation, focus, safe areas, and shelf density.
8. Deploy through the documented Windows OpenNext standalone sequence, verify production assets, rerun focused production Library coverage, and update `HANDOFF.md` with the implementation commit and Worker version.

## Completion Criteria

- A returning reader can identify and continue the most recently opened book from the first Library viewport.
- The feature appears only when its recent-reading claim is truthful and contextually useful.
- The featured book is not duplicated in the shelf, and displayed counts and selection operate on the exact visible dataset.
- Search, collections, import, editing, selection, grid/list, book actions, incremental rendering, shared-cover navigation, and empty states retain their current behavior.
- Motion remains state-driven, restrained, and reduced-motion safe without new dependencies.
- Both configured iPhone viewports pass automated coverage and screenshot review before deployment.
