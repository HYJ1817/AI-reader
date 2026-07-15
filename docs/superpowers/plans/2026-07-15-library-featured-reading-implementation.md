# Library Featured Reading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one truthful, theme-aware recent-reading focus to the populated Library root while preserving the exact behavior of the remaining shelf.

**Architecture:** A pure recent-reading selector and pure Library-home presentation builder determine the optional feature and exact shelf dataset. `page.tsx` uses that result for incremental rendering and counts, while `LibrarySurface.tsx` renders one native continuation button with the existing cover, presentation, navigation, and Motion primitives.

**Tech Stack:** TypeScript, React 19, Next.js 16 App Router, Motion for React, CSS Modules, Vitest, Playwright, IndexedDB/Dexie, OpenNext for Cloudflare Workers.

---

## File Map

- Modify `lib/libraryShelves.ts`: add a strict selector for books with a valid `lastOpenedAt`.
- Modify `lib/libraryShelves.test.ts`: lock strict recency and invalid-date behavior.
- Create `lib/libraryHomePresentation.ts`: decide feature eligibility and return the exact shelf dataset.
- Create `lib/libraryHomePresentation.test.ts`: cover root, search, collection, editing, unread, single-book, and exclusion states.
- Modify `app/page.tsx`: derive incremental rendering and visible counts from the home presentation.
- Create `lib/libraryHomeComposition.test.ts`: lock parent composition and prevent count/dataset drift.
- Modify `app/LibrarySurface.tsx`: render the feature, accessible continuation action, and non-duplicated shelf.
- Modify `app/page.module.css`: add theme-aware feature geometry, hierarchy, focus, press, and reduced-motion treatment.
- Modify `lib/uiText.ts`: add the centralized `OTHER_BOOKS` shelf label.
- Create `lib/libraryFeaturedReadingIntegration.test.ts`: lock markup, accessibility, Motion, and CSS contracts.
- Modify `e2e/library-book-first.spec.ts`: exercise unread, featured, search, editing, reader return, grid/list, and screenshot states.
- Modify `HANDOFF.md`: record final commits, verification, production assets, and Worker version.

### Task 1: Select only truthfully recent books

**Files:**
- Modify: `lib/libraryShelves.ts`
- Modify: `lib/libraryShelves.test.ts`

- [ ] **Step 1: Write failing strict-recency tests**

Add the import and cases below to `lib/libraryShelves.test.ts`:

```ts
import {
  selectFeaturedLibraryBook,
  selectRecentlyOpenedLibraryBook,
  selectRecentShelfBooks,
  type LibraryShelfBook,
} from "./libraryShelves";

it("selects only the most recently opened book for Library continuation", () => {
  const imported = makeBook({
    id: "imported",
    createdAt: "2026-07-15T10:00:00.000Z",
  });
  const opened = makeBook({
    id: "opened",
    createdAt: "2026-07-14T10:00:00.000Z",
    lastOpenedAt: "2026-07-15T09:00:00.000Z",
  });

  expect(selectRecentlyOpenedLibraryBook([imported, opened])?.id).toBe("opened");
});

it("does not claim an unread or invalidly dated book was recently opened", () => {
  expect(
    selectRecentlyOpenedLibraryBook([
      makeBook({ id: "unread", lastOpenedAt: undefined }),
      makeBook({ id: "invalid", lastOpenedAt: "not-a-date" }),
    ])
  ).toBeNull();
});
```

- [ ] **Step 2: Run the selector tests and verify RED**

Run:

```powershell
npm.cmd test -- lib/libraryShelves.test.ts
```

Expected: FAIL because `selectRecentlyOpenedLibraryBook` is not exported.

- [ ] **Step 3: Implement the strict selector**

Add to `lib/libraryShelves.ts` without changing `selectFeaturedLibraryBook`, which the Reading root still uses for imported-unread state:

