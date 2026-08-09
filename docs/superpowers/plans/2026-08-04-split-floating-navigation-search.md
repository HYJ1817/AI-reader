# Split Floating Navigation Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not use subagents for this repository task.

**Goal:** Replace the single floating root pill with a persistent split Dock that morphs into a back button and bottom search field, while showing reusable library results above it and completing the approved press and TXT typography polish.

**Architecture:** Add `library-search` to the existing PushRoute model so browser history, edge-back, focus restoration, and root persistence stay authoritative. Extract the current list/grid result renderer into a shared component used by both Library home and the search Push surface. Keep one `AppNavigation` Dock mounted outside NavigationStack and animate its two slots with Motion layout transforms between root and search modes.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS Modules, motion/react, Vitest, Playwright.

---

## File map

- Modify `lib/appNavigation.ts`: add the `library-search` Push route.
- Modify `lib/appNavigation.test.ts`: cover push/pop state and focus metadata.
- Modify `lib/navigationMotion.ts` and `lib/navigationMotion.test.ts`: give search the compact Push motion profile.
- Create `app/LibraryBookResults.tsx`: own the shared list/grid result markup only.
- Modify `app/LibrarySurface.tsx`: use `LibraryBookResults`, remove its embedded search field, and retain/reposition its list-grid view switcher.
- Create `app/LibrarySearchSurface.tsx`: render search results and search-specific empty states.
- Modify `app/AppPushSurfaces.tsx`: route `library-search` and type its data/actions.
- Modify `app/AppNavigation.tsx`: render the persistent two-slot Dock and morphing search input.
- Modify `app/page.tsx`: separate home filtering from global search, keep progressive windows, and wire Push/Dock actions.
- Modify `app/page.module.css` and `app/globals.css`: split Dock geometry, search surface, press states, themes, responsive and reduced-motion rules.
- Create `lib/textLanguage.ts` and `lib/textLanguage.test.ts`: identify Han-containing TXT paragraphs.
- Modify `app/ReadingSession.tsx`: add `lang="zh-CN"` to Han TXT paragraphs.
- Modify `lib/navigationChrome.test.ts`, `lib/libraryEmptyRecoveryIntegration.test.ts`, `lib/motionCss.test.ts`, and `lib/accessibilityIntegration.test.ts`: source-level contracts.
- Modify `e2e/native-navigation.spec.ts` and `e2e/interaction-fluidity.spec.ts`: journeys, geometry, interruption, themes and press latency.
- Modify `HANDOFF.md`: record verified behavior and any remaining physical-iPhone acceptance gap.

### Task 1: Add the search Push route

**Files:**
- Modify: `lib/appNavigation.ts`
- Modify: `lib/appNavigation.test.ts`
- Modify: `lib/navigationMotion.ts`
- Modify: `lib/navigationMotion.test.ts`

- [ ] **Step 1: Write failing navigation tests**

Add a reducer case that pushes search without changing the active root and pops back to the same root:

```ts
it("presents library search above the current root and restores it on pop", () => {
  const reading = reduceAppNavigation(createAppNavigationState(), {
    type: "select-tab",
    tab: "reading",
  });
  const searching = reduceAppNavigation(reading, {
    type: "push",
    entry: {
      key: "push-library-search-1",
      kind: "push",
      route: "library-search",
      restoreFocusId: "library-search-button",
    },
  });

  expect(searching.activeTab).toBe("reading");
  expect(searching.pushes.at(-1)?.route).toBe("library-search");
  expect(reduceAppNavigation(searching, { type: "pop" }).activeTab).toBe("reading");
});
```

Update the motion-profile test:

```ts
expect(getPushMotionProfile("library-search")).toBe("compact");
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
npm.cmd test -- lib/appNavigation.test.ts lib/navigationMotion.test.ts
```

Expected: FAIL because `library-search` is not assignable to `PushRoute` and is not compact.

- [ ] **Step 3: Implement the minimal route contract**

Add the route literal:

```ts
export type PushRoute =
  | "collections"
  | "library-search"
  | "ai-providers"
  | "ai-provider-configure"
  | "custom-background";
```

Update the profile without changing other routes:

```ts
export function getPushMotionProfile(
  route: string | undefined
): PushMotionProfile {
  return route === "ai-provider-configure" || route === "library-search"
    ? "compact"
    : "depth";
}
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the Step 2 command. Expected: both files pass with zero failures.

- [ ] **Step 5: Commit**

```powershell
git add -- lib/appNavigation.ts lib/appNavigation.test.ts lib/navigationMotion.ts lib/navigationMotion.test.ts
git commit -m "feat: add library search push route"
```

### Task 2: Extract the shared list/grid book renderer

**Files:**
- Create: `app/LibraryBookResults.tsx`
- Modify: `app/LibrarySurface.tsx`
- Modify: `lib/libraryEmptyRecoveryIntegration.test.ts`
- Modify: `lib/accessibilityIntegration.test.ts`

- [ ] **Step 1: Write failing extraction contracts**

Require one renderer to own both result modes and unique source geometry:

```ts
const results = readFileSync(
  new URL("../app/LibraryBookResults.tsx", import.meta.url),
  "utf8"
);

expect(results).toContain('mode === "grid"');
expect(results).toContain('data-library-result-mode={mode}');
expect(results).toContain("originPrefix");
expect(results).toContain("layoutGroupId");
expect(librarySurface).toContain("<LibraryBookResults");
expect(librarySurface).not.toContain("visibleBooks.map((book)");
```

- [ ] **Step 2: Run the contracts and verify RED**

Run:

```powershell
npm.cmd test -- lib/libraryEmptyRecoveryIntegration.test.ts lib/accessibilityIntegration.test.ts
```

Expected: FAIL because `LibraryBookResults.tsx` does not exist.

- [ ] **Step 3: Create the shared renderer**

Define a focused prop contract:

```tsx
export type LibraryBookResultsProps = {
  books: BookMetadata[];
  mode: LibraryViewMode;
  progressMap: ReadingProgressMap;
  editing: boolean;
  selectedBookIds: readonly string[];
  entranceOrder: ReadonlyMap<string, number>;
  originPrefix: string;
  layoutGroupId: string;
  onPressBook: (book: BookMetadata, originId: string) => void;
  onOpenBookActions: (book: BookMetadata) => void;
};
```

Move the complete existing `bookGrid` and list-row branches from `LibrarySurface` into this component without changing presentation, selection semantics, `MotionBookCover`, progress text, more-action labels, or entrance limits. The new component must branch directly on `mode`, map the supplied `books` in each branch, and generate IDs with:

```ts
const originId = `${originPrefix}-${mode}-${book.id}`;
```

Wrap the two unchanged result branches with:

```tsx
<LayoutGroup id={layoutGroupId}>
  <div data-library-result-mode={mode}>
    {mode === "grid" ? (
      <m.div className={styles.bookGrid}>{gridBookItems}</m.div>
    ) : (
      <m.div className={styles.bookList}>{listBookItems}</m.div>
    )}
  </div>
</LayoutGroup>
```

Here `gridBookItems` and `listBookItems` are local constants produced by mapping `books` through the exact grid-card and list-row JSX moved from `LibrarySurface`; they are not new presentation components.

- [ ] **Step 4: Replace embedded rendering in LibrarySurface**

Use:

```tsx
<LibraryBookResults
  books={visibleBooks}
  mode={view.mode}
  progressMap={progressMap}
  editing={editing.library}
  selectedBookIds={editing.selectedBookIds}
  entranceOrder={entranceOrder}
  originPrefix="library"
  layoutGroupId="library-home-books"
  onPressBook={actions.pressBook}
  onOpenBookActions={actions.openBookActions}
