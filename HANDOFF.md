# AI Reader Agent Handoff

## Current Checkout

- Repository: `C:\aaa\ai-reader-pwa`
- GitHub remote: `https://github.com/HYJ1817/AI-reader.git`
- Active branch: `codex/custom-background-settings`
- Pull request: `https://github.com/HYJ1817/AI-reader/pull/1`
- Base branch: `main`
- Latest reader-tab motion design commit: `1e77fb3`; implementation plan:
  `b0c5176`; implementation: `720575a`, `9082766`, and `53c7125`; browser
  coverage and stabilization: `bd871fd` and `3e0bff4`.
- EPUB page-status design and implementation plan commit: `6fe098b`.
- Motion-detail design commit: `204909a`; implementation plan commit:
  `fda4867`; focused implementation continues through `b3c2638`.
- Featured-Library design commit: `5eaf3a3`; implementation plan commit:
  `91a8450`; implementation and verification continue through `d9463a5`.
- Latest product behavior commit: `8911f9a` (`perf: stabilize contents tab
  transitions`). It supersedes the first swipeable-tab implementation for
  click-transition performance while preserving native finger swipes.
- Latest deployed Worker version: `1e9e5ad9-76fe-40e6-9210-a731a88503ee`.
- GitHub CLI authentication is invalid. The deployed local branch is ahead of
  `origin/codex/custom-background-settings`; do not change credentials or
  remotes automatically. Push only after the user re-authenticates.

Do not run `git reset`, `git clean`, or overwrite local/user changes. Start the next session with:

```powershell
cd C:\aaa\ai-reader-pwa
git status -sb
git log -8 --oneline --decorate
Get-Content HANDOFF.md
```

## Product and Stack

AI Reader is a local-first EPUB/TXT reader focused on iPhone Safari and home-screen PWA use.

Current stack:

- Next.js 16 App Router
- Cloudflare Workers deployment via OpenNext for Cloudflare
- React 19 and TypeScript
- Dexie/IndexedDB
- epub.js
- Vitest and ESLint
- Service worker and web app manifest

Product direction:

- Keep the app as a Next.js PWA unless the user explicitly resumes the deferred native iOS shell plan.
- Preserve IndexedDB books, groups, progress, settings, custom backgrounds, and backups.
- Prefer restrained iOS-like product UI: simple lists, large tap targets, bottom sheets, no marketing-style screens.
- Real iPhone screenshots from the user are the acceptance source for visual bugs.

## Contents Tab Performance Stabilization (2026-07-16)

Implementation commit: `8911f9a`.

Root cause and implementation:

- The first Chapters -> Bookmarks click rebuilt the flattened navigation and
  the first 60 chapter rows while native `scrollTo({ behavior: "smooth" })`
  and Motion shared-layout projection were also starting. With a generated
  120-chapter EPUB and 4x CPU throttling, the bad path reproduced at a 33.3ms
  P95 frame interval, with 50-67ms frame gaps and 61-67ms long tasks.
- The flattened/visible navigation arrays are memoized, and the chapter list is
  now a memoized stable subtree instead of rerendering on every active-tab
  change.
- Label clicks immediately snap the already-mounted native scroll viewport and
  animate only the destination panel's opacity/`translate3d` through WAAPI.
  Finger gestures remain native horizontal scroll-snap, and reduced motion
  still skips the panel animation.
- The selected-tab pill is one persistent CSS transform layer keyed by
  `data-active-tab`; it no longer mounts a new Motion layout-projection node on
  every tab change.

Verification evidence:

- TDD red/green was observed: the original implementation failed with a 33.3ms
  P95 click interval; the fixed implementation passed the frame budget.
- Full Vitest: 154 files, 1422 tests passed. Full configured ESLint passed.
- The focused performance case passed 4/4 across iPhone 14 and iPhone 15 Pro
  Max. It waits for EPUB whole-book pagination, throttles tab clicks to 4x CPU,
  enforces P95 <= 20ms / no 50ms long task, and measures native swipe cadence
  separately so synthetic touch timers do not create false 30Hz input.
- The other 80 Playwright cases passed in the full two-device matrix; the two
  initial performance failures exposed the test's pagination/input-timing
  races, which were corrected before the 4/4 focused rerun.
- Standalone `next build --webpack`, OpenNext `build --skipNextBuild`, and
  Cloudflare deployment passed. Worker version
  `1e9e5ad9-76fe-40e6-9210-a731a88503ee` serves `881817.xyz/*`.
- Production root, Service Worker, BUILD_ID, Manifest, Asset Links, APK, all
  discovered page assets, and the new CSS/JS returned 200. The deployed bundle
  contains the persistent tab selectors and compositor slide markers.
- Production `reader-annotations.spec.ts` passed 8/8 across both configured
  iPhone profiles, including the 4x CPU click budget, native swipes, annotation
  persistence, and the `crypto.randomUUID` fallback.

## Reader Bookmarks and Three-Color Highlights (2026-07-16)

Approved design:
`docs/specs/2026-07-16-reader-bookmarks-highlights-design.md`.
Executed plan:
`docs/superpowers/plans/2026-07-16-reader-bookmarks-highlights.md`.

Implementation commits: `2546d04`, `166aaa2`, `f0ee618`, `52ec49f`,
`16ec756`, `d1107e4`, `820ce99`, `e9bf0f4`, and `5712337`.
Browser closeout commits: `8430605` and `7142890`.

Implemented behavior:

- Bookmarks and highlights are typed, book-scoped IndexedDB annotations and
  remain compatible with legacy annotation/backup records.
- The reading menu can add/remove the current bookmark and apply yellow, green,
  or blue highlights to the active selection with 44px color targets.
- The contents sheet has working Chapters, Bookmarks, and Highlights tabs with
  counts, empty states, excerpts, page/progress metadata, independent jump, and
  independent deletion.
- EPUB stores CFI point/range locators and synchronizes persistent native
  epub.js highlights. TXT stores versioned paragraph/offset locators, renders
  precise `<mark>` runs, and navigates correctly in scroll and paged modes.
- Annotation save/navigation errors use a polite live status region. A failed
  highlight save keeps the selection available instead of silently clearing it.
- Book import, all group creation paths, annotations, and AI provider creation
  no longer assume `crypto.randomUUID()` exists. Older Android/WebView uses the
  shared collision-resistant local ID fallback.

Verification evidence:

- Full Vitest: 153 files, 1415 tests passed.
- Full configured ESLint passed.
- `next build --webpack` passed, including TypeScript and static generation.
- Full Playwright: 78/78 across iPhone 14 and iPhone 15 Pro Max.
- New browser coverage verifies TXT bookmark/highlight creation, persistence
  after closing/reopening, green rendering, list jump, independent deletion,
  and TXT import with `crypto.randomUUID` unavailable.
- `git diff --check` passed before the closeout documentation edit.

Production status:

- Pushed through `988bb3c`; the later iOS PWA refresh fix is deployed from
  local commit `eb78730`. Latest Worker version is
  `91d582c4-46b9-41d2-b1e9-76f0fcc729a4` on `881817.xyz/*`.
- Production root and all 10 discovered JS/CSS assets returned 200. Manifest,
  Asset Links, and APK endpoints returned 200 with the expected content types.
- The deployed page/CSS assets contain bookmark, highlight, annotation-list,
  and old-Android local-ID markers. Production iPhone 14 Playwright passed 3/3:
  EPUB whole-book pages, annotation persistence/navigation/deletion, and TXT
  import without `crypto.randomUUID`.
- Playwright uses Chromium emulation. Physical Android WebView, iPhone
  Safari/PWA, and VoiceOver remain non-blocking real-device risks.

### iOS PWA stale-client refresh fix

- The user's post-deploy screenshot matched the old `c1be7b1` `TocDrawer`
  exactly: Bookmarks and Highlights were visual placeholder buttons without
  handlers. After the iOS PWA reloaded the current bundle, both tabs worked,
  confirming stale resumed JavaScript rather than a tab touch-handler defect.
- Commit `eb78730` bumps the Service Worker cache to `ai-reader-v6`, forcing
  existing controlled iOS clients through `skipWaiting`/`controllerchange` and
  the existing automatic reload path.
- New clients store the deployed `/BUILD_ID` in session storage and check it on
  mount, focus, visible resume, and every 60 seconds. A changed build ID is
  stored before reloading, preventing a loop; offline failures are ignored so
  local reading remains available.
- Full Vitest passed 153 files / 1417 tests; full ESLint and webpack production
  build passed. The focused Service Worker suite passed 12/12.
- Deployed Worker version `91d582c4-46b9-41d2-b1e9-76f0fcc729a4` uploaded a new
  `/sw.js`, `/BUILD_ID`, and layout chunk. Production `/sw.js` returns 200 and
  contains `ai-reader-v6` plus `skipWaiting`; `/BUILD_ID` returns 200. Production
  iPhone 14 annotation/import coverage passed 2/2.
- GitHub HTTPS/CLI credentials expired after the earlier push. Deployment is
  live, but the local branch remains ahead of origin until the user
  re-authenticates GitHub.

## Reader Contents Tab Motion (2026-07-16)

Approved design:
`docs/superpowers/specs/2026-07-16-reader-annotation-tabs-motion-design.md`.
Executed plan:
`docs/superpowers/plans/2026-07-16-reader-annotation-tabs-motion.md`.

Implementation commits: `720575a`, `9082766`, and `53c7125`.
Browser coverage commits: `bd871fd` and `3e0bff4`.

Implemented behavior:

- Chapters, Bookmarks, and Highlights are three always-mounted pages inside a
  native horizontal CSS scroll-snap viewport. Tapping a tab scrolls smoothly;
  a real finger drag switches pages through the same native scroller.
- The selected capsule uses Motion shared-layout transform animation. Scroll
  position remains browser-owned; React only synchronizes the nearest tab in a
  requestAnimationFrame and never stores raw per-frame swipe progress.
- The contents sheet has a stable `min(92dvh, 760px)` height, so empty Bookmark
  and Highlight pages do not collapse the drawer. Each page owns an independent
  vertical scroller, and chapter incremental rendering observes that scroller.
- The tab viewport declares horizontal gesture ownership so `MotionSheet`
  cannot steal its swipe for sheet dismissal. The grabber/header remains the
  sheet-dismiss target.
- Reduced motion keeps instant tab changes and a static active capsule. No
  permanent `will-change` or layout-property animation was added.

Verification evidence:

- Full Vitest passed 154 files / 1422 tests; full configured ESLint passed.
- Normal and standalone `next build --webpack` passed, including TypeScript and
  static generation; OpenNext `build --skipNextBuild` passed.
- Full Playwright passed 80/80 across iPhone 14 and iPhone 15 Pro Max. The new
  test verifies fixed height on empty tabs, tab taps, native CDP touch swipes,
  rapid retargeting, and final snapped offset.
- The touch case passed 10/10 repeated runs across both phone projects after
  increasing only the injected test distance. The earlier full-suite failure
  showed the native viewport stopped just short of the 50% snap threshold under
  load; product code was not changed for that test-harness issue.
- The implementation is designed for 90+ FPS on physical 120Hz ProMotion
  hardware by keeping continuous movement in native scrolling/compositor
  transforms. Chromium emulation cannot prove a 90Hz frame rate, so a physical
  iPhone performance trace remains the final non-blocking acceptance check.

Production status:

- OpenNext deployed Worker version `ee8236bf-217a-421b-9385-186d32a5fbec` to
  `881817.xyz/*`. The changed assets are
  `/_next/static/chunks/app/page-e86ea9501258f746.js` and
  `/_next/static/css/0f7a4a5d2fb7fc24.css`; deployed build ID is
  `cNACvCPiaYOetlYIwCIA-`.
- Production root and all 10 discovered JS/CSS assets returned 200. `/sw.js`,
  `/BUILD_ID`, the manifest, Asset Links, and APK also returned 200. The page
  bundle contains the swipe viewport, active indicator, and gesture-ownership
  markers; CSS contains fixed height and horizontal scroll snap; `/sw.js`
  remains on `ai-reader-v6` with `skipWaiting`.
- Production iPhone 14 reader-annotation coverage passed 3/3, including native
  horizontal swipe/fixed height, bookmark/highlight persistence and deletion,
  and TXT import without `crypto.randomUUID`.
- `gh auth status` still reports the HYJ1817 token invalid. Deployment is live,
  but these local commits are not pushed; do not modify credentials or remotes
  without the user's direction.

## Native Navigation and Motion System (2026-07-13)

Implementation commit: `7a5d178` and the 13 implementation commits immediately
before it, starting with `3512c7a`.

Current architecture:

- `AppMotionRoot` owns one Motion runtime, reduced-motion policy, and shared
  layout group.
- `useAppNavigation`, `NavigationProvider`, and `NavigationStack` own typed
  root, push, reader, and sheet navigation state.
- Library, Reading, and Settings roots remain mounted, retain scroll state, and
  move through the shared root transition protocol.