```ts
export function selectRecentlyOpenedLibraryBook<T extends LibraryShelfBook>(
  books: T[]
): T | null {
  return [...books]
    .filter((book) => timestamp(book.lastOpenedAt) > 0)
    .sort(
      (a, b) => timestamp(b.lastOpenedAt) - timestamp(a.lastOpenedAt)
    )[0] ?? null;
}
```

- [ ] **Step 4: Run the selector tests and verify GREEN**

Run:

```powershell
npm.cmd test -- lib/libraryShelves.test.ts
```

Expected: all `libraryShelves` tests pass, including the existing created-date fallback for the Reading root.

- [ ] **Step 5: Commit the selector**

```powershell
git add -- lib/libraryShelves.ts lib/libraryShelves.test.ts
git commit -m "feat: select recent library reading"
```

### Task 2: Build the exact feature and shelf presentation

**Files:**
- Create: `lib/libraryHomePresentation.ts`
- Create: `lib/libraryHomePresentation.test.ts`

- [ ] **Step 1: Write the failing presentation tests**

Create `lib/libraryHomePresentation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildLibraryHomePresentation } from "./libraryHomePresentation";

type Book = {
  id: string;
  createdAt: string;
  lastOpenedAt?: string;
};

function book(id: string, lastOpenedAt?: string): Book {
  return {
    id,
    createdAt: "2026-07-15T08:00:00.000Z",
    lastOpenedAt,
  };
}

const opened = book("opened", "2026-07-15T10:00:00.000Z");
const other = book("other");

describe("Library home presentation", () => {
  it("features a recently opened root book and removes it from the shelf", () => {
    expect(
      buildLibraryHomePresentation({
        books: [opened, other],
        filteredBooks: [opened, other],
        searchQuery: "",
        groupFilter: null,
        editing: false,
      })
    ).toEqual({
      featuredBook: opened,
      shelfBooks: [other],
      featuredLayout: true,
    });
  });

  it("keeps the full shelf when no book was opened", () => {
    expect(
      buildLibraryHomePresentation({
        books: [other],
        filteredBooks: [other],
        searchQuery: "",
        groupFilter: null,
        editing: false,
      })
    ).toEqual({
      featuredBook: null,
      shelfBooks: [other],
      featuredLayout: false,
    });
  });

  it.each([
    { searchQuery: "other", groupFilter: null, editing: false },
    { searchQuery: "   other   ", groupFilter: null, editing: false },
    { searchQuery: "", groupFilter: "group-a", editing: false },
    { searchQuery: "", groupFilter: null, editing: true },
  ])("shows the complete active dataset outside the neutral root: %o", (state) => {
    expect(
      buildLibraryHomePresentation({
        books: [opened, other],
        filteredBooks: [opened],
        ...state,
      })
    ).toEqual({
      featuredBook: null,
      shelfBooks: [opened],
      featuredLayout: false,
    });
  });

  it("allows a single opened book to live only in the feature", () => {
    expect(
      buildLibraryHomePresentation({
        books: [opened],
        filteredBooks: [opened],
        searchQuery: "",
        groupFilter: null,
        editing: false,
      }).shelfBooks
    ).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the presentation tests and verify RED**

Run:

```powershell
npm.cmd test -- lib/libraryHomePresentation.test.ts
```

Expected: FAIL because `libraryHomePresentation.ts` does not exist.

- [ ] **Step 3: Implement the pure presentation builder**

Create `lib/libraryHomePresentation.ts`:

```ts
import {
  selectRecentlyOpenedLibraryBook,
  type LibraryShelfBook,
} from "./libraryShelves";

export type LibraryHomePresentationInput<T extends LibraryShelfBook> = {
  books: T[];
  filteredBooks: T[];
  searchQuery: string;
  groupFilter: string | null;
  editing: boolean;
};

export type LibraryHomePresentation<T extends LibraryShelfBook> = {
  featuredBook: T | null;
  shelfBooks: T[];
  featuredLayout: boolean;
};