/>
```

Keep featured-book rendering and the current list-grid view switcher in `LibrarySurface`; only the repeated shelf results move. Remove the old inline search field and align the retained switcher to the trailing edge of its toolbar so library mode remains user-selectable.

- [ ] **Step 5: Run focused tests and lint the two components**

```powershell
npm.cmd test -- lib/libraryEmptyRecoveryIntegration.test.ts lib/accessibilityIntegration.test.ts
npm.cmd exec -- eslint app/LibraryBookResults.tsx app/LibrarySurface.tsx
```

Expected: tests and ESLint pass.

- [ ] **Step 6: Commit**

```powershell
git add -- app/LibraryBookResults.tsx app/LibrarySurface.tsx lib/libraryEmptyRecoveryIntegration.test.ts lib/accessibilityIntegration.test.ts
git commit -m "refactor: share library result rendering"
```

### Task 3: Build the search result Push surface

**Files:**
- Create: `app/LibrarySearchSurface.tsx`
- Modify: `app/AppPushSurfaces.tsx`
- Modify: `app/page.tsx`
- Modify: `app/page.module.css`
- Create: `lib/librarySearchIntegration.test.ts`

- [ ] **Step 1: Write failing search-surface tests**

Assert the search surface uses all books and the shared view mode:

```ts
expect(pushSurfaces).toContain('case "library-search"');
expect(searchSurface).toContain("<LibraryBookResults");
expect(searchSurface).toContain('originPrefix="library-search"');
expect(page).toContain("filterBooksByQuery(books, librarySearchQuery)");
expect(page).toContain("mode: libraryView");
expect(page).not.toContain("filterBooksByQuery(\n    groupFilteredBooks");
```

Also require semantic states:

```ts
expect(searchSurface).toContain('aria-label={UI_TEXT.SEARCH}');
expect(searchSurface).toContain("UI_TEXT.NO_MATCHING_BOOKS");
expect(searchSurface).toContain("UI_TEXT.CLEAR_SEARCH");
```

- [ ] **Step 2: Run the new test and verify RED**

```powershell
npm.cmd test -- lib/librarySearchIntegration.test.ts
```

Expected: FAIL because the component and route branch do not exist.

- [ ] **Step 3: Implement LibrarySearchSurface**

Use a prop contract that shares data and actions, not state ownership:

```tsx
type Props = {
  books: BookMetadata[];
  visibleBooks: BookMetadata[];
  query: string;
  mode: LibraryViewMode;
  progressMap: ReadingProgressMap;
  loading: boolean;
  importError: string | null;
  sentinelRef: RefObject<HTMLDivElement | null>;
  onClearQuery: () => void;
  onImportBooks: () => void;
  onPressBook: (book: BookMetadata, originId: string) => void;
  onOpenBookActions: (book: BookMetadata) => void;
};
```

Render a visually quiet, scrollable Push surface with a screen-reader heading, existing empty-library recovery, no-match recovery, `LibraryBookResults`, and the progressive-load sentinel. Do not render a second search input or a second view-mode toggle.

- [ ] **Step 4: Wire search data independently from home filtering**

In `page.tsx`, keep home collection filtering independent:

```ts
const libraryShelfBooks = buildLibraryHomePresentation({
  books,
  filteredBooks: groupFilteredBooks,
  searchQuery: "",
  groupFilter,
  editing: libraryEditing,
}).shelfBooks;

const librarySearchBooks = filterBooksByQuery(books, librarySearchQuery);
```

Add a search render key/count/ref using the existing batch size and IntersectionObserver pattern. Reset its count when query or view mode changes.

- [ ] **Step 5: Route the surface through AppPushSurfaces**

Add typed `library` data and actions to `AppPushSurfaces`, then render:

```tsx
case "library-search":
  return <LibrarySearchSurface {...data.library} />;
```

Pass `libraryView` directly. Do not create search-specific view-mode state.

- [ ] **Step 6: Run focused tests and source lint**

```powershell
npm.cmd test -- lib/librarySearchIntegration.test.ts lib/libraryFilters.test.ts lib/appNavigation.test.ts
npm.cmd exec -- eslint app/LibrarySearchSurface.tsx app/AppPushSurfaces.tsx app/page.tsx
```

Expected: all commands pass.

- [ ] **Step 7: Commit**

```powershell
git add -- app/LibrarySearchSurface.tsx app/AppPushSurfaces.tsx app/page.tsx app/page.module.css lib/librarySearchIntegration.test.ts
git commit -m "feat: add library search push surface"
```

### Task 4: Morph the persistent split Dock

**Files:**
- Modify: `app/AppNavigation.tsx`
- Modify: `app/page.tsx`
- Modify: `app/page.module.css`
- Modify: `app/globals.css`
- Modify: `lib/navigationChrome.test.ts`
- Modify: `lib/motionCss.test.ts`
- Modify: `lib/accessibilityIntegration.test.ts`

- [ ] **Step 1: Write failing Dock structure and motion tests**

Require the persistent two-slot geometry:

```ts
expect(navigationSource).toContain('data-navigation-mode={searchOpen ? "search" : "root"}');
expect(navigationSource).toContain('layoutId="navigation-primary-slot"');
expect(navigationSource).toContain('layoutId="navigation-search-slot"');
expect(navigationSource).toContain('id="library-search-button"');
expect(navigationSource).toContain('type="search"');
expect(navigationSource).toContain("onLayoutAnimationComplete");
expect(navigationSource).toContain("navigationRevision");
```

Update CSS expectations:

```ts
expect(dockRule).toContain("grid-template-columns: minmax(0, 1fr) 68px");
expect(dockRule).toContain("gap: 10px");
expect(searchModeRule).toContain("grid-template-columns: 68px minmax(0, 1fr)");
expect(primaryRule).toContain("backdrop-filter: blur(14px) saturate(112%)");
expect(searchRule).not.toContain("backdrop-filter");
```

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm.cmd test -- lib/navigationChrome.test.ts lib/motionCss.test.ts lib/accessibilityIntegration.test.ts
```