- Collections, AI provider list/configuration, and custom-background settings
  use the push stack. Browser Back, visible Back, and completed edge Back all
  resolve through the same reducer/history state.
- Reader presentation uses stable book-cover origins and shared layout IDs,
  with a fallback transition when the source is unavailable.
- All 11 overlay routes use the shared interruptible `MotionSheet` layer.
- Reader chrome, list insertion/removal, numeric changes, reading bars, Ask AI
  messages, and settings switches use state-driven Motion behavior.
- Legacy surface navigation keyframes and phase classes were removed. The only
  retained `will-change` is scoped to an actively tracked reader swipe.

Important reliability fixes discovered by mobile browser testing:

- AI Reader history entries now merge with Next App Router fields such as
  `__NA` instead of replacing them. Browser Back no longer causes a full page
  navigation/remount, so root scroll and source focus survive.
- Reader close synchronously records the source origin through a layout effect
  and restores focus only after a real focus target is available.
- `MotionSheet` follows `window.visualViewport` resize/scroll geometry, keeping
  Ask AI and other composers above a mobile software keyboard.
- The Library root exposes an explicit loading state so automated import waits
  for IndexedDB initialization instead of racing startup.

Gesture ownership:

- A horizontal drag beginning in the left 20px of the top push layer may claim
  edge Back after direction/threshold arbitration.
- Vertical scrolling, sheet dragging, reader scrolling/page turns, EPUB/TXT
  selection, sliders, inputs, and wheels keep their own gestures.
- Reader presentation covers and disables push edge Back, so a reader swipe
  cannot pop application navigation.
- Reduced motion removes spatial travel while keeping every destination and
  dismissal path functional.

Verification and evidence:

- Vitest: 133 files, 1339 tests passed.
- ESLint: full configured repository passed; generated `.next`, `.open-next`,
  test result, and nested worktree outputs are explicitly ignored.
- `next build --webpack`: passed, including TypeScript and static generation.
- Development mobile emulation: iPhone 14 11/11 and iPhone 15 Pro Max 11/11.
- Local `next start` production mode: 22/22 across both mobile projects.
- Deployed `https://881817.xyz`: iPhone 14 11/11.
- Browser coverage includes source-focus return, History Back, root scroll
  retention, visible/edge Back equivalence, reader gesture isolation, all four
  push routes, all 11 sheet routes, keyboard-sized Ask AI, reduced motion,
  transition screenshots, and performance sampling.
- The 800ms performance probe requires at least 40 frames, no interval over
  80ms, and no long task over 100ms. Both mobile projects passed. Keep 50ms as
  the physical-device long-task target.
- Start/mid/completion screenshots for root, push, reader, and sheet are written
  under `test-results/native-navigation/` and intentionally gitignored.

Production deployment:

- Worker: `ai-reader-pwa`
- Route: `881817.xyz/*`
- Version: `cafbbbed-52fc-442f-9181-c18637427b8b`
- Main deployed page chunk:
  `/_next/static/chunks/app/page-a767c3d60387414c.js`
- Deployed CSS:
  `/_next/static/css/17bc67107d065b45.css` and
  `/_next/static/css/5c296e628dadff61.css`
- Every deployed JS/CSS asset returned 200. JS contains the navigation, reader,
  sheet, shared-cover, and `visualViewport` markers. CSS contains none of the
  old subview/sheet keyframe or phase markers.
- Root, manifest, assetlinks, and APK endpoints returned 200. APK remains at
  `https://881817.xyz/downloads/ai-reader-twa.apk` and targets
  `https://881817.xyz`.

Residual real-device risk:

- Playwright uses Chromium mobile emulation. Recheck gesture velocity, keyboard
  behavior, frame pacing, safe areas, and shared-cover geometry on physical
  iPhone Safari/PWA before calling the tactile polish final.
- There is still no representative EPUB fixture. EPUB whole-book paging and
  every EPUB interaction have unit/integration coverage, but the user's real
  book remains the final visual source.
- The dark-mode transparent EPUB ambient rectangle remains unresolved. Do not
  resume speculative CSS work without the affected EPUB or Safari Web
  Inspector evidence.

## UI Quality Roadmap Phase 1: Reader Typography (2026-07-14)

Phase 1 of `docs/superpowers/plans/2026-07-14-ui-quality-roadmap.md` is complete.
The approved design is
`docs/superpowers/specs/2026-07-14-reader-typography-design.md`, and the executed
plan is
`docs/superpowers/plans/2026-07-14-reader-typography-implementation.md`.

Implementation commit: `3ddb099` (`fix: polish reader typography and menu affordance`).

Implemented behavior:

- TXT paragraphs use natural `start` alignment by default. Justification is
  applied only when both custom layout and the explicit justify preference are
  enabled; no language or heading heuristics were introduced.
- EPUB layout and preferences are unchanged.
- The existing reader-menu button remains one 48px target and one click path.
  Its collapsed state is a quiet, partially inset right-edge surface; its
  expanded state retains the stronger material and shadow.
- TXT content has 96px plus safe-area bottom clearance so the last paragraph
  can scroll clear of the menu affordance.

Verification and production evidence:

- Full Vitest: 134 files, 1342 tests passed.
- Full configured ESLint and webpack production build passed.
- Native-navigation Playwright: iPhone 14 11/11 and iPhone 15 Pro Max 11/11.
- Reader-typography Playwright: iPhone 14 6/6 and iPhone 15 Pro Max 6/6.
- `git diff --check` passed.
- OpenNext deployed Worker version
  `683beaa5-e2e1-46b2-aa18-28d929ba1410` to `881817.xyz/*`.
- Production root and all 10 discovered JS/CSS assets returned HTTP 200.
- Production reader-typography Playwright passed 6/6 on iPhone 14; the two
  critical reader close/root-history navigation cases passed 2/2.
- Production CSS contains `readerMenuWakeButtonCollapsed`, `text-align:start`,
  and `right:-10px`; production JS contains `data-txt-reader` and `justifyText`.

The current production screenshots are under:

- `test-results/native-navigation/reader-typography-english--90aa4-s-natural-default-alignment-iphone-14/english-default.png`
- `test-results/native-navigation/reader-typography-final-TX-6b3a1-e-collapsed-menu-affordance-iphone-14/final-content-clearance.png`
- `test-results/native-navigation/reader-typography-paged-TX-b5eda-nt-and-horizontal-page-flow-iphone-14/paged-default.png`

These iPhone-sized production screenshots were reviewed and are clean. Physical
iPhone Safari/PWA confirmation remains a non-blocking device risk. Phase 2 was
completed afterward as recorded below.

## UI Quality Roadmap Phase 2: Global Chrome (2026-07-14)

Phase 2 of `docs/superpowers/plans/2026-07-14-ui-quality-roadmap.md` is complete.
The approved design is
`docs/superpowers/specs/2026-07-14-global-chrome-design.md`, and the executed
plan is `docs/superpowers/plans/2026-07-14-global-chrome-implementation.md`.

Implementation commit: `c692cc9` (`style: distill global navigation chrome`).

Implemented behavior:

- Root titles are 34px/750 instead of 40px/800.
- The persistent bottom bar is 60px high with an 8px safe-area offset, 22px
  radius, one hairline, one soft shadow, and no decorative top glint.
- The full active capsule was replaced by a shared Motion track whose visible
  material is a centered 24px by 2px tint line.
- Active state now combines `aria-current="page"`, tint, label weight, icon
  treatment, and the moving line. A selector-specificity defect found during
  screenshot review was fixed so newly tapped destinations stay tinted.
- Icons are 24px, labels are 11px, and every tab plus existing root-header
  action retains at least a 44px target.
- Root content and library batch-bar clearance now use shared navigation tokens
  and preserve the safe-area calculation.
- The three destinations, persistent roots, handlers, Motion spring, history,
  reader presentation, edge Back, and reduced-motion architecture are unchanged.

Verification and production evidence:

- Focused chrome/motion/navigation coverage: 9 files, 97 tests passed.
- Full Vitest: 135 files, 1346 tests passed.
- Full configured ESLint and webpack production build passed.
- Native-navigation Playwright: iPhone 14 12/12 and iPhone 15 Pro Max 12/12.
- Reader-typography regression: iPhone 14 6/6 and iPhone 15 Pro Max 6/6.
- `git diff --check` passed and generated artifacts remained ignored.
- OpenNext deployed Worker version
  `b7865b31-c91d-410b-9a97-5db37c37dfad` to `881817.xyz/*`.
- Production root and all 10 discovered JS/CSS assets returned HTTP 200.
- Production CSS contains `--root-tab-height:60px`, the 24px/2px active line,
  and the quiet 2px/8px shadow; production JS contains `aria-current`,
  `root-tab-indicator`, and `data-navigation-tab`.
- Production iPhone 14 chrome, focus return, root scroll preservation, and
  frame-cadence coverage passed 4/4.

The current production screenshots are under:

- `test-results/native-navigation/native-navigation-root-chr-87d2b-emantic-and-safely-tappable-iphone-14/chrome-library.png`
- `test-results/native-navigation/native-navigation-root-chr-87d2b-emantic-and-safely-tappable-iphone-14/chrome-reading.png`
- `test-results/native-navigation/native-navigation-root-chr-87d2b-emantic-and-safely-tappable-iphone-14/chrome-settings.png`

All three production screenshots were reviewed and are clean. Physical iPhone
Safari/PWA confirmation remains a non-blocking device risk. Phase 3 was
completed afterward as recorded below.

## UI Quality Roadmap Phase 3: Reading Low-Data Experience (2026-07-14)

Phase 3 of `docs/superpowers/plans/2026-07-14-ui-quality-roadmap.md` is complete.
The approved design is
`docs/superpowers/specs/2026-07-14-reading-low-data-design.md`, and the executed
plan is
`docs/superpowers/plans/2026-07-14-reading-low-data-implementation.md`.

Implementation commit: `04e82e8` (`style: prioritize reading actions by data state`).
Screenshot-harness stabilization: `d61eaeb` (`test: stabilize reading dashboard screenshots`).

Implemented behavior:

- `阅读` remains a predictable root destination; it does not auto-open the
  latest book or change meaning based on stored data.
- A pure presentation builder selects `empty-library`, `imported-unread`,
  `active-reading`, or `populated-week` from book, progress, and reading-time
  inputs.
- Empty libraries show one open import action. A newly imported book shows
  start reading. Positive progress changes that action to continue reading.
- The primary book action always precedes the compact reading-goal row. The
  seven-day chart is absent until recorded minutes make it informative.
- File format and byte size were removed from the Reading root. Progress is
  shown once, semantically, and only after reading has begun.
- Existing book-open/import/goal handlers, IndexedDB persistence, reading-time
  calculations, goal math, chart math, Motion behavior, and reduced-motion
  policy remain unchanged.

Verification and production evidence:

- Focused presentation/composition coverage: 3 files, 13 tests passed.
- Full Vitest: 136 files, 1352 tests passed.
- Full configured ESLint and webpack production build passed.
- Full local Playwright: 44/44 across iPhone 14 and iPhone 15 Pro Max, including
  native navigation 12/12 per device, reader typography 6/6 per device, and
  reading dashboard 4/4 per device.
- Impeccable's targeted scan of `ReadingDashboard.tsx` and `page.module.css`
  reported no anti-patterns. URL scanning was unavailable because Puppeteer is
  not a project dependency; no dependency was added for the scan.
- `git diff --check` passed and generated artifacts remained ignored.
- OpenNext deployed Worker version
  `a18a4a43-6aac-4a0f-acb1-3fb403744a93` to `881817.xyz/*`.
- Production root and all 10 discovered JS/CSS assets returned HTTP 200. The
  server HTML contains `data-reading-dashboard-state="empty-library"`, the
  primary-state locator, the new empty copy, and the import action.
- Production iPhone 14 native-navigation plus reading-dashboard coverage passed
  16/16. A final focused rerun passed all four dashboard states after the
  screenshot harness began waiting for the shared cover transform to settle.

The production dashboard screenshots are under the four
`test-results/native-navigation/reading-dashboard-*-iphone-14/` directories as
`reading-empty.png`, `reading-unread.png`, `reading-active.png`, and
`reading-week.png`. All four were reviewed in their final settled state and are
clean. Physical iPhone Safari/PWA confirmation remains a non-blocking device
risk. Phase 4 was completed afterward as recorded below.

## UI Quality Roadmap Phase 4: Book-First Library (2026-07-14)

Phase 4 of `docs/superpowers/plans/2026-07-14-ui-quality-roadmap.md` is complete.
The approved design is
`docs/superpowers/specs/2026-07-14-library-book-first-design.md`, and the
executed plan is
`docs/superpowers/plans/2026-07-14-library-book-first-implementation.md`.

Implementation commit: `0e56e9c` (`style: make library book-first`).

Implemented behavior:

- The Library root now begins with the shelf. The former standalone Collections
  row is a compact trailing action in the shelf heading and keeps its existing
  handler, active filter, and count context.