export function buildLibraryHomePresentation<T extends LibraryShelfBook>({
  books,
  filteredBooks,
  searchQuery,
  groupFilter,
  editing,
}: LibraryHomePresentationInput<T>): LibraryHomePresentation<T> {
  const canFeature =
    !editing && searchQuery.trim() === "" && groupFilter === null;
  const featuredBook = canFeature
    ? selectRecentlyOpenedLibraryBook(books)
    : null;

  return {
    featuredBook,
    shelfBooks: featuredBook
      ? filteredBooks.filter((book) => book.id !== featuredBook.id)
      : filteredBooks,
    featuredLayout: featuredBook !== null,
  };
}
```

- [ ] **Step 4: Run the presentation and selector tests**

Run:

```powershell
npm.cmd test -- lib/libraryHomePresentation.test.ts lib/libraryShelves.test.ts
```

Expected: both files pass.

- [ ] **Step 5: Commit the presentation model**

```powershell
git add -- lib/libraryHomePresentation.ts lib/libraryHomePresentation.test.ts
git commit -m "feat: model featured library shelf"
```

### Task 3: Compose and render the accessible featured-reading spread

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/LibrarySurface.tsx`
- Modify: `app/page.module.css`
- Modify: `lib/uiText.ts`
- Create: `lib/libraryHomeComposition.test.ts`
- Create: `lib/libraryFeaturedReadingIntegration.test.ts`

- [ ] **Step 1: Write a failing parent-composition contract**

Create `lib/libraryHomeComposition.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8"
);

describe("Library home composition", () => {
  it("derives render windows and counts from one presentation result", () => {
    expect(source).toContain("buildLibraryHomePresentation");
    expect(source).toContain("libraryHomePresentation.shelfBooks");
    expect(source).toContain("libraryHomePresentation.featuredBook?.id");
    expect(source).toContain(
      "filteredBookCount: libraryShelfBooks.length"
    );
    expect(source).toContain(
      "featuredBook: libraryHomePresentation.featuredBook"
    );
    expect(source).not.toContain(
      "const visibleBooks = filteredBooks.slice(0, visibleBookCount)"
    );
  });
});
```

- [ ] **Step 2: Run the composition test and verify RED**

Run:

```powershell
npm.cmd test -- lib/libraryHomeComposition.test.ts
```

Expected: FAIL because `page.tsx` does not use the new presentation builder.

- [ ] **Step 3: Integrate the presentation into `page.tsx`**

Import the builder:

```ts
import { buildLibraryHomePresentation } from "@/lib/libraryHomePresentation";
```

Replace the current render-window derivation with:

```ts
const filteredBooks = filterBooksByQuery(
  groupFilteredBooks,
  librarySearchQuery
);
const libraryHomePresentation = buildLibraryHomePresentation({
  books,
  filteredBooks,
  searchQuery: librarySearchQuery,
  groupFilter,
  editing: libraryEditing,
});
const libraryShelfBooks = libraryHomePresentation.shelfBooks;
const libraryRenderKey = `${groupFilter ?? "__all"}\u0000${librarySearchQuery}\u0000${libraryView}\u0000${libraryHomePresentation.featuredBook?.id ?? "__none"}`;
const visibleBookCount = Math.min(
  libraryShelfBooks.length,
  libraryRenderWindow.key === libraryRenderKey
    ? libraryRenderWindow.count
    : getInitialVisibleItemCount(
        libraryShelfBooks.length,
        LIBRARY_RENDER_BATCH
      )
);
const visibleBooks = libraryShelfBooks.slice(0, visibleBookCount);
```

Use the visible shelf dataset for selection counts; editing mode always disables the feature, so this remains behaviorally equal to the complete filtered dataset:

```ts
const selectedVisibleCount = libraryShelfBooks.filter((book) =>
  selectedBookIds.includes(book.id)
).length;
const allVisibleSelected =
  libraryShelfBooks.length > 0 &&
  selectedVisibleCount === libraryShelfBooks.length;
```