Expected: FAIL on missing split/search mode contracts.

- [ ] **Step 3: Extend AppNavigation props and persistent structure**

Add:

```ts
searchOpen: boolean;
searchQuery: string;
navigationRevision: number;
onOpenSearch: () => void;
onCloseSearch: () => void;
onSearchQueryChange: (query: string) => void;
```

Render one persistent wrapper:

```tsx
<m.div
  className={styles.navigationDock}
  data-navigation-mode={searchOpen ? "search" : "root"}
  layout
>
  <m.div className={styles.navigationPrimarySlot} layoutId="navigation-primary-slot" layout>
    <AnimatePresence initial={false} mode="popLayout">
      {searchOpen ? (
        <m.button key="back" type="button" aria-label="返回" onClick={handleCloseSearch}>
          <ChevronLeft aria-hidden="true" />
        </m.button>
      ) : (
        <m.nav key="tabs" aria-label="主导航">{tabButtons}</m.nav>
      )}
    </AnimatePresence>
  </m.div>
  <m.div className={styles.navigationSearchSlot} layoutId="navigation-search-slot" layout>
    <AnimatePresence initial={false} mode="popLayout">
      {searchOpen ? (
        <m.label key="input">
          <Search aria-hidden="true" />
          <input ref={searchInputRef} type="search" aria-label="搜索书库" value={searchQuery} onChange={handleSearchChange} />
        </m.label>
      ) : (
        <m.button key="search" id="library-search-button" type="button" aria-label="搜索书库" onClick={onOpenSearch}>
          <Search aria-hidden="true" />
        </m.button>
      )}
    </AnimatePresence>
  </m.div>
</m.div>
```

Define `tabButtons`, `handleSearchChange`, and `handleCloseSearch` in `AppNavigation`; `tabButtons` contains the current indicator and all three root buttons. Keep the search glyph at the same visual anchor in both right-slot states so its trajectory reads as continuous even though the interactive wrapper changes.

- [ ] **Step 4: Implement interruptible focus behavior**

Capture the revision at search entry and focus only when the current props still describe that revision and search remains open:

```ts
function handleSearchLayoutComplete() {
  if (!searchOpen || focusRevisionRef.current !== navigationRevision) return;
  searchInputRef.current?.focus({ preventScroll: true });
}
```

On close, blur the input before `onCloseSearch`. Reduced Motion focuses on the next animation frame.

- [ ] **Step 5: Wire page actions and visibility**

Derive:

```ts
const topPushRoute = navigation.state.pushes.at(-1)?.route;
const librarySearchOpen = topPushRoute === "library-search";
const showNavigationDock =
  (navigation.state.pushes.length === 0 || librarySearchOpen) &&
  shouldShowBottomTabs(activeTab, readerPresented);
```

Enter search with a clean query and focus restoration metadata:

```ts
setLibrarySearchQuery("");
navigation.push("library-search", {
  restoreFocusId: "library-search-button",
});
```

- [ ] **Step 6: Implement theme-aware geometry and reduced motion**

Use the approved geometry:

```css
.navigationDock {
  position: fixed;
  left: 50%;
  bottom: calc(var(--safe-bottom) + 6px);
  width: min(430px, calc(100vw - 20px));
  display: grid;
  grid-template-columns: minmax(0, 1fr) 68px;
  gap: 10px;
  transform: translate3d(-50%, 0, 0);
}

.navigationDock[data-navigation-mode="search"] {
  grid-template-columns: 68px minmax(0, 1fr);
}
```

Put the live blur only on slot backing pseudo-elements or a single backing element per slot, never on moving inner text/icons. Add 380px and landscape rules so the search field remains at least 160px wide.