- Grid and list modes share a deterministic presentation model for unread,
  active, and finished books.
- List rows now lead with cover, title, source fallback, recent-reading label,
  and semantic progress. File format and byte size remain available in book
  details rather than competing on the Library root.
- Source fallback uses the filename stem only when it adds information beyond
  the title; otherwise it says `本地图书`. No author metadata was invented
  because `BookRecord` does not currently store an author.
- Active and finished list rows use one compact 4px progress track. Unread books
  show only their semantic unread label; the grid remains deliberately quieter.
- Import, search, grid/list mode, editing, selection, book actions, groups,
  collection filters, pagination, focus return, Motion, and existing persistence
  behavior remain intact.

Verification and production evidence:

- Focused presentation/source coverage: 4 files, 12 tests passed.
- Full Vitest: 137 files, 1357 tests passed.
- Full configured ESLint and webpack production build passed.
- Full local Playwright: 48/48 across iPhone 14 and iPhone 15 Pro Max.
- Impeccable's targeted Library source/CSS scan reported no anti-patterns.
- `git diff --check` passed and generated artifacts remained ignored.
- OpenNext deployed Worker version
  `166f1808-08e0-43e6-be4f-bb81f05bb0f6` to `881817.xyz/*`.
- Production root and all 10 discovered JS/CSS assets returned HTTP 200.
- Production book-first grid/list states passed on both phone projects. iPhone
  14 native navigation passed in the first run; iPhone 15 native navigation
  passed 12/12 on a focused rerun after a transient `ERR_CONNECTION_CLOSED`.
  Both the custom domain and Workers URL then returned 200 in three consecutive
  checks, confirming the interruption was transport-level rather than UI-level.

Production screenshots are under the two
`test-results/library-book-first-*-iphone-*/` directories as
`library-grid-unread.png` and `library-list-active.png`; both phone sizes were
reviewed and are clean. Physical iPhone Safari/PWA confirmation remains a
non-blocking device risk.

## Accessibility and Interaction Hardening (2026-07-14)

Design commit: `8c7fa5b`. Implementation commit: `ce0bdad`.

Phase 5 of `docs/superpowers/plans/2026-07-14-ui-quality-roadmap.md` is complete:

- The shared visual system now exposes scalable caption, footnote, body,
  headline, and title tokens plus theme-aware focus, success, and error colors.
- Keyboard focus has one visible 3px treatment across light, dark, sepia, and
  custom ambient backgrounds; clipped book targets use an inset variant.
- Library view mode exposes pressed state. List rows now use separate native
  buttons for opening/selecting a book and opening More actions, preserving
  focus return, selection, Motion, and shared-cover behavior.
- Ask AI and backup/model feedback expose busy, status, alert, label, and native
  button semantics. The AI model row no longer nests a simulated button inside
  another button.
- Frequent compact controls meet the 44px target contract. Library metadata and
  action groups wrap under enlarged text, and the daily path remains usable at
  200% browser text size without horizontal overflow.
- Existing reduced-motion, software-keyboard, safe-area, theme, import, reader,
  and navigation behavior remains covered by regression tests.

Verification and production evidence:

- Full Vitest: 138 files, 1362 tests passed.
- Full configured ESLint and webpack production build passed.
- Full local Playwright: 56/56 across iPhone 14 and iPhone 15 Pro Max.
- Impeccable's targeted changed-source scan returned no findings; `git diff
  --check` passed.
- OpenNext deployed Worker version
  `8a227c89-47f4-4e41-9dd3-fc3178e100b2` to `881817.xyz/*`.
- Production root and all 10 discovered JS/CSS assets returned HTTP 200.
- Production accessibility hardening passed 8/8 across both phone projects;
  production native navigation passed 12/12 on iPhone 14.

Physical iPhone Safari/PWA confirmation remains a non-blocking device risk. The
next roadmap item is Phase 6: final Impeccable critique, score gate, complete
repository/production verification, and closeout.

## UI Quality Final Critique and Closeout (2026-07-14)

All six phases in
`docs/superpowers/plans/2026-07-14-ui-quality-roadmap.md` are complete.

Final critique evidence:

- The archived critique is
  `.impeccable/critique/2026-07-14T13-33-07Z__app.md`.
- Design health improved from 26/40 with four P1 findings to 32/40 with no P0
  or P1 findings. The release gate is satisfied.
- The final Impeccable CLI scan of `app` returned exit code 0 and JSON `[]`.
- The final browser-overlay connection could not initialize and twice returned
  `Cannot redefine property: process`; no overlay injection was claimed.
  Production iPhone 14 screenshots for Library, Reading, Settings, Reader, and
  Sheet supplied the visual fallback evidence.
- Remaining critique items are non-blocking: quiet the reader menu affordance
  further, add lightweight first-use discovery, and distill low-frequency
  Settings content. They are P2/P3 follow-up opportunities, not open roadmap
  requirements.

Final verification:

- Full Vitest passed again: 138 files, 1362 tests.
- Full configured ESLint and webpack production build passed again.
- Full local Playwright passed again: 56/56 across iPhone 14 and iPhone 15 Pro
  Max.
- Production root and all 10 discovered JS/CSS assets returned HTTP 200.
- The final full production Playwright run passed 53/56 on its first long run;
  the three failures all landed on Chromium's own `This page couldn't load`
  transport page before any app DOM existed. The custom domain and Workers URL
  then each returned 200 three consecutive times, and the exact three failed
  cases passed 3/3 unchanged on focused rerun. No application fix was needed.
- Final implementation commit remains `ce0bdad`; final deployed Worker remains
  `8a227c89-47f4-4e41-9dd3-fc3178e100b2`.

The UI quality goal is closed. Physical iPhone Safari/PWA and real VoiceOver
confirmation remain non-blocking device risks. The unresolved EPUB dark-mode
transparent ambient white rectangle still requires the affected EPUB or Safari
Web Inspector evidence before any additional CSS work.

## Themed Reading Goal Ring (2026-07-14)

Design commit: `a61a474`. Implementation plan commit: `f925231`.
Implementation commit: `9f6beee`.

Implemented behavior:

- The compact `阅读 > 今日阅读` goal ring now follows the user's supplied
  references: a cyan open-bottom U-shaped arc, centered current minutes, and
  the target minutes below it.
- Light mode uses a white circular surface, fine gray rim, cyan current value,
  and black target value. Dark mode uses a dark circular surface, restrained
  light rim, cyan current value, and white target value.
- The ring is an inline SVG rather than a raster asset, so it remains crisp at
  every device scale. A permanent base arc preserves the supplied zero-state
  appearance, while a brighter overlay communicates actual goal progress.
- Goal editing, IndexedDB persistence, reading-time totals, dashboard state,
  navigation, and surrounding button semantics are unchanged.

Verification and production evidence:

- Focused source/presentation coverage passed: 2 files, 10 tests.
- Full Vitest passed: 138 files, 1363 tests.
- Full configured ESLint and webpack production build passed.
- Full local Playwright passed: 58/58 across iPhone 14 and iPhone 15 Pro Max.
- Impeccable's changed-source detector returned exit code 0 and JSON `[]`.
- `git diff --check` passed.
- OpenNext deployed Worker version
  `36f48759-2b50-4a53-af54-c6800d72355f` to `881817.xyz/*`.
- Production root and all 10 discovered JS/CSS assets returned HTTP 200. The
  root serves page chunk `/_next/static/chunks/app/page-aeb21d9870321949.js`.
- The production light/dark goal-ring Playwright case passed 2/2 across both
  phone projects. Both production screenshots were inspected and match the
  supplied light/dark visual direction.

The goal-ring change is complete. Physical iPhone Safari/PWA confirmation
remains a non-blocking device risk.

## Quieter Reader Menu Affordance (2026-07-15)

Design commit: `8306ecc`. Implementation plan commit: `bf7d399`.
Implementation commit: `0f8ec52`. Browser coverage commit: `a4a8a29`.

Implemented behavior:

- The always-available reader menu toggle remains one native 48px by 48px
  button with the existing `onWakeMenu`, `aria-expanded`, and open/close path.
- When reader chrome is closed, only a narrower right-edge surface is painted.
  The collapsed surface has no shadow, uses a lower-contrast theme-aware fill
  and border, and renders a smaller, quieter menu glyph.
- When reader chrome is open, the same button keeps its complete circular
  surface, stronger glyph, border, shadow, and press feedback.
- State transitions reuse the existing motion tokens. Reduced-motion mode
  removes the new interpolation while preserving the static collapsed cue.
- No timers, scroll listeners, persistence, onboarding state, reader layout,
  EPUB publisher styles, menu behavior, or gesture ownership changed.
- UI quality roadmap Phases 1 through 6 remain closed.

Verification and production evidence:

- TDD red/green was observed against `lib/readerMenuIntegration.test.ts`.
- Focused reader-menu/chrome/motion/ambient coverage passed: 9 files, 136 tests.
- Full Vitest passed: 138 files, 1363 tests.
- Full configured ESLint, webpack production build, and `git diff --check`
  passed.
- Full local Playwright passed 60/60: iPhone 14 30/30 and iPhone 15 Pro Max
  30/30. Both sizes' light collapsed, dark collapsed, expanded, and final-text
  clearance evidence was reviewed; the cue is quieter without losing its
  safe-area placement or clear expanded state.
- OpenNext deployed Worker version
  `a39a32bb-7746-4c5b-af13-d01df15f0c0e` to `881817.xyz/*`.
- Production root and all 10 discovered JS/CSS assets returned HTTP 200. The
  deployed reader CSS is `/_next/static/css/f78ad7e31e86a679.css`; the page
  chunk remains `/_next/static/chunks/app/page-aeb21d9870321949.js`.
- Production focused reader-menu coverage passed 3/3 on iPhone 14 and 3/3 on
  iPhone 15 Pro Max. Production light, dark, expanded, and final-text evidence
  was reviewed on the larger device and matches the local approved result.

Physical iPhone Safari/PWA confirmation remains a non-blocking device risk.
The evidence-gated EPUB dark ambient rectangle remains unchanged and must not
resume without the affected EPUB or Safari Web Inspector evidence.

## Library Featured Reading (2026-07-15)

Approved design:
`docs/superpowers/specs/2026-07-15-library-featured-reading-design.md`
(`5eaf3a3`). Executed plan:
`docs/superpowers/plans/2026-07-15-library-featured-reading-implementation.md`
(`91a8450`).

Implementation and verification commits:

- `48e9791` selects the truthful recent-reading candidate.
- `7620704` models the featured shelf presentation.
- `4b093c1` adds the feature surface.
- `0f3532b` preserves the stable current-view return origin.
- `c81a868`, `9f1a225`, and `d9463a5` verify and harden the feature and the
  existing active list.
- `31b082a` keeps the accessibility browser case representative after the
  single opened book is promoted into the feature. It generalizes the import
  fixture, synchronizes on the live cover count/first-row locator, and imports
  a second book so the existing live More locator can resolve the remaining
  shelf action. It changes only the E2E test; no product code or behavior
  changed.

Implemented behavior:

- Eligibility uses truthful `lastOpenedAt` only. An imported unread book is
  not promoted by import/update time or inferred progress.
- The feature appears only on the neutral all-books Library root. Search,
  group filtering, and edit/selection mode restore the complete working shelf.
- Exactly one eligible book is featured and removed from the `其他书籍` shelf,
  so the same book is never duplicated.
- The feature is one native continuation button with one click path. It uses
  the shared stable `library-${view.mode}-${featuredBook.id}` current-view
  origin so reader close returns focus correctly.
- The layout is theme-aware and preserves the existing grid/list model. State
  motion is bounded to 200ms and has the existing reduced-motion branch.
- No dependency, persisted metadata, database schema, or invented author data
  was added.

Fresh local verification:

- Focused Vitest command covering the requested Library selector/model/surface,
  selection, incremental-list, and shared-transition paths passed 12 files / 48
  tests.
- Full Vitest passed 141 files / 1375 tests.
- Full configured ESLint, normal webpack production build, standalone webpack
  production build, OpenNext build, and `git diff --check` passed.
- The initial full browser run exposed one stale accessibility fixture: after
  its only book was opened, that book correctly became the feature and there
  was no remaining shelf More action. The 34/35 red result was preserved, the
  fixture was corrected in `31b082a`, and the focused case then passed 1/1 on
  both phone projects without weakening its keyboard, focus, or dialog checks.
- Final full local Playwright passed 35/35 on iPhone 14 and 35/35 on iPhone 15
  Pro Max (70/70 total) against a verified local `next start` server on an
  unused port. Only that server process was stopped afterward.

Production deployment and evidence:

- Before the standalone build, PowerShell resolved the workspace root as
  `C:\aaa\ai-reader-pwa` and constructed the absolute generated targets
  `C:\aaa\ai-reader-pwa\.next` and
  `C:\aaa\ai-reader-pwa\.open-next`. For each target, the parent matched the
  workspace root, the target did not equal the root, and the leaf matched the
  allowlist (`.next` or `.open-next`). Only after those checks passed,
  `Remove-Item -LiteralPath ... -Recurse -Force` removed those two generated
  directories. No `git clean` or `git reset` was used. A later non-destructive
  rerun reproduced the same direct-child checks and performed no deletion.
- OpenNext deployed Worker `ai-reader-pwa` version
  `ff701748-184d-4c32-8941-ce09745fe557` to route `881817.xyz/*`.
- The initial Cloudflare static-asset upload needed one automatic retry, then
  uploaded all 3 changed assets, completed deployment, and passed every
  production check below. Treat this as a deployment reliability note, not a
  product failure.
- `https://881817.xyz` returned 200 (`text/html`, 17153 bytes). Every asset
  discovered from that HTML returned 200 with the expected content type and a
  nonzero length: 8 JavaScript chunks and 2 CSS files (10 total).
- The deployed page chunk is
  `/_next/static/chunks/app/page-336ba40ae6165dd1.js`; deployed CSS includes
  `/_next/static/css/417b1b08d96e4c93.css`. The live bundles contain
  `data-library-featured` and `.libraryFeaturedButton`; production Playwright
  confirms the continuation, `其他书籍`, exact shelf, and stable focus-return
  behavior.
- Production `e2e/library-book-first.spec.ts` passed 7/7 on iPhone 14. The
  critical native reader-close source-focus case passed 1/1 separately.
- The final production light, dark, and active-list screenshots were inspected
  at original resolution and are clean. These paths record evidence from this
  verification run, but `test-results/` is gitignored and ephemeral; later
  Playwright runs may remove or replace them, so they are not durable artifacts:
  - `test-results/native-navigation/library-book-first-one-act-6bd6d-e-above-the-remaining-shelf-iphone-14/library-featured-light.png`
  - `test-results/native-navigation/library-book-first-capture-cbe25-d-reading-in-the-dark-theme-iphone-14/library-featured-dark.png`
  - `test-results/native-navigation/library-book-first-list-sh-966bb-ading-and-semantic-progress-iphone-14/library-list-active.png`

UI quality roadmap Phases 1 through 6 remain closed. Physical iPhone
Safari/PWA and real VoiceOver checks remain non-blocking device risks. The
unresolved dark EPUB ambient white rectangle was not touched; do not resume
speculative CSS work without the affected EPUB or Safari Web Inspector
evidence.

## EPUB Page Count Correctness (2026-07-16)

Approved design and implementation plan:

- `docs/superpowers/specs/2026-07-16-epub-page-status-design.md`
- `docs/superpowers/plans/2026-07-16-epub-page-status-implementation.md`
- documentation commit `6fe098b`; implementation commit `c1be7b1`.

Root cause and behavior:

- The reader previously initialized every EPUB with a numeric `1/1` and did
  not distinguish unknown page information from a real one-page book.
- epub.js exposes an empty page-list as `firstPage = 0`, `lastPage = 0`, and a
  relocated `page = -1`; the previous validation normalized that invalid
  combination into `1/1`.
- During `locations.generate`, epub.js also appends partial locations before
  setting the final zero-based `locations.total`. Relocation during that window
  could publish another false `1/1` result.
- EPUBs now display `正在计算页数…` until the whole-book location table is
  complete. Invalid empty page-list defaults are rejected, generated location
  totals convert their final index to a count with `+1`, and generation failure
  displays `页数未知` instead of fake numbers. Publisher page-lists remain
  authoritative, TXT page calculation is unchanged, and the TOC header shares
  the same status-aware formatter.

Verification:

- TDD observed focused failures for both status labels, the total-index
  conversion, empty page-list defaults, and the async generation lifecycle.
- Focused page/menu tests pass 2 files / 21 tests; the broader reader regression
  set passes 23 files / 261 tests.
- A generated twelve-chapter EPUB first reproduced the screenshot's `1/1`
  failure on both configured mobile viewports. After the final fix,
  `e2e/epub-page-info.spec.ts` passes 2/2 on iPhone 14 and iPhone 15 Pro Max,
  verifies the calculating state, resolves to a total greater than one, and
  rejects any intermediate `1/1` label.
- Fresh full Vitest passes 146 files / 1393 tests; full ESLint and
  `next build --webpack` pass. Temporary local servers are stopped.

This fix is now pushed and deployed in Worker version
`91d582c4-46b9-41d2-b1e9-76f0fcc729a4`. The old-Android import failure is also
resolved: imports, group creation, annotations, and AI provider creation use a
callable UUID check or the shared local-ID fallback.

## Motion Detail Polish (2026-07-15)

Approved design:
`docs/superpowers/specs/2026-07-15-motion-detail-polish-design.md`
(`204909a`). Executed plan:
`docs/superpowers/plans/2026-07-15-motion-detail-polish-implementation.md`
(`fda4867`).

Implementation commits:

- `556fd63` centralizes initial focus, Tab containment, app-shell background
  inert ownership, and post-exit focus restoration in `MotionSheet`.
- `7b76004` shortens reader enter/exit to 300/220ms, removes inherited exit
  delay, and introduces Library progress-settle feedback.
- `4c2fae6` keeps first-use reader controls expanded until the first explicit
  toggle and stores that discovery with a resilient local marker.
- `056652c` aligns TypeScript/CSS duration roles and gives TXT/EPUB swipe
  settle one pure duration owner.
- `b3c2638` adds browser coverage for generic sheet focus/isolation, first-use
  discovery persistence, and the existing reader close/focus-return loop.
- `1b9036a` responds to the final detector warning by rendering progress from
  a semantic CSS custom property through `scaleX`, avoiding width-layout
  animation while preserving the 200ms state feedback.

Implemented behavior:

- Every shared sheet focuses inside, keeps Tab and Shift+Tab inside the active
  panel, isolates app-shell siblings with `inert`, and restores a connected
  opener only after the exit completes. Reading Goal now uses the shared
  contract instead of a one-off focus trap.
- The shared-cover transition remains the reader signature moment. Opening is
  300ms; closing is 220ms and begins immediately without the prior entrance
  delay leaking into exit.
- Featured and list Library progress now settle over the 200ms local-state
  role using `transform: scaleX(...)`, with the existing global reduced-motion
  policy.
- Fresh users see expanded reader controls until their first explicit toggle.
  Automatic scroll, page-turn, and hide events cannot collapse the controls
  before discovery. Returning users keep the prior quiet auto-hide behavior.
- Motion roles for press, state, navigation, sheets, reader, chrome, gesture
  settle, and reduced crossfade live in `lib/motionSystem.ts`; a parity test
  locks the mirrored CSS variables. TXT and EPUB swipe settle both use
  `getReaderSwipeSettleDuration`.

Fresh local verification:

- Focused motion-detail Vitest passed 14 files / 73 tests.
- Full Vitest passed 146 files / 1388 tests.
- Full configured ESLint and `next build --webpack` passed.
- Targeted Impeccable detection returned `[]` after progress changed from
  width transition to transform scaling.
- `e2e/native-navigation.spec.ts` passed 13/13 on iPhone 14 and 13/13 on
  iPhone 15 Pro Max. It covers shared-sheet focus and inert isolation,
  first-use reader controls, reader close/source focus, navigation, reduced
  motion, and frame cadence.
- Final production-build Library coverage passed 7/7 on iPhone 14 and 7/7 on
  iPhone 15 Pro Max, including active list progress and light/dark featured
  states. Temporary local servers were verified stopped afterward.

This motion-detail batch is now included in deployed Worker version
`91d582c4-46b9-41d2-b1e9-76f0fcc729a4`. Physical iPhone Safari/PWA and real
VoiceOver remain non-blocking device risks.

## Current Feature Work

The active PR adds and iterates custom reader backgrounds.

Implemented behavior:

- Settings > Background now supports:
  - `跟随图书`
  - `自选图片`
- User can choose an image from settings.
- Custom background image is stored locally through the existing IndexedDB flow.
- The app can remove or replace the selected background image.
- Custom background mode feeds `AmbientBookBackground` through:
  - `customBackgroundBlob`
  - `customBackgroundOpacity`
- Existing book-cover ambient background logic still works when `跟随图书` is selected.

Important files:

- `app/SettingsSurface.tsx`
- `app/CustomBackgroundSettingsSheet.tsx`
- `app/useCustomBackground.ts`
- `app/AmbientBookBackground.tsx`
- `app/page.tsx`
- `app/page.module.css`
- `lib/appPreferences.ts`
- `lib/db.ts`
- `lib/settingsSurface.test.ts`
- `lib/ambientBookBackground.test.ts`
- `lib/appPreferences.test.ts`

## Latest UI Decisions

The user asked for the custom-background controls to be moved out of the main settings list into a separate sheet.

Current intended sheet behavior:

- The main settings list only shows the background mode rows.
- Tapping an already-selected `自选图片` row opens a dedicated custom background sheet.
- The custom background sheet is a near-full-height bottom sheet, not a floating card.
- It uses an opaque `var(--app-bg)` page background so the settings page underneath does not show through.
- It uses a solid `var(--surface-primary)` card for the controls.
- Header stays at the top; body scrolls internally.
- It should feel closer to iOS Settings than a decorative modal.

Current intended preview behavior:

- The preview image is rendered as an `<img>`, not a cropped CSS background.
- `object-fit: contain` is required so the selected image is fully visible.
- The preview must respond to the opacity slider.
- The slider meaning is the actual background effect strength:
  - `0%`: image is clear, no blur, no ambient veil.
  - `100%`: image uses the same 42px blur and veil effect as the actual app background.
  - Intermediate values update in real time.
- The latest fix adds `customBackgroundPreviewStyle` with:
  - `--custom-background-preview-blur`
  - `--custom-background-preview-veil-opacity`

Do not change the slider to control image opacity. The user explicitly clarified that the slider controls the actual background effect, not the source image opacity.

## Latest AI Settings Work

The same PR now also improves AI provider setup.

Implemented behavior:

- AI provider configuration uses provider presets as the only visible protocol chooser.
- Presets currently include:
  - OpenAI / Compatible API
  - Anthropic / Compatible API
  - Google Gemini
  - OpenRouter
  - xAI
- The lower `API 格式` list was removed because it duplicated the provider presets.
- Choosing a preset immediately updates the provider name, protocol, API address, default path, and visible input value.
- Known default API addresses are replaced when switching presets.
- Custom proxy hosts are still preserved by the lower-level format helpers when used by saved/manual provider flows.
- `自动附加 /v1` now materializes the path into the visible/saved API address.
- Old saved OpenAI configs like `https://api.openai.com` plus auto-append enabled load as `https://api.openai.com/v1`.

Important files:

- `app/AiSettingsSheet.tsx`
- `lib/aiProviders.ts`
- `lib/aiProviders.test.ts`
- `lib/aiSettingsSheetIntegration.test.ts`
- `lib/aiChat.ts`
- `lib/aiModelList.ts`

Latest Ask AI reader-context fix:

- The reader Ask AI sheet now keeps visible conversation history instead of
  replacing the prior response with a single answer card.
- Sending a message clears the input immediately after validation.
- Follow-up requests send prior user/assistant messages to `/api/chat`, and
  `buildChatMessages` preserves that history before the current contextual
  question.
- Ask AI now sends current reading context, not only the book title:
  - TXT uses visible paragraph intersection from the mounted reader body.
  - EPUB exposes `EpubReaderHandle.getVisibleText()` and reads the current
    rendered iframe contents, preferring visible blocks and falling back to the
    rendered body text.
- Opening or deleting the active book resets the Ask AI conversation to avoid
  leaking context across books.
- New coverage was added in:
  - `lib/askAiReaderContextIntegration.test.ts`
  - `lib/aiChat.test.ts`
- The page-level state/logic lives in `app/useAskAi.ts` so `app/page.tsx`
  stays under the orchestration size guard.

Latest Ask AI layout and EPUB resume fix:

- The Ask AI sheet no longer renders the book-title prompt above the input.
- The Ask AI composer now stays fixed at the bottom of the sheet while the
  conversation thread scrolls independently.
- The Ask AI sheet has a dedicated `askBottomSheet` layout; its `sheetBody`
  no longer owns the scroll for this surface.
- EPUB reopen/resume now falls back to `rendition.display()` when the saved
  locator cannot be displayed, instead of showing `The object can not be found
  here.` and leaving a blank reader.
- Regression coverage was added in:
  - `lib/askAiReaderContextIntegration.test.ts`
  - `lib/epubAmbientIntegration.test.ts`

Latest reliability and security hardening:

- Backup format is now version 2 and includes daily reading stats, custom
  background data, book groups, and current AI provider configuration without
  API keys.
- Restore validates and decodes the complete backup before changing data, then
  replaces reader data in one Dexie transaction. Invalid nested content no
  longer clears the existing library first.
- Version 1 backups remain supported and preserve newer stats/background stores
  that old backups do not contain.
- Restored stats and custom backgrounds refresh in the current UI immediately.
- `/api/chat` and `/api/models` reject private, loopback, local-domain,
  credential-bearing, and non-HTTPS production upstream URLs. Redirects are
  disabled; request size, response size, and upstream duration are bounded.
- Ask AI aborts in-flight requests when the conversation resets or the book
  changes, ignores stale responses, keeps only the latest 20 history messages
  in model requests, and auto-scrolls the conversation thread.
- App preferences, reading goal, and AI provider storage writes tolerate
  unavailable/quota-limited localStorage.
- Service Worker cache is now `ai-reader-v5`, replacing stale `v4` resources.
- Main implementation files include `lib/backup.ts`, `lib/db.ts`,
  `lib/aiRequestSecurity.ts`, `app/useAskAi.ts`, and both AI API routes.

Latest iPhone book-storage reliability fix:

- Root cause/risk: books were persisted as file-backed `Blob` values directly
  inside IndexedDB metadata records. WebKit has had iOS regressions reading
  IndexedDB Blobs after restart, including iOS 18.4.x.
- IndexedDB schema is now version 5 with a separate `bookFiles` table.
- Book and cover bytes are persisted as `ArrayBuffer` plus MIME type. Runtime
  reads reconstruct normal Blob objects for epub.js and existing callers.
- Existing Blob-based book records migrate lazily on their first successful
  read; metadata is rewritten without Blob fields after the new binary record
  is committed.
- Delete, clear-all, backup restore, and replacement transactions include
  `bookFiles`, so binary records cannot become orphaned.
- Startup and import request `navigator.storage.persist()` when supported.
  Safari may still decline; persistent storage is browser-controlled.
- Initial library timeout increased from 2 seconds to 15 seconds so large
  first-run migrations are not incorrectly reported as failed.
- An already-corrupted/unreadable old Blob cannot be reconstructed and must be
  imported once again. New/reimported books use the ArrayBuffer format.
- Coverage: `lib/db.test.ts` verifies raw metadata contains no file Blob,
  `bookFiles.fileData` is ArrayBuffer, and legacy records migrate with matching
  bytes. `lib/storagePersistence.test.ts` covers persistent/best-effort states.

Latest EPUB whole-book page-indicator and scrollbar fix:

- The earlier `bff319b` fix used epub.js `displayed.page/total`, but those are
  section-local values. A user screenshot correctly showed `2/2页` on the
  front matter instead of the total number of pages in the book.
- `cf659a4` now prefers the EPUB publisher's page-list when available. Its
  first/last printed pages form the whole-book total.
- For normal reflowable EPUBs without a page-list, the reader generates a
  whole-book CFI locations table with a 360-character mobile-page target.
  `relocated.start.location / book.locations.total` drives the bottom page
  label, so it is one continuous count across chapters and updates on scroll
  and page turns. The old chapter-local `displayed.page/total` is never used
  as a fallback.
- The visible gray bar is on epub.js's outer `.epub-container`, not inside the
  iframe. CSS now hides that container's scrollbar through `scrollbar-width`,
  the WebKit zero-size rule, and transparent track/thumb fallbacks, while
  preserving continuous scrolling.
- Regression coverage: `lib/readerPageInfo.test.ts` covers publisher page-list
  and whole-book locations; `lib/epubAmbientIntegration.test.ts` covers the
  outer epub.js scrollbar rules.
- There is no local EPUB fixture, so final visual confirmation still requires
  an iPhone test with the user's book. Production assets were inspected after
  deploy to confirm both changes are present.
- Windows OpenNext note: the wrapper's nested `npm run build` can stop before
  producing `.open-next/worker.js`. A plain `npm.cmd run build` also does not
  create `.next/standalone`, so `--skipNextBuild` will fail unless standalone
  mode is enabled for that build. Use this exact PowerShell sequence:

  ```powershell
  $env:NEXT_PRIVATE_STANDALONE='true'
  $env:NEXT_PRIVATE_OUTPUT_TRACE_ROOT=(Get-Location).Path
  npm.cmd run build
  node node_modules\@opennextjs\cloudflare\dist\cli\index.js build --skipNextBuild
  node node_modules\@opennextjs\cloudflare\dist\cli\index.js deploy
  ```

Latest follow-up hardening:

- Backup import now dismisses and clears any in-memory reader, TOC, progress,
  paragraph, and Ask AI state after replacing the library. The app no longer
  keeps a stale pre-restore book object that may not exist in restored data.
- Legacy AI settings save/clear now tolerate blocked or quota-limited
  localStorage, including version 1 backup restore paths.
- Safe AI upstream validation errors now reach the UI with a useful reason
  instead of the generic `AI request failed` message.
- Incoming API request bodies are read as a byte stream and cancelled as soon
  as they exceed the limit, including chunked requests without Content-Length.
- Service Worker runtime caching is bounded to 80 non-pinned entries. Cache
  quota/storage failures no longer hide an otherwise successful network
  response.
- Regression coverage was added in `lib/backupUiIntegration.test.ts`,
  `lib/aiRequestSecurity.test.ts`, `lib/aiSettings.test.ts`, and
  `lib/serviceWorkerUpdate.test.ts`.

Recent browser smoke evidence:

- Anthropic preset updates the visible API address to `https://api.anthropic.com/v1`.
- Gemini preset updates it to `https://generativelanguage.googleapis.com/v1beta`.
- OpenRouter preset updates it to `https://openrouter.ai/api/v1`.

Motion polish added in the same work:

- Sheet close uses a shorter settle timing.
- Drag/backdrop dismissal feels less abrupt.
- Main settings rows, tab controls, custom background actions, provider rows, model rows, provider buttons, group chips, provider icons/checks/badges, and iOS switches now have consistent transform-based pressed feedback.

Latest reader settings UI polish:

- Reader theme/settings sheet now separates font size, page-flow, and theme controls.
- The top `小 / 大` controls adjust font size only and show a stable dot scale indicator.
- Page-flow and theme options now open compact popover menus instead of being mixed into the main layout.
- Theme preview cards are limited to light/dark previews; provider-like duplicate format options were removed from the relevant AI sheet.
- The custom settings entry uses a gear icon, not a sun/brightness icon.
- Reader settings typography was reduced to a normal menu scale.
- Custom reader settings now use a real text preview area bound to the live preview style.
- Custom layout sliders are grouped in a compact control card with fixed-size SVG icons for line height, letter spacing, word spacing, and page margin.
- Do not reintroduce character/emoji-built slider icons; iPhone Safari rendered those as oversized/colored/stacked glyphs.

Latest bottom sheet motion polish:

- Shared `BottomSheet` now has an explicit `settling` phase for non-dismissed drag release.
- A short downward drag that does not meet dismissal thresholds settles back to rest with `--motion-sheet-settle: 220ms` and `--ease-sheet-settle`.
- Settling sheets remain interruptible; grabbing during settle continues from the current visual transform instead of jumping.
- Reduced motion skips the visible settle and returns the sheet to `open` immediately.
- The change is intentionally scoped to transform/backdrop-opacity motion and does not redesign sheet content.
- Design and implementation plan docs were added:
  - `docs/superpowers/specs/2026-07-03-bottom-sheet-settle-motion-design.md`
  - `docs/superpowers/plans/2026-07-03-bottom-sheet-settle-motion.md`

Latest reader settings micro-press polish:

- Reader settings popover rows now animate their check and icon affordances with the row press.
- The custom settings entry gear icon now scales with the pill press.
- Reduced-motion coverage is ordered so popover affordances and the custom gear icon actually resolve to `transition: none` and `transform: none`.
- This is CSS-only and does not change reader settings layout or behavior.
- Design and implementation plan docs were added:
  - `docs/superpowers/specs/2026-07-03-reader-settings-micro-press-design.md`
  - `docs/superpowers/plans/2026-07-03-reader-settings-micro-press.md`

Latest library book press-depth polish:

- Library grid/list book covers now have a compositor-only transform transition.
- Pressing a grid book or list row gently nudges/scales the cover inside the already-scaling outer item.
- List-view more buttons now have transform-based press feedback and move subtly with the row press.
- Reduced-motion coverage disables the cover and more-button transforms.
- This is CSS-only and does not change book opening, selection, filtering, grouping, or action-sheet behavior.
- Design and implementation plan docs were added:
  - `docs/superpowers/specs/2026-07-03-library-book-press-depth-design.md`
  - `docs/superpowers/plans/2026-07-03-library-book-press-depth.md`

Latest bottom tab micro-lift polish:

- Bottom navigation labels now have a named `.tabLabel` motion target.
- The active tab icon and label sit with a subtle upward lift, so selected state reads through content position as well as color and the sliding indicator.
- Pressing a tab now makes the icon and label respond together: the outer tab compresses, the icon compresses, and the label settles downward.
- Reduced-motion coverage disables active and pressed tab icon/label transforms.
- This does not change navigation order, destinations, tab bar dimensions, or batch action bar behavior.
- Design and implementation plan docs were added:
  - `docs/superpowers/specs/2026-07-03-bottom-tab-micro-lift-design.md`
  - `docs/superpowers/plans/2026-07-03-bottom-tab-micro-lift.md`

Latest compact control press polish:

- Settings segmented control buttons now use compositor-only transform transitions.
- Library grid/list view toggle buttons now press with the same compact scale response as other touch controls.
- Collection rows and their nested row-main buttons now have subtle down-press motion.
- Editable collection row actions remain independent; the row-main motion does not wrap rename/delete buttons as one group.
- Reduced-motion coverage disables segmented, view-toggle, collection-row, and row-main transforms.
- This is CSS-only and does not change settings values, Library view mode logic, collection filtering, editing, creation, renaming, or deletion.
- Design and implementation plan docs were added:
  - `docs/superpowers/specs/2026-07-03-segmented-list-press-design.md`
  - `docs/superpowers/plans/2026-07-03-segmented-list-press.md`

Latest Library content transition polish:

- Library grid and list content containers now use a shared `libraryContentIn` enter animation.
- Switching between grid/list, or remounting content after filter/search state changes, now settles in with a restrained opacity + vertical transform rather than an abrupt swap.
- Reduced-motion coverage disables the content enter animation and transform.
- This is CSS-only and does not change Library view mode, search, filtering, grouping, pagination, import, or selected-book behavior.
- Design and implementation plan docs were added:
  - `docs/superpowers/specs/2026-07-04-library-content-transition-design.md`
  - `docs/superpowers/plans/2026-07-04-library-content-transition.md`

Latest Library selection affordance polish:

- Grid and list selection badges now transition background, border color, shadow, and transform together.
- Selected badges gain a subtle scale lift and stronger tint-colored shadow, so edit-mode selection reads as an elevated state indicator rather than only a static checkmark.
- Reduced-motion coverage disables selected-badge transforms and transitions.
- This is CSS-only and does not change edit-mode selection logic, batch actions, book layout, cover layout, or title layout.
- Design and implementation plan docs were added:
  - `docs/superpowers/specs/2026-07-04-library-selection-affordance-design.md`
  - `docs/superpowers/plans/2026-07-04-library-selection-affordance.md`

Latest collection active affordance polish:

- Active collection rows now read more clearly as the current Library filter.
- The active row keeps its subtle tint background and adds non-layout inset
  highlight/shadow.
- The active collection icon turns tint and scales slightly.
- The active chevron turns tint and shifts slightly right.
- Reduced-motion coverage disables the icon and chevron transforms/transitions.
- This is CSS-only and does not change collection filtering, creation, editing,
  renaming, deletion, row layout, or row height.
- Design and implementation plan docs were added:
  - `docs/superpowers/specs/2026-07-04-collection-active-affordance-design.md`
  - `docs/superpowers/plans/2026-07-04-collection-active-affordance.md`

Latest serious bug hardening:

- Antigravity/Opus 4.6 Thinking was used as an external bug hunter and flagged
  two serious issues: service-worker offline fallback resolving to `undefined`
  on cache miss, and immediate Blob URL revocation after export clicks.
- `public/sw.js` now waits for `caches.match(...)` and returns
  `Response.error()` when the cache also misses.
- `lib/serviceWorkerUpdate.test.ts` executes the service worker in a VM and
  verifies both navigation and static-resource offline cache misses return an
  error response.
- File export and backup export now use `triggerBlobDownload` from
  `lib/browserDownload.ts`.
- `triggerBlobDownload` appends a hidden anchor, clicks it, and delays
  `URL.revokeObjectURL` plus anchor removal for 30 seconds so mobile browsers
  have time to start the download.
- This does not change backup payloads, exported file contents, book import,
  service-worker registration, or UI layout.

Latest Reading dashboard week-bar polish:

- Antigravity was asked to act as an external UI-polish researcher, but the
  run stopped with `Insufficient AI Credits` before producing a recommendation
  or writing files. The final implementation was done locally in Codex.
- The Reading tab's seven-day bar chart now has a calmer data-state motion
  hierarchy.
- Day cells have a stable transform baseline.
- Bar fills enter from the bottom with `weekBarIn`.
- Today's bar has a stronger tint ring, subtle lift, and matching label lift.
- Reduced-motion coverage disables the added animation/transitions/transforms.
- This is CSS-only and does not change reading stats, labels, totals, goal
  behavior, or dashboard layout.
- Design and implementation plan docs were added:
  - `docs/superpowers/specs/2026-07-04-reading-week-bars-polish-design.md`
  - `docs/superpowers/plans/2026-07-04-reading-week-bars-polish.md`

Latest Reading goal card motion polish:

- The Reading tab's today goal card now has a clearer press hierarchy.
- The circular progress ring has an independent transform baseline and gently
  presses inward/down with the card.
- The chevron has an independent transform baseline and nudges right/down on
  press so the card reads more clearly as an entry to goal settings.
- Reduced-motion coverage disables the added ring and chevron transitions and
  transforms.
- This is CSS-only and does not change reading minutes, target calculations,
  goal editing, labels, card dimensions, or navigation behavior.
- Design and implementation plan docs were added:
  - `docs/superpowers/specs/2026-07-08-reading-goal-card-motion-design.md`
  - `docs/superpowers/plans/2026-07-08-reading-goal-card-motion.md`

Latest continue-reading card motion polish:

- The Reading tab's continue-reading card now has a matching layered press
  hierarchy.
- The book cover inside the card has its own transform baseline and gently
  presses inward/down with the card.
- The reading progress fill now has a stable transform baseline and width
  transition so progress changes are smoother.
- The card chevron nudges right/down on press, scoped only to the
  continue-reading card so settings rows and other shared chevrons are not
  changed.
- Reduced-motion coverage disables the added cover, progress-fill, and chevron
  transitions/transforms.
- This is CSS-only and does not change book opening, import, progress
  calculation, cover loading, IndexedDB data, or layout.
- Design and implementation plan docs were added:
  - `docs/superpowers/specs/2026-07-08-continue-reading-card-motion-design.md`
  - `docs/superpowers/plans/2026-07-08-continue-reading-card-motion.md`

Latest EPUB tap-to-menu fix:

- The user reported from an iPhone screenshot that tapping the EPUB reading page
  still did not bring out the reader menu.
- A follow-up iPhone screenshot still showed no reader chrome after tapping.
- A later follow-up still reported that the menu could not be triggered even
  after the TXT/EPUB short-tap and capture-phase fixes were deployed.
- Latest architecture fix: reader chrome now owns a small
  `readerMenuWakeButton` that is only visible/tappable while the full chrome is
  hidden. It sits outside the TXT body and outside the EPUB iframe, so it does
  not depend on content tap propagation, text selection, or publisher document
  events.
- The wake button calls the same `onReaderTap` reducer path as a normal reader
  tap, so it opens the existing bottom action menu instead of introducing a
  second menu state.
- Follow-up fix: the button is now a true menu toggle, not only a wake button.
  It remains `visibility: visible` and `pointer-events: auto` while the full
  menu is open, so tapping the same button again hides the menu.
- Follow-up style polish: the right-top reader close button
  (`readerOverlayBack`) is now a 48px circular button with
  `border-radius: 999px`, matching the reader's other floating controls.
- Service Worker cache was bumped from `ai-reader-v3` to `ai-reader-v4` so the
  installed PWA has a changed `sw.js` to pick up during update checks.
- Latest fix: TXT reader pointer-up now uses the same 32px short-tap tolerance
  before treating a small vertical/horizontal drift as scroll/swipe, so natural
  iPhone finger movement still toggles the reader chrome.
- Latest fix: EPUB iframe touch and click listeners now register in capture
  phase (`capture: true`) so publisher content or WebKit selection/focus paths
  cannot stop propagation before the app sees a tap.
- Root cause: EPUB touch handling could classify small natural iPhone finger
  drift as scroll/swipe intent before the tap resolver ran. The click fallback
  could also be blocked by stale EPUB selection text or a visible insertion
  caret inside the iframe.
- Fix: EPUB touchend now uses a 32px tap tolerance, lets short drifting taps
  win over transient scroll intent, clears swipe tracking for short horizontal
  drift, and clears stale EPUB selection before the click fallback triggers
  reader chrome.
- Regression coverage was added in:
  - `lib/epubTapInteractions.test.ts`
  - `lib/readerChromeIntegration.test.ts`
- Latest regression coverage in `lib/readerChromeIntegration.test.ts` locks:
  - short TXT pointer drift still counts as a reader chrome tap
  - EPUB frame touch/click listeners run in capture phase
- Latest regression coverage in `lib/readerMenuIntegration.test.ts` locks that
  the wake button is wired from `ReadingSession` to `ReaderControls`, uses the
  shared toggle handler, and remains `pointer-events: auto` / `visibility:
  visible` both when the menu is hidden and when it is open.
- Latest regression coverage in `lib/readerMenuIntegration.test.ts` also locks
  that the right-top reader close button stays 48px square and uses
  `border-radius: 999px`.
- Production JS verification found
  `/_next/static/chunks/app/page-85292ecd2ed27a8c.js` contains
  `readerMenuWakeButton`; production CSS
  `/_next/static/css/98e4fe2ae6fc7b3c.css` contains
  `readerMenuWakeButton`, `pointer-events:auto`, and `visibility:visible`
  without the old `pointer-events:none`; production `/sw.js` contains
  `ai-reader-v4`.

Latest reader menu hit-testing fix:

- Reader action menu rows no longer become non-clickable while they are still
  visibly fading/sliding out.
- Root cause: `.readerChromeControlsHidden .readerMenuRow` set
  `pointer-events: none` immediately, while opacity/transform still made the
  menu appear on screen during the exit animation.
- Fix: reader chrome controls now use delayed `visibility: hidden` for the end
  of the exit transition, while keeping visible controls hittable.
- Regression coverage was added in `lib/readerMenuIntegration.test.ts`.
- Production CSS verification found the hidden reader menu row in
  `/_next/static/css/a7cc853063c5b9d9.css` without `pointer-events:none`.

Latest EPUB reader background regression fix:

- EPUB reading sessions no longer paint the entire reader shell/stage with the
  light canvas `var(--app-bg)` background.
- The reader shell and stage stay transparent so the reading view matches the
  main app/ambient background instead of becoming a white/light-gray full-screen
  canvas.
- Follow-up dark-mode fix: EPUB sessions no longer attach
  `readerEpubLightCanvas` or force light variables in every theme. They inherit
  the active light, sepia, dark, or system reader variables.
- The EPUB iframe theme now always uses the active `--foreground`; the removed
  dark-background branch previously forced `#1a1a1a`, producing black text on
  the transparent dark canvas shown in the user's iPhone screenshot.
- Forced iframe text color now also covers links, emphasis, table text,
  captions, and legacy `font` elements so publisher child styles cannot leave
  isolated black text in dark mode.
- Follow-up screenshot showed white text over a white rectangular publisher
  canvas. Root cause: this EPUB nested its white canvas below the direct body
  children, beyond the previous transparency override.
- `applyEpubAmbientCanvas` now recursively clears `background-color` on nested
  `div/main/section/article` layout containers with inline `!important`.
- Theme CSS uses matching descendant selectors for dynamic content. Only the
  background color is cleared; background images and image elements are kept.
- A second iPhone screenshot showed that WebKit can still paint the iframe root
  canvas white even when every publisher layout background is transparent.
- The opaque dark root-canvas fallback in `2fc1299` was rejected by the user
  because dark mode must retain the transparent ambient effect.
- Current strategy enforces transparency at all three epub.js layers:
  - outer view/container elements
  - the actual iframe element (`allowtransparency=true` plus inline important styles)
  - iframe `html/body` roots (`background` and `background-color` transparent)
- The iframe document also receives `color-scheme: normal` so WebKit does not
  substitute its own opaque light canvas. Nested publisher layout backgrounds
  remain color-transparent while images/background images are preserved.
- A further iPhone screenshot proved the remaining white rectangle came from
  publisher CSS outside the earlier layout-tag set, likely a CSS background
  image or pseudo-element rather than epub.js (epub.js source has no white view
  background).
- Transparency now takes priority: every non-media element inside the EPUB and
  its `::before`/`::after` pseudo-elements gets full `background: transparent
  !important`. `img`, `svg`, `video`, `canvas`, and `picture` are excluded and
  remain visible. Decorative CSS backgrounds may be removed by design.
- **Unresolved as of 2026-07-12:** the user confirmed that the same white EPUB
  rectangle still appears on iPhone Safari after fully closing/reopening the
  PWA on Worker `f178b2ef-727b-4f5d-b561-b40f74532c34`.
- Do not describe the dark EPUB transparency issue as fixed. The following
  attempts were deployed and did not solve the real-device rendering:
  - forcing active dark foreground instead of hard-coded black text
  - removing `readerEpubLightCanvas`
  - recursively clearing nested layout background colors
  - temporarily pinning an opaque dark root canvas (rejected: not transparent)
  - forcing epub.js view, iframe, html/body, non-media elements, and pseudo-elements transparent
- Further work is paused. Do not add more speculative CSS. Resume only with the
  affected EPUB file available for local reproduction, or Safari Web Inspector
  evidence identifying the painted node/pseudo-layer and its computed style.
- Regression coverage was updated in:
  - `lib/epubReaderPreferences.test.ts`
  - `lib/ambientBookBackground.test.ts`
  - `lib/epubAmbientIntegration.test.ts`
- Do not reintroduce `readerEpubLightCanvas` or replace the active foreground
  with a hard-coded dark text color. Keep shell/stage/iframe canvases transparent.

Latest Android TWA package work:

- Added Android-ready PNG manifest icons and updated the service worker static asset list.
- Added an experimental Bubblewrap Trusted Web Activity project under `android-twa/`.
- Package id: `com.aireader.pwa`.
- Current TWA origin: `https://881817.xyz`.
- APK/AAB version is now versionCode/versionName `2`.
- Added `public/.well-known/assetlinks.json` for the local Bubblewrap signing key so Chrome can verify the app/site relationship.
- Added `docs/android-twa.md` with rebuild and release notes.
- Added `lib/androidTwaConfig.test.ts` to lock the Android TWA target to the production domain and prevent accidentally reintroducing a temporary tunnel host.
- Local test signing key lives outside the repo at `C:\Users\21022\.bubblewrap\ai-reader.keystore`.
- Local APK output:
  - `C:\aaa\ai-reader-pwa\android-twa\app-release-signed.apk`
  - copied for phone download as `C:\aaa\ai-reader-pwa\public\downloads\ai-reader-twa.apk`
- Production APK download link:
  - `https://881817.xyz/downloads/ai-reader-twa.apk`
- This APK is configured to launch `https://881817.xyz`.
- `https://881817.xyz` now serves the AI Reader Cloudflare Workers deployment.
- `https://881817.xyz/manifest.webmanifest` and `https://881817.xyz/.well-known/assetlinks.json` now return the AI Reader manifest and Android Digital Asset Links file.
- Bubblewrap online build/update can now be retried because the production domain serves `/icon-512.png`, `/manifest.webmanifest`, and `/.well-known/assetlinks.json`.

Historical Cloudflare native-navigation deployment setup (2026-07-13;
superseded by later deployments):

- Cloudflare Wrangler was authenticated locally as `hyjsb1817@gmail.com`.
- Added OpenNext for Cloudflare and Wrangler dev dependencies.
- Added `wrangler.jsonc` with Worker name `ai-reader-pwa` and route `881817.xyz/*`.
- Added `open-next.config.ts`.
- Added `public/_headers` for long-lived Next static chunk caching.
- Added `docs/cloudflare-deploy.md`.
- Changed `npm.cmd run build` to `next build --webpack`; OpenNext on Windows failed at runtime when a stale Turbopack server chunk was deployed.
- Historical native-navigation Worker version:
  `cafbbbed-52fc-442f-9181-c18637427b8b`. This is preserved as dated evidence
  and is superseded by the current Worker version recorded at the top of this
  handoff.
- Earlier storage-hardening deployment version:
  `58b2700f-6fc0-4a3f-abfb-0f9c76abe8a4`.
- Earlier Ask AI deployment version:
  `fd1acd88-b982-4af6-9255-a077fd75a348`.
- Earlier production deployment version:
  `cedf3971-da3d-4e63-a927-aa8355f831e8`.
- Production URL is now `https://881817.xyz`.
- Workers preview URL is `https://ai-reader-pwa.hyjsb1817.workers.dev`.
- Verified production:
  - `/` returns `200` and AI Reader HTML.
  - `/manifest.webmanifest` returns `200` with `application/manifest+json`.
  - `/.well-known/assetlinks.json` returns `200` with the Android TWA package/fingerprint.
  - `/downloads/ai-reader-twa.apk` returns `200` with `application/vnd.android.package-archive`.
  - `/api/models` with an empty JSON body returns the expected validation error.

## Recent Commit Trail

Useful recent commits on `codex/custom-background-settings`:

```text
7a5d178 test: verify native navigation on mobile
00082ec refactor: remove legacy navigation motion
bcb8d4a feat: coordinate application state motion
c0fa5a7 feat: add native edge back gesture
6363101 feat: unify overlays in navigation sheet layer
5864600 feat: replace sheets with interruptible motion
9d00011 feat: coordinate reader chrome motion
6272b76 feat: add shared book reader presentation
ca47d27 feat: migrate subviews to native push navigation
96b6fad feat: move root tabs onto navigation stack
890573f feat: synchronize app navigation history
0151e3d feat: add typed app navigation reducer
c0c7bb8 fix: complete motion runtime capabilities
3512c7a feat: add application motion runtime
dcb5c0c docs: plan native navigation motion system
6cd7cc8 docs: design native navigation motion system
597e7ac fix: persist book files as array buffers
7ce7b78 fix: strip publisher canvas backgrounds
4c7afc5 fix: enforce transparent epub view layers
2fc1299 fix: pin dark epub root canvas
169d0dd fix: clear nested epub canvas colors
e2ae9b2 fix: restore readable epub dark theme
bfbee48 fix: harden restore and runtime resource limits
08db3d9 fix: harden reader data and AI requests
518fe91 fix: pin ask ai composer and recover epub resume
4c57e7c fix: improve reader AI context chat
93491b9 style: round reader close button
3a84a7a fix: keep reader menu toggle visible
89c9712 fix: add reader menu wake button
75f1baa fix: make reader taps more reliable
a20f78d fix: make epub taps reveal reader menu
3c1a200 fix: keep reader menu tappable during exit
164dbb3 fix: keep epub reader background ambient
effa2b6 feat: add Cloudflare Workers deployment
3ba7859 docs: refresh production domain handoff
7a513f8 feat: target Android TWA at production domain
b55504c docs: refresh Android TWA handoff
3d73f12 feat: add Android TWA package scaffold
5766271 feat: add Android-ready web manifest icons
c378eec docs: refresh continue reading card handoff
15dabbb style: polish continue reading card motion
dfc435e docs: add continue reading card motion plan
48666ae style: polish reading goal card motion
5065aa2 docs: add reading goal card motion plan
60fd483 style: polish reading week bars
319c34a docs: add reading week bars polish plan
4ce9554 docs: refresh bug hardening preview link
801751c docs: refresh bug hardening handoff
6d04577 fix: harden offline fallback and downloads
0739433 docs: refresh collection active preview link
5134aec docs: refresh collection active handoff
27b18dc style: polish active collection rows
62bf064 docs: add collection active affordance plan
8786845 docs: refresh library selection preview link
a5298d1 docs: refresh library selection handoff
2abbd9d style: polish library selected badges
55de679 docs: add library selection affordance plan
1551c7d style: add library content transition
dda9ef3 docs: add library content transition plan
d5faa96 style: polish compact control press feedback
9109240 docs: add compact control press plan
fd66621 style: polish bottom tab press feedback
2b5f09e docs: add bottom tab micro lift plan
d9bc7d1 style: add library book press depth
3042253 docs: add library book press depth plan
87942d3 docs: add library book press depth design
6a80468 style: polish reader settings press feedback
6ff8fb8 docs: add reader settings micro press plan
51d0c0a docs: add reader settings micro press design
95c32dc style: add bottom sheet settle motion
b5c88d6 docs: add bottom sheet settle motion plan
7f5a98b docs: add bottom sheet settle motion design
816d16d style: polish reader settings ui
81447f9 docs: refresh streamlined provider handoff
9dc0774 style: streamline ai provider setup
de02470 feat: improve ai provider configuration
3c26242 docs: refresh custom background handoff
53438e9 fix: sync custom background preview effect
52f8a19 style: anchor custom background sheet
2941e4e style: enlarge custom background sheet
4dbfe76 style: expand custom background preview
674fdfb style: improve custom background sheet preview
266d8d1 refactor: move custom background controls to sheet
99b446c feat: add custom reader backgrounds
2c19fe3 main baseline, fix: let reader background follow ambient surface
```

## Verification Already Run

The current Featured Library closeout adds the following fresh evidence to the
historical verification record below:

```powershell
npm.cmd test -- lib/libraryShelves.test.ts lib/libraryHomePresentation.test.ts lib/libraryHomeComposition.test.ts lib/libraryFeaturedReadingIntegration.test.ts lib/libraryBookFirst.test.ts lib/libraryMotionIntegration.test.ts lib/librarySelection.test.ts lib/incrementalList.test.ts lib/sharedBookTransition.test.ts
npm.cmd test
npm.cmd run lint
npm.cmd run build
npx.cmd playwright test --project=iphone-14
npx.cmd playwright test --project=iphone-15-pro-max
$env:NEXT_PRIVATE_STANDALONE='true'
$env:NEXT_PRIVATE_OUTPUT_TRACE_ROOT=(Get-Location).Path
npm.cmd run build
node node_modules\@opennextjs\cloudflare\dist\cli\index.js build --skipNextBuild
node node_modules\@opennextjs\cloudflare\dist\cli\index.js deploy
$env:PLAYWRIGHT_BASE_URL='https://881817.xyz'
npx.cmd playwright test e2e/library-book-first.spec.ts --project=iphone-14
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-14 --grep "reader closes back to its source action and restores focus"
Remove-Item Env:PLAYWRIGHT_BASE_URL
git diff --check
```

Earlier phase verification commands and results are retained below for
historical context:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd test -- lib/navigationChrome.test.ts lib/motionCss.test.ts lib/navigationMotion.test.ts lib/persistentSurfaces.test.ts lib/ambientBookBackground.test.ts
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-14
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-15-pro-max
npx.cmd playwright test e2e/reader-typography.spec.ts --project=iphone-14
npx.cmd playwright test e2e/reader-typography.spec.ts --project=iphone-15-pro-max
$env:PLAYWRIGHT_BASE_URL='https://881817.xyz'; npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-14 --grep "reader closes back|root scroll position|root chrome stays compact|push transition meets"
Remove-Item Env:PLAYWRIGHT_BASE_URL
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-14
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-15-pro-max
npx.cmd playwright test e2e/reader-typography.spec.ts --project=iphone-14
npx.cmd playwright test e2e/reader-typography.spec.ts --project=iphone-15-pro-max
$env:PLAYWRIGHT_BASE_URL='https://881817.xyz'; npx.cmd playwright test e2e/reader-typography.spec.ts --project=iphone-14
$env:PLAYWRIGHT_BASE_URL='https://881817.xyz'; npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-14 --grep "reader closes back|captures root"
Remove-Item Env:PLAYWRIGHT_BASE_URL
$env:PLAYWRIGHT_BASE_URL='http://localhost:3030'; npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-14
$env:PLAYWRIGHT_BASE_URL='http://localhost:3030'; npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-15-pro-max
$env:PLAYWRIGHT_BASE_URL='http://localhost:3040'; npx.cmd playwright test e2e/native-navigation.spec.ts
$env:NEXT_PRIVATE_STANDALONE='true'; $env:NEXT_PRIVATE_OUTPUT_TRACE_ROOT=(Get-Location).Path; npm.cmd run build
node node_modules\@opennextjs\cloudflare\dist\cli\index.js build --skipNextBuild
node node_modules\@opennextjs\cloudflare\dist\cli\index.js deploy
$env:PLAYWRIGHT_BASE_URL='https://881817.xyz'; npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-14
npm.cmd run test -- lib\readerMenuIntegration.test.ts
npm.cmd run test -- lib\readerMenuIntegration.test.ts lib\readerChromeIntegration.test.ts lib\motionCss.test.ts
npm.cmd run test -- lib\serviceWorkerUpdate.test.ts lib\readerMenuIntegration.test.ts lib\readerChromeIntegration.test.ts lib\motionCss.test.ts
npm.cmd run test -- lib\readerChromeIntegration.test.ts lib\epubTapInteractions.test.ts
npm.cmd run test -- lib\motionCss.test.ts lib\readerChromeIntegration.test.ts lib\readerChromeState.test.ts
npm.cmd run test -- lib\ambientBookBackground.test.ts lib\epubAmbientIntegration.test.ts
npm.cmd run test -- lib\androidTwaConfig.test.ts lib\webManifest.test.ts
$env:JAVA_HOME='C:\Users\21022\.bubblewrap\jdk\jdk-17.0.11+9'; $env:ANDROID_HOME='C:\Users\21022\.bubblewrap\android_sdk'; $env:ANDROID_SDK_ROOT=$env:ANDROID_HOME; $env:Path="$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"; .\gradlew.bat assembleRelease bundleRelease
apksigner verify --print-certs android-twa\app-release-signed.apk
npm.cmd run test -- lib\aiChat.test.ts lib\askAiReaderContextIntegration.test.ts
npm.cmd run test -- lib\aiChat.test.ts lib\askAiReaderContextIntegration.test.ts lib\surfaceArchitecture.test.ts
npm.cmd run test -- lib\askAiReaderContextIntegration.test.ts lib\epubAmbientIntegration.test.ts
npm.cmd run test -- lib\askAiReaderContextIntegration.test.ts lib\epubAmbientIntegration.test.ts lib\readerChromeIntegration.test.ts lib\readerMenuIntegration.test.ts lib\motionCss.test.ts
npm.cmd run test -- lib/webManifest.test.ts lib/serviceWorkerUpdate.test.ts
npm.cmd run build
npm.cmd run test -- lib/readingDashboardCss.test.ts
npm.cmd run test -- lib/serviceWorkerUpdate.test.ts
npm.cmd run test -- lib/browserDownload.test.ts
npm.cmd run test -- lib/browserDownload.test.ts lib/bookFileExport.test.ts lib/backup.test.ts
npm.cmd run test -- lib/motionCss.test.ts
npm.cmd run test
npm.cmd exec -- eslint app lib
npm.cmd run build
node node_modules\@opennextjs\cloudflare\dist\cli\index.js build --skipNextBuild
node node_modules\@opennextjs\cloudflare\dist\cli\index.js deploy
git diff --check
```

Observed results:

- Global chrome phase: focused coverage 9 files/97 tests; full Vitest 135
  files/1346 tests; full ESLint and webpack build passed.
- Native-navigation passed 12/12 on both iPhone projects; Phase 1 typography
  regression passed 6/6 on both projects.
- Cloudflare OpenNext deployment published Worker version
  `b7865b31-c91d-410b-9a97-5db37c37dfad`; root and 10 discovered assets
  returned 200 with the expected compact-chrome markers.
- Production chrome, focus return, root scroll preservation, and frame cadence
  passed 4/4 on iPhone 14 emulation, and all three root screenshots were clean.
- Reader typography phase: 134 files, 1342 tests passed; full ESLint and
  webpack build passed.
- Native-navigation Playwright passed 11/11 on both iPhone projects; typography
  Playwright passed 6/6 on both projects.
- Production typography passed 6/6 and critical navigation passed 2/2 on
  iPhone 14 emulation.
- Cloudflare OpenNext deployment published Worker version
  `683beaa5-e2e1-46b2-aa18-28d929ba1410`; the root and 10 discovered assets
  returned 200 and contained the expected Phase 1 markers.
- Native navigation full suite: 133 files, 1339 tests passed.
- Full configured ESLint passed.
- Production webpack build and standalone webpack build passed.
- Development mobile browser verification: 11/11 on iPhone 14 and 11/11
  on iPhone 15 Pro Max.
- Local `next start` production verification: 22/22 across both projects.
- Deployed `https://881817.xyz` browser verification: iPhone 14 11/11.
- Frame probes passed the 40-frame, 80ms interval, and 100ms long-task gates.
- Cloudflare OpenNext deployment published Worker version
  `cafbbbed-52fc-442f-9181-c18637427b8b` to `881817.xyz/*`.
- Production page chunk
  `/_next/static/chunks/app/page-a767c3d60387414c.js` contains navigation,
  reader, sheet, shared-cover, and visual-viewport markers.
- Production CSS `/_next/static/css/17bc67107d065b45.css` and
  `/_next/static/css/5c296e628dadff61.css` contain none of the legacy
  subview/sheet keyframe or phase markers.
- Production root, manifest, assetlinks, all discovered JS/CSS, and APK
  endpoints returned 200. `/api/models` retained its expected validation
  response for an empty request.
- Latest whole-book EPUB focused tests: 3 files, 18 tests passed.
- Latest full suite: 124 files, 1248 tests passed.
- Latest production webpack build passed.
- Cloudflare OpenNext deployment published Worker version
  `077f1420-c978-4ac5-a7b9-a4ac6cac6537` to `881817.xyz/*`.
- Production JS `/_next/static/chunks/app/page-d0e9ae27d30ab0a5.js` contains
  whole-book location generation and page-list handling. Production CSS
  `/_next/static/css/d9745d077dc3a7fb.css` contains the outer
  `.epub-container` WebKit scrollbar and transparent-track rules.
- Latest EPUB page-indicator focused tests: 5 files, 53 tests passed.
- Latest full suite: 124 files, 1247 tests passed.
- Latest production `next build --webpack` passed.
- Cloudflare OpenNext deployment published Worker version
  `714d432d-ac44-4294-aa62-93a22d30f308` to `881817.xyz/*`.
- Production JS `/_next/static/chunks/app/page-9d96c6c13035b21b.js` contains
  epub.js `displayed` pagination and the iframe WebKit scrollbar selector; it
  no longer contains the old synthetic `progress -> 100 pages` mapping.
- Latest reader menu toggle focused tests: 1 file, 12 tests passed.
- Latest reader menu/close-button focused tests: 1 file, 13 tests passed.
- Latest reader menu/chrome/motion focused tests: 5 files, 88 tests passed.
- Latest Ask AI focused tests: 3 files, 69 tests passed.
- Latest Ask AI plus architecture focused tests: 5 files, 105 tests passed.
- Latest Ask AI/EPUB resume focused tests: 3 files, 17 tests passed.
- Latest Ask AI/EPUB/reader chrome focused tests: 8 files, 106 tests passed.
- Latest reader wake button focused tests: 1 file, 12 tests passed.
- Latest wake button/service-worker focused tests: 7 files, 96 tests passed.
- Latest reader tap focused tests: 4 files, 58 tests passed.
- EPUB tap/chrome focused tests: 4 files, 56 tests passed.
- Reader menu focused tests: 1 file, 11 tests passed.
- Reader chrome/motion focused tests: 6 files, 81 tests passed.
- EPUB ambient focused tests: 4 files, 40 tests passed.
- Reading dashboard focused tests: 2 files, 7 tests passed.
- Service-worker focused tests: 2 files, 8 tests passed.
- Browser download focused tests: 1 file, 2 tests passed.
- Download/export/backup focused tests: 5 files, 64 tests passed.
- Target motion tests: 2 files, 45 tests passed.
- Android TWA config focused tests: 2 files, 3 tests passed.
- Full suite: 123 files, 1244 tests passed.
- ESLint `app lib` passed.
- Production `next build --webpack` passed.
- Cloudflare OpenNext deploy passed and published Worker version `58b2700f-6fc0-4a3f-abfb-0f9c76abe8a4`.
- Production JS `/_next/static/chunks/app/page-aa2124a9d1369a4f.js` contains
  `bookFiles`, `arrayBuffer`, and persistent-storage handling.
- Production `/sw.js` contains `MAX_RUNTIME_CACHE_ENTRIES = 80` and the cache
  failure fallback.
- Production `/api/chat` rejected a loopback upstream with HTTP `400` and
  `Private AI upstream addresses are not allowed`.
- Local and production-mode `/api/chat` checks rejected a loopback AI upstream
  with HTTP `400` without contacting it.
- Production `/` returned `200`; production APK returned `200`,
  `application/vnd.android.package-archive`, length `901574`.
- Production JS verification found
  `/_next/static/chunks/app/page-c38a26525ec83a3a.js` contains
  `askBottomSheet` and no longer contains `ASKING_ABOUT`.
- Production CSS verification found
  `/_next/static/css/af97b144a013a123.css` contains
  `askBottomSheet` and `askThread`.
- Production JS verification found
  `/_next/static/chunks/app/page-df07a0acf3c8fe1e.js` contains
  `nearbyText` and `getVisibleText`.
- Production CSS verification found the deployed CSS files return `200`:
  `/_next/static/css/6a96238a7f2df63e.css` and
  `/_next/static/css/529e3f2a86c52a7a.css`.
- Production `/api/models` with `{}` returns the expected validation error:
  `Missing required fields: provider.baseUrl, provider.apiKey`.
- Production JS verification found
  `/_next/static/chunks/app/page-85292ecd2ed27a8c.js` contains
  `readerMenuWakeButton`.
- Production CSS verification found
  the deployed reader CSS contains `readerMenuWakeButton`,
  `pointer-events:auto`, and `visibility:visible`, and no longer contains the
  old `readerMenuWakeButton` default `pointer-events:none` state.
- Production CSS verification found the deployed `readerOverlayBack` rule
  contains `width:48px`, `height:48px`, and `border-radius:999px`.
- Production service worker verification found `/sw.js` contains
  `ai-reader-v5` after the latest deployment.
- Production CSS verification found hidden `.readerMenuRow` on
  `/_next/static/css/a7cc853063c5b9d9.css` uses delayed `visibility: hidden`
  and does not contain `pointer-events:none`.
- Production CSS `/_next/static/css/599b9b87652c6cb1.css` no longer contains
  `readerEpubLightCanvas`; production JS
  `/_next/static/chunks/app/page-48e229a50113bd81.js` contains the expanded
  iframe text selector including `figcaption`.
- Production JS `/_next/static/chunks/app/page-12fb74a0021bb2d3.js` contains
  `body div, body main, body section, body article` and the recursive
  `background-color` canvas cleanup.
- Production JS `/_next/static/chunks/app/page-281f8447d9fda0fc.js` contains
  the luminance-based dark root canvas resolver and descendant transparency
  rule.
- Production JS `/_next/static/chunks/app/page-559ecec363b2aaad.js` contains
  `allowtransparency`, `color-scheme`, and inline outer-view/iframe transparency
  logic. This supersedes the opaque dark-root resolver above.
- Production JS `/_next/static/chunks/app/page-6a34126260b9848a.js` contains the
  non-media exclusion selector, pseudo-element transparency, and
  `allowtransparency` handling.
- Android TWA Gradle build produced `android-twa/app-release-signed.apk` and `android-twa/app-release-bundle.aab`.
- `apksigner verify --print-certs android-twa\app-release-signed.apk` passed; SHA-256 digest is `e6c06bd38d05b1a6ee765ad211190b7d526a0ef136a25d3b7015f0b88ebec7af`.
- Signed APK SHA-256 file hash: `133DFABF690E7EE9AA47B80C75CAE6B63E1B37EA133C742AB22ECBF5E9AF3A13`.
- AAB SHA-256 file hash: `C1A4033260F67F28A9D44F6BD53CF7E06B2E0248B84CF5075BDE680CCFCCC5CC`.
- Generated Android release resources confirm:
  - `hostName`: `881817.xyz`
  - `launchUrl`: `https://881817.xyz/`
  - `webManifestUrl`: `https://881817.xyz/manifest.webmanifest`
  - `fullScopeUrl`: `https://881817.xyz/`
- After Cloudflare deployment, the production domain now serves the required Android TWA manifest/icon/assetlinks files. Bubblewrap online build should be retried if the Android package needs another update.
- Current production domain verified:
  - `/` returns `200`, `text/html`, and AI Reader HTML.
  - `/manifest.webmanifest` returns `200`, `application/manifest+json`.
  - `/.well-known/assetlinks.json` returns `200`, `application/json`.
  - `/downloads/ai-reader-twa.apk` returns `200`, `application/vnd.android.package-archive`.
  - `/api/models` with `{}` returns the expected missing provider validation error.
- `git diff --check` reported no whitespace errors; while files were uncommitted it emitted only Windows CRLF normalization warnings.

Before making another code commit, rerun:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
$env:PLAYWRIGHT_BASE_URL='http://localhost:<unused-port>'; npx.cmd playwright test e2e/native-navigation.spec.ts
git diff --check
git status -sb
```

## Current Preview Link

Current production deployment:

```text
https://881817.xyz
```

Current Workers preview URL:

```text
https://ai-reader-pwa.hyjsb1817.workers.dev
```

Do not use temporary `trycloudflare.com` tunnel links as the primary preview now that the production Worker route is live. If the next session sees stale CSS or naked HTML on production:

1. Rebuild in standalone mode with the exact Windows sequence documented above.
2. Run OpenNext `build --skipNextBuild`, then `deploy`.
3. Verify the HTML's `/_next/static/css/*.css` URLs return `200` from `https://881817.xyz`.

Example CSS verification:

```powershell
$html=(Invoke-WebRequest -UseBasicParsing https://881817.xyz).Content
$css=$html | Select-String -Pattern '/_next/static/css/[^"'']+\.css' -AllMatches | ForEach-Object { $_.Matches.Value } | Select-Object -Unique
$css
foreach($u in $css){ $r=Invoke-WebRequest -UseBasicParsing "https://881817.xyz$u"; "$u $($r.StatusCode) $($r.Headers['Content-Type']) len=$($r.RawContentLength)" }
```

## Known History and Cautions

The prior EPUB dark-mode background issue is still relevant project context:

- User's baseline for EPUB light mode was ambient outside + white EPUB paper/page + black text.
- Dark-mode transparent ambient remains unresolved on real iPhone Safari.
- Broad transparent-background rules have already been tried through commit
  `7ce7b78` and did not remove the white rectangle.
- If revisiting EPUB dark mode, first obtain the affected EPUB or inspect the
  real iframe using Safari Web Inspector. Do not guess from screenshots again.
- Scope any future change to dark/system-dark and recheck light/sepia behavior.

Files related to EPUB background work:

- `app/EpubReader.tsx`
- `lib/epubAmbientCanvas.ts`
- `lib/epubAmbientCanvas.test.ts`
- `lib/epubReaderPreferences.ts`
- `lib/epubReaderPreferences.test.ts`
- `lib/epubAmbientIntegration.test.ts`
- `app/page.module.css`

## Next Conversation Prompt

Use this opener in the new conversation:

```text
继续开发 C:\aaa\ai-reader-pwa，先完整阅读 HANDOFF.md。
当前工作在分支 codex/custom-background-settings，PR 是 https://github.com/HYJ1817/AI-reader/pull/1。不要 reset、clean 或覆盖用户改动。先运行 git status -sb 和 git log -8 --oneline --decorate，再继续。
最新完成的是目录抽屉标签性能稳定化，提交 8911f9a。首轮切换的根因是目录数组/60 行章节树重建、原生 smooth scroll 和 Motion layout projection 同时启动；现在目录结果与章节子树稳定缓存，点击使用即时定位加 WAAPI 合成层轻滑入，标签高亮使用单个常驻 CSS transform 层，手指滑动仍保留原生 scroll-snap，减弱动效仍即时切换。
全量 Vitest 154 文件/1422 项、全仓 ESLint、standalone next build、OpenNext build 均通过。完整双设备 Playwright 的其余 80 项通过；修正性能测试的 EPUB 分页等待与合成触摸节奏后，4x CPU 点击预算及原生滑动用例复跑 4/4，生产 reader-annotations 双设备回归 8/8。Chromium 只能验证 60Hz 帧预算，真实 iPhone ProMotion trace 仍是非阻塞验收项。
最新正式 Worker 版本是 1e9e5ad9-76fe-40e6-9210-a731a88503ee；Worker 是 ai-reader-pwa，路由是 881817.xyz/*，主预览地址只用 https://881817.xyz。APK 仍为 https://881817.xyz/downloads/ai-reader-twa.apk，TWA 目标仍为 https://881817.xyz。
生产根页面、全部发现的静态资源、Service Worker、BUILD_ID、Manifest、Asset Links、APK 均返回 200；生产双设备 reader-annotations E2E 8/8 通过。GitHub HYJ1817 token 无效，本地分支领先 origin，尚未推送；不要自动修改凭证或远端。真实安卓 WebView、iPhone Safari/PWA、90Hz trace 与 VoiceOver 仍是非阻塞设备风险。
独立/standalone 构建前只处理生成目录：先把工作区解析为 C:\aaa\ai-reader-pwa，再构造并验证 C:\aaa\ai-reader-pwa\.next 与 C:\aaa\ai-reader-pwa\.open-next 的父目录等于工作区、目标本身不等于工作区且目录名在白名单中；通过后才对这两个目标执行 Remove-Item -LiteralPath ... -Recurse -Force。没有使用 git clean 或 git reset。Cloudflare 首次静态资源上传需要一次自动重试，随后 3 个变更资源全部上传、部署完成且生产验证通过；这是部署可靠性备注，不是产品故障。
Windows OpenNext 部署必须先设置 NEXT_PRIVATE_STANDALONE=true 与 NEXT_PRIVATE_OUTPUT_TRACE_ROOT=(Get-Location).Path，再 npm.cmd run build，然后执行 OpenNext build --skipNextBuild 和 deploy；普通 npm build 不会生成 .next/standalone。
UI 品质路线图已经全部关闭，不要自动重开 Phase 1-6。下一步按用户新的产品优先级继续；若继续视觉优化，最终 critique 仍有两个非阻塞方向：增加轻量首次发现提示，或下沉设置页低频维护内容。真实 iPhone Safari/PWA 与 VoiceOver 验证仍是非阻塞风险。EPUB 深色透明 ambient 白色矩形仍未解决；没有问题 EPUB 或 Safari Web Inspector 证据时不要继续猜 CSS。
```