Pass the exact feature/shelf values to `LibrarySurface`:

```ts
data={{
  books,
  visibleBooks,
  filteredBookCount: libraryShelfBooks.length,
  featuredBook: libraryHomePresentation.featuredBook,
  featuredLayout: libraryHomePresentation.featuredLayout,
  groups,
  progressMap: readingProgressMap,
  loading,
  importError,
}}
```

Update the load-more effect to use the same shelf dataset:

```ts
useEffect(() => {
  if (
    activeTab !== "library" ||
    visibleBookCount >= libraryShelfBooks.length
  ) {
    return;
  }
  const target = libraryLoadSentinelRef.current;
  if (!target) return;
  const Observer = (
    window as Window & {
      IntersectionObserver?: typeof IntersectionObserver;
    }
  ).IntersectionObserver;
  if (!Observer) {
    const frame = window.requestAnimationFrame(() => {
      setLibraryRenderWindow({
        key: libraryRenderKey,
        count: libraryShelfBooks.length,
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }
  const observer = new Observer(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setLibraryRenderWindow({
        key: libraryRenderKey,
        count: getNextVisibleItemCount(
          visibleBookCount,
          libraryShelfBooks.length,
          LIBRARY_RENDER_BATCH
        ),
      });
    },
    { rootMargin: "480px 0px" }
  );
  observer.observe(target);
  return () => observer.disconnect();
}, [
  activeTab,
  libraryRenderKey,
  libraryShelfBooks.length,
  visibleBookCount,
]);
```

- [ ] **Step 4: Run the composition and presentation tests**

Run:

```powershell
npm.cmd test -- lib/libraryHomeComposition.test.ts lib/libraryHomePresentation.test.ts lib/incrementalList.test.ts lib/librarySelection.test.ts
```

Expected: all focused data-window and selection tests pass.

Continue directly into the surface steps below before committing. The parent must not exclude the featured book until `LibrarySurface` can render it.

#### Surface implementation

- [ ] **Step 1: Write the failing markup and CSS contract**

Create `lib/libraryFeaturedReadingIntegration.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../app/LibrarySurface.tsx", import.meta.url),
  "utf8"
);
const css = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  expect(match, `Missing CSS rule for ${selector}`).not.toBeNull();
  return match?.[1] ?? "";
}

describe("featured Library reading", () => {
  it("uses one native continuation target and the shared cover origin", () => {
    expect(source).toContain('data-library-featured="true"');
    expect(source).toContain('type="button"');
    expect(source).toContain('`library-featured-${featuredBook.id}`');
    expect(source).toContain("UI_TEXT.CONTINUE_READING");
    expect(source).toContain("<MotionBookCover");
    expect(source).toContain("actions.pressBook(featuredBook, featuredOriginId)");
    expect(source).not.toContain("ReactBits");
    expect(source).not.toContain("gsap");
  });

  it("bounds state motion and keeps a reduced-motion branch", () => {
    expect(source).toContain("<AnimatePresence initial={false}");
    expect(source).toContain("{ opacity: 0, y: 8 }");
    expect(source).toContain("duration: MOTION_DURATION.state");
    expect(source).toContain("duration: MOTION_DURATION.reduced");
  });

  it("uses theme tokens, readable geometry, and visible focus", () => {
    const feature = rule(".libraryFeaturedButton");
    const cover = rule(".libraryFeaturedButton .motionBookCover");
    expect(feature).toContain("background: color-mix");
    expect(feature).toContain("min-height: 44px");
    expect(cover).toContain("width: 104px");
    expect(css).toContain(".libraryFeaturedButton:focus-visible");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
```

- [ ] **Step 2: Run the integration contract and verify RED**

Run:

```powershell
npm.cmd test -- lib/libraryFeaturedReadingIntegration.test.ts
```