- [ ] **Step 7: Run focused tests and lint**

```powershell
npm.cmd test -- lib/navigationChrome.test.ts lib/motionCss.test.ts lib/accessibilityIntegration.test.ts
npm.cmd exec -- eslint app/AppNavigation.tsx app/page.tsx
```

Expected: all pass.

- [ ] **Step 8: Commit**

```powershell
git add -- app/AppNavigation.tsx app/page.tsx app/page.module.css app/globals.css lib/navigationChrome.test.ts lib/motionCss.test.ts lib/accessibilityIntegration.test.ts
git commit -m "feat: morph navigation dock into search"
```

### Task 5: Complete press feedback and TXT Chinese typography

**Files:**
- Create: `lib/textLanguage.ts`
- Create: `lib/textLanguage.test.ts`
- Modify: `app/ReadingSession.tsx`
- Modify: `app/page.module.css`
- Modify: `lib/accessibilityIntegration.test.ts`
- Modify: `lib/motionCss.test.ts`

- [ ] **Step 1: Write failing language and CSS tests**

```ts
import { getTxtParagraphLanguage } from "./textLanguage";

expect(getTxtParagraphLanguage("资本论第一章")).toBe("zh-CN");
expect(getTxtParagraphLanguage("AI 阅读助手支持中文")).toBe("zh-CN");
expect(getTxtParagraphLanguage("Chapter One")).toBeUndefined();
expect(getTxtParagraphLanguage("   ")).toBeUndefined();
```

Require the renderer and language-specific rule:

```ts
expect(readingSession).toContain("lang={getTxtParagraphLanguage(paragraph)}");
expect(cssRule('.paragraph:lang(zh-CN)')).toContain("line-break: strict");
expect(cssRule('.paragraph:lang(zh-CN)')).toContain("word-break: normal");
```

Require active states for `.iconButton`, `.primaryButton`, `.emptyRecoveryButton`, `.navigationSearchButton`, and `.navigationBackButton`, plus reduced-motion transform removal.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm.cmd test -- lib/textLanguage.test.ts lib/accessibilityIntegration.test.ts lib/motionCss.test.ts
```

Expected: FAIL because the helper and new rules do not exist.

- [ ] **Step 3: Implement paragraph language detection**

```ts
const HAN_CHARACTER = /\p{Script=Han}/u;

