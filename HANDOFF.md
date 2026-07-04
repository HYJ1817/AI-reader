# AI Reader Agent Handoff

## Current Checkout

- Repository: `C:\aaa\ai-reader-pwa`
- GitHub remote: `https://github.com/HYJ1817/AI-reader.git`
- Active branch: `codex/custom-background-settings`
- Pull request: `https://github.com/HYJ1817/AI-reader/pull/1`
- Base branch: `main`
- Latest code commit: `2abbd9d` (`style: polish library selected badges`)
- If branch HEAD is newer than `2abbd9d`, that newer commit should be this handoff-only documentation update.
- Latest pushed branch state before this handoff update:
  - `codex/custom-background-settings`
  - `origin/codex/custom-background-settings`
  - local branch includes `2abbd9d`; push it before handing off if not already pushed

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

## Recent Commit Trail

Useful recent commits on `codex/custom-background-settings`:

```text
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

After the latest code commit `2abbd9d`, these passed:

```powershell
npm.cmd run test -- lib/motionCss.test.ts
npm.cmd run test
npm.cmd exec -- eslint app lib
npm.cmd run build
git diff --check
```

Observed results:

- Target motion tests: 2 files, 44 tests passed.
- Full suite: 116 files, 1180 tests passed.
- ESLint `app lib` passed.
- Production `next build` passed.
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

Current local production server:

```text
http://127.0.0.1:3036
```

Current Cloudflare quick tunnel:

```text
https://wishing-lonely-renew-anderson.trycloudflare.com
```

It is backed by:

```powershell
npm.cmd run start -- --hostname 127.0.0.1 --port 3036
C:\tmp\cloudflared.exe tunnel --protocol http2 --url http://127.0.0.1:3036
```

Cloudflare quick-tunnel URLs are temporary. If the next session sees stale CSS or naked HTML:

1. Rebuild with `npm.cmd run build`.
2. Restart `next start` on port `3036` or a new free port.
3. Restart `cloudflared`.
4. Verify the HTML's `/_next/static/chunks/*.css` URLs return `200`.

Example CSS verification:

```powershell
$html=(Invoke-WebRequest -UseBasicParsing https://wishing-lonely-renew-anderson.trycloudflare.com).Content
$css=$html | Select-String -Pattern '/_next/static/chunks/[^"'']+\.css' -AllMatches | ForEach-Object { $_.Matches.Value } | Select-Object -Unique
$css
foreach($u in $css){ $r=Invoke-WebRequest -UseBasicParsing "https://wishing-lonely-renew-anderson.trycloudflare.com$u"; "$u $($r.StatusCode) $($r.Headers['Content-Type']) len=$($r.RawContentLength)" }
```

## Known History and Cautions

The prior EPUB dark-mode background issue is still relevant project context:

- User's baseline for EPUB light mode was ambient outside + white EPUB paper/page + black text.
- Do not globally make EPUB iframes or publisher backgrounds transparent to force blending with ambient backgrounds.
- If revisiting EPUB dark mode, scope changes to dark/system-dark and inspect real iPhone iframe computed styles before guessing.
- Do not repeat broad transparent-background experiments that changed light mode.

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
最新代码提交是 2abbd9d，主要内容包括自选背景图片、独立自选背景弹窗、近全屏 sheet、完整图片预览、预览跟随背景虚化/强度滑条变化，AI 服务商预设、移除重复的 API 格式列表、API 地址自动随服务商切换、自动附加路径可见化、旧 OpenAI 地址迁移、阅读器主题/自定义设置 UI 优化、共享 BottomSheet 的非关闭拖拽松手 settling 动效、阅读器设置 popover/custom entry 的 micro-press 动效、书库 grid/list 书籍封面和更多按钮的 press-depth 动效、底部导航 active/pressed tab 的 icon+label 微抬和回弹、设置 segmented / 书库视图切换 / 藏书列表行的 compact press 动效、书库 grid/list 内容切换的轻量进入动效，以及书库编辑选择态徽标的层级增强。主题设置里的小/大只调字号；自定义设置上方是真实文本预览；自定义滑块左侧必须使用固定 SVG 图标，不要再用中文字符或 emoji 拼图标。滑条控制实际背景效果，不是图片本身透明度。当前临时预览地址是 https://wishing-lonely-renew-anderson.trycloudflare.com，但 quick tunnel 可能失效，必要时重启 next start 和 cloudflared。
```