Expected: FAIL because the feature markup and CSS do not exist.

- [ ] **Step 3: Extend `LibrarySurface` data and render the feature**

Add to `LibrarySurfaceProps["data"]`:

```ts
featuredBook: BookRecord | null;
featuredLayout: boolean;
```

Add `featuredBook` and `featuredLayout` to the existing `data` destructuring. Before the existing shelf header, derive:

```ts
const featuredOriginId = featuredBook
  ? `library-featured-${featuredBook.id}`
  : "";
const featuredProgress = featuredBook
  ? getBookProgressPercent(progressMap, featuredBook.id)
  : 0;
const featuredPresentation = featuredBook
  ? buildLibraryBookPresentation(featuredBook, featuredProgress)
  : null;
```

Render this block after the search row and before the existing `bookList`:

```tsx
<AnimatePresence initial={false} mode="popLayout">
  {featuredBook && featuredPresentation && (
    <m.section
      key={featuredBook.id}
      className={styles.libraryFeatured}
      data-library-featured="true"
      initial={
        reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }
      }
      animate={{ opacity: 1, y: 0 }}
      exit={
        reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }
      }
      transition={{
        duration: reduceMotion
          ? MOTION_DURATION.reduced
          : MOTION_DURATION.state,
      }}
    >
      <button
        type="button"
        className={styles.libraryFeaturedButton}
        aria-label={`${UI_TEXT.CONTINUE_READING}：${featuredBook.title}`}
        onClick={() =>
          actions.pressBook(featuredBook, featuredOriginId)
        }
      >
        <MotionBookCover
          book={featuredBook}
          originId={featuredOriginId}
        />
        <span className={styles.libraryFeaturedCopy}>
          <span className={styles.libraryFeaturedContext}>
            {featuredPresentation.lastReadLabel}
          </span>
          <span className={styles.libraryFeaturedTitle}>
            {featuredBook.title}
          </span>
          <span className={styles.libraryFeaturedSource}>
            {featuredPresentation.sourceLabel}
          </span>
          {featuredPresentation.showProgress && (
            <span className={styles.libraryFeaturedProgress}>
              <span aria-hidden="true">
                <span
                  style={{
                    width: `${featuredPresentation.progressPercent}%`,
                  }}
                />
              </span>
              <small>{featuredPresentation.progressLabel}</small>
            </span>
          )}
          <span className={styles.libraryFeaturedContinue}>
            {UI_TEXT.CONTINUE_READING}
            <span aria-hidden="true">{"\u203a"}</span>
          </span>
        </span>
      </button>
    </m.section>
  )}
</AnimatePresence>
```

Add this entry to `UI_TEXT` in `lib/uiText.ts`:

```ts
OTHER_BOOKS: "其他书籍",
```

Use `featuredLayout ? UI_TEXT.OTHER_BOOKS : UI_TEXT.RECENT_BOOKS` for the shelf heading. Keep the collections action visible even when the feature is the only book. When `featuredLayout` is true and `filteredBookCount` is zero, omit the no-results empty state and book grid/list, but retain the header and collections action.

- [ ] **Step 4: Add the theme-aware CSS**

Add to the Library section of `app/page.module.css`:

```css
.libraryFeatured {
  margin: 16px 0 8px;
}

.libraryFeaturedButton {
  width: 100%;
  min-height: 44px;
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr);
  align-items: end;
  gap: 16px;
  padding: 14px;
  border-radius: 16px;
  background: color-mix(
    in srgb,
    var(--text-primary) 7%,
    var(--surface-primary)
  );
  color: var(--text-primary);
  text-align: left;
  transform: translate3d(0, 0, 0) scale(1);
  transition:
    background var(--motion-fast) var(--ease-standard),
    transform var(--motion-fast) var(--ease-standard);
}

.libraryFeaturedButton:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: 2px;
}

.libraryFeaturedButton:not(:disabled):active {
  transform: translate3d(0, 1px, 0) scale(0.99);
}

.libraryFeaturedButton .motionBookCover {
  width: 104px;
  height: auto;
  aspect-ratio: 0.7;
  border-radius: 7px;
}

.libraryFeaturedButton .motionBookCover > .bookCover {
  width: 100%;
  height: 100%;
}

.libraryFeaturedCopy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 2px 0;
}

.libraryFeaturedContext,
.libraryFeaturedSource {
  overflow: hidden;
  color: var(--text-secondary);
  font-size: var(--type-caption);
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.libraryFeaturedTitle {
  display: -webkit-box;
  margin: 7px 0 5px;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.02em;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.libraryFeaturedProgress {
  display: grid;
  grid-template-columns: minmax(44px, 1fr) auto;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  color: var(--text-secondary);
}

.libraryFeaturedProgress > span {
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(
    in srgb,
    var(--text-secondary) 16%,
    transparent
  );
}

.libraryFeaturedProgress > span > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--tint);
}

.libraryFeaturedProgress small {
  font-size: var(--type-caption);
  font-weight: 650;
}

.libraryFeaturedContinue {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  color: var(--tint);
  font-size: var(--type-footnote);
  font-weight: 700;
}

@media (prefers-reduced-motion: reduce) {
  .libraryFeaturedButton,
  .libraryFeaturedButton:not(:disabled):active {
    transition: none;
    transform: none;
  }
}
```

- [ ] **Step 5: Run feature, Library, Motion, and accessibility contracts**

Run:

```powershell
npm.cmd test -- lib/libraryFeaturedReadingIntegration.test.ts lib/libraryBookFirst.test.ts lib/libraryMotionIntegration.test.ts lib/accessibilitySemantics.test.ts lib/sharedBookTransition.test.ts
```

Expected: all focused contracts pass.

- [ ] **Step 6: Commit the complete composed feature**

```powershell
git add -- app/page.tsx app/LibrarySurface.tsx app/page.module.css lib/uiText.ts lib/libraryHomeComposition.test.ts lib/libraryFeaturedReadingIntegration.test.ts
git commit -m "feat: feature recent library reading"
```

### Task 4: Prove behavior and visual hierarchy in the browser

**Files:**
- Modify: `e2e/library-book-first.spec.ts`

- [ ] **Step 1: Generalize the import helper and write failing browser cases**

Change the helper signature:

```ts
async function importBook(
  page: Page,
  name = "library-book-first-sample.txt",
  text = sampleText
) {
  await page.locator('input[type="file"][accept*=".txt"]').setInputFiles({
    name,
    mimeType: "text/plain",
    buffer: Buffer.from(text),
  });
  await expect(
    page.locator(`${libraryRoot} [data-book-cover-origin]`).first()
  ).toBeVisible();
}
```

Add these cases:

```ts
test("an imported unread book does not claim recent reading", async ({ page }) => {
  await expect(
    page.locator(`${libraryRoot} [data-library-featured="true"]`)
  ).toHaveCount(0);
});

test("a recently opened book becomes the single Library focus", async ({
  page,
}, testInfo) => {
  await importBook(page, "other-book.txt", "A second shelf book.");
  await seedActiveBook(page);
  await page.reload();
  await waitForLibrary(page);

  const feature = page.locator(
    `${libraryRoot} [data-library-featured="true"]`
  );
  await expect(feature).toBeVisible();
  await expect(
    feature.getByRole("button", { name: /继续阅读/ })
  ).toBeVisible();

  const featuredId = await feature
    .locator("[data-book-id]")
    .getAttribute("data-book-id");
  await expect(
    page.locator(
      `${libraryRoot} [data-library-shelf="true"] [data-book-id="${featuredId}"]`
    )
  ).toHaveCount(0);
  await expect(
    page.locator(`${libraryRoot} [data-library-shelf="true"] [data-book-id]`)
  ).toHaveCount(1);
  await capture(page, testInfo, "library-featured-light");
});

test("search and editing restore the complete working shelf", async ({ page }) => {
  await seedActiveBook(page);
  await page.reload();
  await waitForLibrary(page);
  const feature = page.locator(
    `${libraryRoot} [data-library-featured="true"]`
  );
  await expect(feature).toBeVisible();

  await page.getByRole("searchbox").fill("library");
  await expect(feature).toHaveCount(0);
  await expect(
    page.locator(`${libraryRoot} [data-library-shelf="true"] [data-book-id]`)
  ).toHaveCount(1);

  await page.getByRole("searchbox").fill("");
  await expect(feature).toBeVisible();
  await page.getByRole("button", { name: "编辑" }).click();
  await expect(feature).toHaveCount(0);
});
```