export function getTxtParagraphLanguage(
  text: string
): "zh-CN" | undefined {
  return HAN_CHARACTER.test(text) ? "zh-CN" : undefined;
}
```

Use it only on TXT `<p>` elements. Add progressive CSS:

```css
.paragraph:lang(zh-CN) {
  line-break: strict;
  word-break: normal;
  overflow-wrap: break-word;
  hanging-punctuation: first allow-end last;
}
```

- [ ] **Step 4: Add tiered press states**

Add app-level press tokens and use them in named selectors only:

```css
.app {
  --press-control-scale: 0.97;
  --press-icon-scale: 0.94;
  --press-translate-y: 1px;
}
```

For compact controls, combine translate and scale; for content rows keep tint plus translate. In both app and system reduced-motion blocks, set active transforms to `none`.

- [ ] **Step 5: Run focused tests and lint**

```powershell
npm.cmd test -- lib/textLanguage.test.ts lib/accessibilityIntegration.test.ts lib/motionCss.test.ts
npm.cmd exec -- eslint lib/textLanguage.ts app/ReadingSession.tsx
```

Expected: all pass.

- [ ] **Step 6: Commit**

```powershell
git add -- lib/textLanguage.ts lib/textLanguage.test.ts app/ReadingSession.tsx app/page.module.css lib/accessibilityIntegration.test.ts lib/motionCss.test.ts
git commit -m "style: refine press and Chinese reading rhythm"
```

### Task 6: Add browser journeys and visual evidence

**Files:**
- Modify: `e2e/native-navigation.spec.ts`
- Modify: `e2e/interaction-fluidity.spec.ts`
- Modify: `playwright.config.ts` only if an existing screenshot output needs registration; do not change retries or budgets.

- [ ] **Step 1: Write failing navigation/search journeys**

Add tests for both device projects:

```ts
test("split dock morphs into search and restores the source root", async ({ page }) => {
  await seedLibrary(page, { books: 3 });
  await page.locator('[data-navigation-tab="reading"]').click();
  await page.getByRole("button", { name: "搜索书库" }).click();
  await expect(page.locator('[data-navigation-mode="search"]')).toBeVisible();
  await expect(page.locator('[data-library-search-surface="true"]')).toBeVisible();
  await page.getByRole("searchbox", { name: "搜索书库" }).fill("sample");
  await expect(page.locator('[data-library-result-mode="list"]')).toBeVisible();
  await page.getByRole("button", { name: "返回" }).click();
  await expect(page.locator('[data-navigation-mode="root"]')).toBeVisible();
  await expect(page.locator('[data-navigation-tab="reading"]')).toHaveAttribute("aria-current", "page");
});
```

- [ ] **Step 2: Run the new journey and verify RED**

```powershell
npx.cmd playwright test e2e/native-navigation.spec.ts --grep "split dock morphs" --trace=off
```

Expected: FAIL because the split Dock/search journey is absent.

- [ ] **Step 3: Add interruption, mode, empty and geometry cases**

Cover:

- rapid open then back during the 280ms morph;
- browser back and edge-back commit once;
- list and grid mode parity;
- empty library and no matches;
- focus after expansion and restoration after close;
- 200% text, dark and sepia themes;
- Dock/search input not overlapping Home Indicator at 390×844 and 430×932;
- no more than one live moving backdrop-filter layer.

Capture `dock-root.png`, `dock-search-midpoint.png`, `dock-search-settled.png`, `search-grid.png`, and `search-list.png` for visual inspection.

- [ ] **Step 4: Extend press latency coverage**

Measure root tab, search circle and back circle with the existing `measurePressFeedback` helper. Keep the 80ms threshold and trace-off command; do not loosen it.

- [ ] **Step 5: Run the focused browser matrix**

```powershell
npx.cmd playwright test e2e/native-navigation.spec.ts e2e/interaction-fluidity.spec.ts --grep "split dock|library search|press feedback|200%" --trace=off
```

Expected: all focused cases pass on iPhone 14 and iPhone 15 Pro Max with zero retries.

- [ ] **Step 6: Inspect retained screenshots**

Use local image inspection for every retained image. Reject overlap, clipped labels, asymmetric slot heights, transparent text bleed, abrupt midpoint geometry, or mismatched light/dark/sepia materials. Make only bounded CSS corrections, then rerun Step 5.

- [ ] **Step 7: Commit**

```powershell
git add -- e2e/native-navigation.spec.ts e2e/interaction-fluidity.spec.ts app/page.module.css app/AppNavigation.tsx
git commit -m "test: cover split navigation search flow"
```

### Task 7: Full verification and handoff

**Files:**
- Modify: `HANDOFF.md`

- [ ] **Step 1: Run full unit tests**

```powershell
npm.cmd test
```

Expected: all test files and tests pass with zero failures.

- [ ] **Step 2: Run lint**

```powershell
npm.cmd run lint
```

Expected: exit 0 with no ESLint errors.

- [ ] **Step 3: Run the production build**

```powershell
$env:NEXT_PRIVATE_STANDALONE='true'
$env:NEXT_PRIVATE_OUTPUT_TRACE_ROOT=(Get-Location).Path
npm.cmd run build
```

Expected: optimized build, TypeScript, static generation and trace collection all complete successfully.

- [ ] **Step 4: Run the authoritative full Playwright matrix**

```powershell
npx.cmd playwright test --trace=off
```

Expected: all iPhone 14 and iPhone 15 Pro Max cases pass with one worker, zero retries, unchanged performance budgets, and no long-task/CLS regression.

- [ ] **Step 5: Check the final diff**

```powershell
git diff --check
git status -sb
git diff --stat
```

Expected: no whitespace errors; only scoped files are modified.

- [ ] **Step 6: Update HANDOFF.md**

Record implementation commits, test counts, exact Playwright command, representative motion/geometry evidence, and the remaining physical iPhone Safari/Home Screen PWA/VoiceOver/ProMotion gap. Do not claim physical-device acceptance.

- [ ] **Step 7: Commit verification documentation**

```powershell
git add -- HANDOFF.md
git commit -m "docs: record split search navigation verification"
```

- [ ] **Step 8: Verify clean final state**

```powershell
git status -sb
git log -8 --oneline --decorate
```

Expected: worktree clean and the planned commits visible. Deployment and remote push require a separate explicit authorization for this delivery.
