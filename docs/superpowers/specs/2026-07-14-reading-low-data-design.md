# Reading Low-Data Experience Design

**Status:** Approved for inline execution on 2026-07-14 under the user's standing authorization to continue without confirmation pauses.

## Goal

Make the Reading destination useful from the first launch onward by placing the next reading action first and revealing goals and history only when they carry information.

## Destination Decision

Keep the destination label `阅读` and keep it as a persistent root page.

- Renaming it to `进度` would describe only the statistics and understate its primary purpose.
- Opening the latest book directly from the tab would make root navigation unpredictable and remove access to goals and history.
- A state-aware `阅读` root preserves navigation expectations while making start or continue the dominant action.

## State Model

Create one pure presentation function with four deterministic states:

1. `empty-library`: no book exists. Show a short import explanation and one `导入图书` primary action. Hide the goal and seven-day chart.
2. `imported-unread`: a book exists, progress is zero, and recorded reading minutes are zero. Show `开始阅读`, the book cover/title, and `未开始`; show the compact goal row; hide the chart.
3. `active-reading`: a book has progress but there are no recorded minutes in the seven-day data. Show `继续阅读`, progress, and the compact goal row; hide the empty chart.
4. `populated-week`: recorded minutes are greater than zero. Show continue/start as appropriate, the compact goal row, and the seven-day chart.

The data remains derived from existing books, reading positions, daily statistics, and goal storage. No migration or new persistence is introduced.

## Information Hierarchy

- Keep the 34px root title `阅读`.
- Put the primary reading/import section immediately after the title.
- For a book, show cover, title, semantic progress, and chevron. Remove file type and byte size from this surface.
- Place the goal after the primary section as a 72px-or-smaller row with a 52px ring. It remains a button that opens the existing goal sheet.
- Render the seven-day section only when total minutes are positive. Keep its existing bars and change animations.
- Use hairlines and open spacing rather than adding cards, gradients, or decorative containers.

## Interaction and Accessibility

- Import, book opening, and goal editing keep their existing handlers.
- Add stable data attributes for the dashboard state, primary action, goal row, and week chart.
- Give the book action an explicit `开始阅读：书名` or `继续阅读：书名` accessible label.
- Keep all interactive targets at least 44px and preserve reduced-motion behavior.

## Verification

- Pure unit tests cover all four states and visibility rules.
- Source/CSS integration tests lock section order, semantic progress, compact goal geometry, and absence of file metadata.
- Playwright seeds IndexedDB to capture empty, imported-unread, active-reading, and populated-week states on both iPhone projects.
- Existing navigation, typography, reader presentation, and goal-sheet coverage must remain green before production deployment.

## Non-goals

- No changes to the library hierarchy, book selection algorithm, reading-minute calculation, goal persistence, or chart math.
- No automatic book opening from the tab.
- No streaks, badges, recommendations, gamification, or new statistics.
- No EPUB ambient changes.