Add the reader close helper and two cases below:

```ts
async function closeReaderWithControls(page: Page) {
  await page.locator('[data-reader-menu-toggle="true"]').click();
  const closeButton = page.locator('[data-reader-close="true"]');
  await expect(closeButton).toBeVisible();
  await closeButton.click();
}

test("featured reading opens the reader and restores focus on return", async ({
  page,
}) => {
  await seedActiveBook(page);
  await page.reload();
  await waitForLibrary(page);

  const button = page
    .locator(`${libraryRoot} [data-library-featured="true"]`)
    .getByRole("button", { name: /继续阅读/ });
  await button.click();
  await expect(page.locator('[data-reader-presented="true"]')).toBeVisible();
  await closeReaderWithControls(page);
  await expect(page.locator('[data-reader-presented="true"]')).toHaveCount(0);
  await expect(button).toBeFocused();
});

test("featured reading remains legible in dark theme", async ({
  page,
}, testInfo) => {
  await seedActiveBook(page);
  await page.evaluate(() => {
    localStorage.setItem(
      "ai-reader-preferences",
      JSON.stringify({ theme: "dark" })
    );
  });
  await page.reload();
  await waitForLibrary(page);
  await expect(
    page.locator(`${libraryRoot} [data-library-featured="true"]`)
  ).toBeVisible();
  await capture(page, testInfo, "library-featured-dark");
});
```

- [ ] **Step 2: Run the new browser cases and verify RED**

Start a development server on an unused port:

```powershell
$env:PORT='3060'
npm.cmd run dev
```

In a second PowerShell session run:

```powershell
$env:PLAYWRIGHT_BASE_URL='http://localhost:3060'
npx.cmd playwright test e2e/library-book-first.spec.ts --project=iphone-14 --grep "recently opened|search and editing|imported unread"
```

Expected: FAIL until the feature implementation and locators are complete.

- [ ] **Step 3: Make only evidence-driven test or style corrections**

Correct locator timing, truncation, spacing, cover sizing, or theme contrast only when the iPhone screenshots or browser assertions demonstrate a defect. Do not add blur, bounce, new dependencies, auto-advancing content, or page-load choreography.

- [ ] **Step 4: Run the complete Library browser suite on both phones**

Run:

```powershell
$env:PLAYWRIGHT_BASE_URL='http://localhost:3060'
npx.cmd playwright test e2e/library-book-first.spec.ts --project=iphone-14
npx.cmd playwright test e2e/library-book-first.spec.ts --project=iphone-15-pro-max
Remove-Item Env:PLAYWRIGHT_BASE_URL
```

Expected: all Library cases pass on both projects. Inspect `library-featured-light.png` and `library-featured-dark.png` for first-viewport hierarchy, title truncation, shelf density, focus geometry, and safe-area clearance.

- [ ] **Step 5: Run the targeted Impeccable detector**

Run:

```powershell
node C:\aaa\.agents\skills\impeccable\scripts\detect.mjs --json app/LibrarySurface.tsx app/page.module.css
```

Expected: no new high-confidence product anti-patterns. Fix any issue in the changed feature rules before committing.

