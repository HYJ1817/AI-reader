# AI Reader Agent Handoff

## Current Checkout

- Repository: `C:\aaa\ai-reader-pwa`
- GitHub remote: `https://github.com/HYJ1817/AI-reader.git`
- Active branch: `codex/custom-background-settings`
- Pull request: `https://github.com/HYJ1817/AI-reader/pull/1`
- Base branch: `main`
- Latest code commit: `7ce7b78` (`fix: strip publisher canvas backgrounds`)
- If branch HEAD is newer than `7ce7b78`, that newer commit should be this handoff-only documentation update.
- Latest pushed branch state before this handoff update:
  - `codex/custom-background-settings`
  - `origin/codex/custom-background-settings`
  - local branch includes `7ce7b78`; push it before handing off if not already pushed

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

Latest Cloudflare production deployment work:

- Cloudflare Wrangler was authenticated locally as `hyjsb1817@gmail.com`.
- Added OpenNext for Cloudflare and Wrangler dev dependencies.
- Added `wrangler.jsonc` with Worker name `ai-reader-pwa` and route `881817.xyz/*`.
- Added `open-next.config.ts`.
- Added `public/_headers` for long-lived Next static chunk caching.
- Added `docs/cloudflare-deploy.md`.
- Changed `npm.cmd run build` to `next build --webpack`; OpenNext on Windows failed at runtime when a stale Turbopack server chunk was deployed.
- Latest deployed Cloudflare Worker version:
  `f178b2ef-727b-4f5d-b561-b40f74532c34`.
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

After the latest code commit `7ce7b78`, these passed:

```powershell
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
npm.cmd run deploy:cf
git diff --check
```

Observed results:

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
- Full suite: 122 files, 1238 tests passed.
- ESLint `app lib` passed.
- Production `next build --webpack` passed.
- Cloudflare OpenNext deploy passed and published Worker version `f178b2ef-727b-4f5d-b561-b40f74532c34`.
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
npm.cmd run test
npm.cmd exec -- eslint app lib
npm.cmd run build
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

1. Rebuild with `npm.cmd run build`.
2. Redeploy with `npm.cmd run deploy:cf`.
3. Verify the HTML's `/_next/static/chunks/*.css` URLs return `200` from `https://881817.xyz`.

Example CSS verification:

```powershell
$html=(Invoke-WebRequest -UseBasicParsing https://881817.xyz).Content
$css=$html | Select-String -Pattern '/_next/static/chunks/[^"'']+\.css' -AllMatches | ForEach-Object { $_.Matches.Value } | Select-Object -Unique
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

The opener below includes the latest reliability/security deployment state.

```text
继续开发 C:\aaa\ai-reader-pwa，先完整阅读 HANDOFF.md。
当前工作在分支 codex/custom-background-settings，PR 是 https://github.com/HYJ1817/AI-reader/pull/1。不要 reset、clean 或覆盖用户改动。先运行 git status -sb 和 git log -8 --oneline --decorate，再继续。
重要：EPUB 深色模式透明 ambient 截至 2026-07-12 仍未解决。用户确认在 Worker f178b2ef-727b-4f5d-b561-b40f74532c34 上完全关闭并重开 PWA 后白色矩形仍存在。不要继续猜 CSS；只有拿到问题 EPUB 文件做本地复现，或取得 Safari Web Inspector 的真实 iframe 节点/computed style 后再继续。
最新代码提交以 7ce7b78 为准：三层透明后用户截图仍显示白色 EPUB 画布，已确认 epub.js 本身不设置白底；现在透明优先，清除 iframe 内所有非媒体元素及伪元素的完整 background，保留 img/svg/video/canvas/picture。最新 Worker 版本是 f178b2ef-727b-4f5d-b561-b40f74532c34。下面较早提交与 Worker 版本仅为历史摘要。
最新代码提交是 08db3d9，主要修复备份恢复可能先清空再失败的数据丢失风险；备份 v2 现已包含阅读统计、自定义背景和不含密钥的当前 AI 服务商设置，并保持 v1 兼容；AI API 已限制内网/回环地址、非 HTTPS、重定向、请求/响应大小和超时；Ask AI 会在切书/关闭时中止旧请求、忽略过期响应、只发送最近 20 条历史并自动滚动；localStorage 写入失败不会再打断界面；Service Worker cache 已更新为 ai-reader-v5。此前功能还包括自选背景图片、独立自选背景弹窗、近全屏 sheet、完整图片预览、预览跟随背景虚化/强度滑条变化，AI 服务商预设、移除重复的 API 格式列表、API 地址自动随服务商切换、自动附加路径可见化、旧 OpenAI 地址迁移、阅读器 Ask AI 现在保留对话历史、发送后清空输入、把历史消息和当前可见正文片段一起传给 AI、EPUB 通过 getVisibleText 读取当前渲染 iframe 文本、TXT 读取可见段落上下文、阅读器主题/自定义设置 UI 优化、共享 BottomSheet 的非关闭拖拽松手 settling 动效、阅读器设置 popover/custom entry 的 micro-press 动效、书库 grid/list 书籍封面和更多按钮的 press-depth 动效、底部导航 active/pressed tab 的 icon+label 微抬和回弹、设置 segmented / 书库视图切换 / 藏书列表行的 compact press 动效、书库 grid/list 内容切换的轻量进入动效、书库编辑选择态徽标的层级增强、藏书集合 active row 的侧边高亮、icon 微放大和 chevron 右移动效、Service Worker 离线 cache miss 正确返回错误响应、书籍/备份导出 Blob URL 延迟释放以降低 iPhone 下载失败风险、阅读页 7 天柱状图的底部进入动效和今日状态高亮、阅读页今日目标卡片的进度环/chevron 按压层级动效、阅读页继续阅读卡片的封面/进度条/chevron 分层按压动效、EPUB 阅读界面外层/stage 恢复透明以继续显示主界面 ambient 背景、阅读器菜单退场动画期间保持可点并在动画结束后才 visibility hidden、EPUB 正文短距离点按漂移仍可唤出阅读器菜单且旧选择/光标不会阻断 click fallback、TXT 阅读页短距离点按漂移仍会唤出菜单、EPUB iframe 触摸/click 监听已改为 capture 阶段以避免内容页拦截、菜单隐藏时新增独立于正文/iframe 的 readerMenuWakeButton 小按钮用于唤出菜单、readerMenuWakeButton 现在在菜单打开时仍保持可见可点，再点一次可收起菜单、右上角 readerOverlayBack 关闭按钮已改成 48px 圆形按钮，以及 Android TWA 测试包工程、PNG manifest 图标、assetlinks、本地 APK 下载链接，并已把 Android TWA 正式目标域名改为 https://881817.xyz。Cloudflare Workers/OpenNext 生产部署已完成，最新 Worker 版本是 d38b8847-10ee-4633-befa-9b29906cec1c，线上地址是 https://881817.xyz，Worker 是 ai-reader-pwa，路由是 881817.xyz/*。主题设置里的小/大只调字号；自定义设置上方是真实文本预览；自定义滑块左侧必须使用固定 SVG 图标，不要再用中文字符或 emoji 拼图标。滑条控制实际背景效果，不是图片本身透明度。APK 下载地址是 https://881817.xyz/downloads/ai-reader-twa.apk。Cloudflare 部署使用 npm.cmd run deploy:cf；如果 Windows/OpenNext 出现 stale chunk，先删除 .next 和 .open-next 再部署。
```