- [ ] **Step 6: Commit browser coverage and visual corrections**

```powershell
git add -- e2e/library-book-first.spec.ts app/LibrarySurface.tsx app/page.module.css
git commit -m "test: verify featured library reading"
```

### Task 5: Verify, deploy, and refresh the handoff

**Files:**
- Modify: `HANDOFF.md`

- [ ] **Step 1: Run all focused tests from a clean command**

```powershell
npm.cmd test -- lib/libraryShelves.test.ts lib/libraryHomePresentation.test.ts lib/libraryHomeComposition.test.ts lib/libraryFeaturedReadingIntegration.test.ts lib/libraryBookFirst.test.ts lib/libraryMotionIntegration.test.ts lib/librarySelection.test.ts lib/incrementalList.test.ts lib/sharedBookTransition.test.ts
```

Expected: all focused files and tests pass with zero failures.

- [ ] **Step 2: Run the full local verification gate**

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
git diff --check
git status -sb
```

Expected: full Vitest, configured ESLint, webpack production build, and whitespace checks pass. Only intended files are modified.

- [ ] **Step 3: Run the full two-device Playwright regression**

With the verified local server URL:

```powershell
$env:PLAYWRIGHT_BASE_URL='http://localhost:3060'
npx.cmd playwright test --project=iphone-14
npx.cmd playwright test --project=iphone-15-pro-max
Remove-Item Env:PLAYWRIGHT_BASE_URL
```

Expected: all configured browser suites pass on both projects.

- [ ] **Step 4: Build and deploy with the documented Windows OpenNext sequence**

```powershell
Remove-Item -Recurse -Force .next,.open-next -ErrorAction SilentlyContinue
$env:NEXT_PRIVATE_STANDALONE='true'
$env:NEXT_PRIVATE_OUTPUT_TRACE_ROOT=(Get-Location).Path
npm.cmd run build
node node_modules\@opennextjs\cloudflare\dist\cli\index.js build --skipNextBuild
node node_modules\@opennextjs\cloudflare\dist\cli\index.js deploy
```

Expected: deployment succeeds for Worker `ai-reader-pwa` on `881817.xyz/*` and prints the new Worker version ID.

- [ ] **Step 5: Verify production assets and focused behavior**

```powershell
$html=(Invoke-WebRequest -UseBasicParsing https://881817.xyz).Content
$assets=$html | Select-String -Pattern '/_next/static/(?:css|chunks)/[^"'']+\.(?:css|js)' -AllMatches | ForEach-Object { $_.Matches.Value } | Select-Object -Unique
foreach($asset in $assets){
  $response=Invoke-WebRequest -UseBasicParsing "https://881817.xyz$asset"
  "$asset $($response.StatusCode) $($response.Headers['Content-Type']) len=$($response.RawContentLength)"
}
$env:PLAYWRIGHT_BASE_URL='https://881817.xyz'
npx.cmd playwright test e2e/library-book-first.spec.ts --project=iphone-14
Remove-Item Env:PLAYWRIGHT_BASE_URL
```

Expected: root and all discovered JS/CSS assets return 200, and production Library coverage passes on iPhone 14 emulation.

- [ ] **Step 6: Update and commit `HANDOFF.md`**

Record:

- design and implementation-plan paths;
- implementation and browser-test commit IDs;
- focused/full Vitest counts, ESLint/build results, and two-device Playwright counts;
- screenshot paths reviewed;
- production Worker version and asset checks;
- remaining physical iPhone Safari/PWA and VoiceOver risks;
- the next-chat opener, without reopening roadmap Phases 1 through 6.

Then run:

```powershell
git add -- HANDOFF.md
git commit -m "docs: complete featured library reading"
git push origin codex/custom-background-settings
git status -sb
git log -8 --oneline --decorate
```

Expected: local and `origin/codex/custom-background-settings` point to the same handoff commit and the working tree is clean.
