# AI Reader Agent Handoff

## 1. Current Checkout

- Repository: `C:\aaa\ai-reader-pwa`
- GitHub: `https://github.com/HYJ1817/AI-reader`
- Branch: `main`
- Latest pushed commit: `2c19fe3` (`fix: let reader background follow ambient surface`)
- `main`, `origin/main`, and `origin/HEAD` currently point at `2c19fe3`.
- The working tree is **dirty**. Do not run `git reset`, `git clean`, or overwrite local changes.

Start the next session with:

```powershell
cd C:\aaa\ai-reader-pwa
git status -sb
git log -5 --oneline --decorate
Get-Content HANDOFF.md
```

Then inspect the current diff before editing:

```powershell
git diff --stat
git diff -- app/EpubReader.tsx lib/epubAmbientCanvas.ts lib/epubReaderPreferences.ts
```

## 2. Product and Stack

AI Reader is a local-first EPUB/TXT reader primarily tested on iPhone Safari and home-screen PWA.

Current stack:

- Next.js 16 App Router
- React 19 and TypeScript
- Dexie/IndexedDB
- epub.js
- Vitest and ESLint
- Service worker and web app manifest

Important product direction:

- Keep the app as a Next.js PWA unless the user explicitly resumes the deferred native iOS shell plan.
- Preserve existing IndexedDB books, groups, progress, settings, and backups.
- EPUB content renders inside an iframe; parent CSS and parent pointer handlers alone are not enough.
- Do not claim a mobile EPUB behavior is fixed solely because desktop tests pass.

## 3. Current Dirty Work

As of June 29, 2026, `git status -sb` shows modified files:

- `app/AppOverlays.tsx`
- `app/EpubReader.tsx`
- `app/LibrarySurface.tsx`
- `app/ReaderControls.tsx`
- `app/ReaderSettingsPanel.tsx`
- `app/ReadingSession.tsx`
- `app/TocDrawer.tsx`
- `app/page.module.css`
- `app/page.tsx`
- `lib/epubAmbientCanvas.test.ts`
- `lib/epubAmbientCanvas.ts`
- `lib/epubReaderPreferences.test.ts`
- `lib/epubReaderPreferences.ts`
- `lib/libraryProgress.ts`
- `lib/motionCss.test.ts`
- `lib/readerChromeIntegration.test.ts`
- `lib/readingGoalCss.test.ts`
- `lib/surfaceArchitecture.test.ts`

Untracked files:

- `lib/libraryBookActionsIntegration.test.ts`
- `lib/readerMenuIntegration.test.ts`
- `lib/readerPageInfo.ts`

Do not discard these. They include the latest user-requested changes and tests.

## 4. Recent User Requests and State

The user has been iterating quickly on mobile UI details:

- Settings page: removed explanatory small text below switches.
- Reading goal modal: redesigned toward the provided fullscreen iOS-style reference and changed the goal picker to wheel-like dragging.
- Book list: removed progress bars and kept numeric progress.
- Book delete: changed from inline destructive area toward a popup/sheet flow.
- Reader menu: added page number display and began redesigning the reader controls around entries for table of contents, AI, theme/design, and related panels.
- Reader theme/settings: added a separate custom settings sheet opened from the theme sheet. The visible settings portion now closely follows the provided Apple Books reference: `文本`, font row, bold row, `无障碍与布局选项`, custom toggle, line/character/word/page-margin sliders, column row, justify toggle, and reset button.
- Deferred roadmap: in-app browser and direct book download/import is recorded in `ROADMAP.md`; do not start it now.
- Latest active bug: EPUB dark mode still shows a white EPUB paper/page while text is dark-mode colored. The user asked to stop experimenting and restore the original light-mode behavior.

## 5. EPUB Dark-Mode Background Bug Record

The user showed repeated iPhone screenshots where:

1. Dark mode text became light.
2. A white EPUB page rectangle remained.
3. A later attempted fix changed the rectangle to a flat dark background.
4. A later attempted fix made light mode look different by leaking the outer ambient background into the EPUB area.
5. The user then asked to stop changing it and restore the original light-mode behavior.

Current recorded interpretation as of June 30, 2026:

- Treat current light mode as the baseline/reference.
- Light mode is effectively: app ambient background outside + a white EPUB paper/page + black text.
- A future dark-mode fix should mirror that structure: app ambient background outside + a dark EPUB paper/page + light text.
- Do **not** make EPUB transparent to the app ambient background as the primary strategy.
- Do **not** globally force `.epubReaderViewport`, `.epub-container`, `.epub-view`, or `iframe` to `background: transparent !important`.
- Do **not** clear all publisher/layout backgrounds in light mode.
- If revisiting the bug, scope the change to dark/system-dark only and inspect real iPhone iframe computed styles before guessing.

Relevant files:

- `app/EpubReader.tsx`
- `lib/epubAmbientCanvas.ts`
- `lib/epubAmbientCanvas.test.ts`
- `lib/epubReaderPreferences.ts`
- `lib/epubReaderPreferences.test.ts`
- `lib/epubAmbientIntegration.test.ts`
- `app/page.module.css`

State after rollback requested by the user:

- Experimental `epubAmbientBackdrop` files were removed.
- `EpubReader` no longer passes cover/ambient canvas options into EPUB rendering.
- `page.module.css` no longer forces the outer epub.js canvas/iframe transparent.
- `applyEpubReaderPreferences` registers EPUB body background as the theme background again.
- `applyEpubAmbientCanvas` is back to the narrower direct-canvas helper behavior.
- Dark-mode EPUB background bug remains unresolved by design; the user asked to stop and record it.

## 6. Verification Already Run

After the rollback to original light-mode behavior, these passed:

```powershell
npm.cmd run test -- lib/epubAmbientCanvas.test.ts lib/epubReaderPreferences.test.ts lib/epubAmbientIntegration.test.ts
npm.cmd exec -- eslint app\EpubReader.tsx app\ReadingSession.tsx lib\epubAmbientCanvas.ts lib\epubAmbientCanvas.test.ts lib\epubReaderPreferences.ts lib\epubReaderPreferences.test.ts lib\epubAmbientIntegration.test.ts
npm.cmd run test
npm.cmd exec -- eslint app lib
npm.cmd run build
git diff --check
```

Observed results:

- Related tests: 6 files, 32 tests passed.
- Full test suite: 115 files, 1132 tests passed.
- ESLint on touched source/test files and `eslint app lib` passed.
- Production `next build` passed.
- `git diff --check` reported only existing CRLF warnings.

Before committing or pushing, run again:

```powershell
npm.cmd run test
npm.cmd exec -- eslint app lib
npm.cmd run build
git diff --check
git status -sb
```

`npm.cmd run lint` may still scan unwanted generated files in retained worktrees; prefer `npm.cmd exec -- eslint app lib` unless the lint config is fixed.

## 7. Temporary Phone Test Link

Latest temporary Cloudflare quick tunnel shared to the user:

```text
https://bargains-directory-marco-acting.trycloudflare.com
```

It points to a local production server on port `3010` at the time it was created. This tunnel was started with `--protocol http2` after the default QUIC quick tunnel registered but failed local TLS verification.

Cloudflare quick-tunnel URLs are temporary. They may expire or point at an old local process if the process stops. If the next session needs a phone link, start a fresh production server on a new port and create a new tunnel.

Useful pattern:

```powershell
npm.cmd run build
npm.cmd run start -- --hostname 127.0.0.1 --port 3005
C:\tmp\cloudflared.exe tunnel --url http://127.0.0.1:3005
```

Verify the public URL before sharing:

```powershell
Invoke-WebRequest -Uri "https://<new-url>.trycloudflare.com" -UseBasicParsing -TimeoutSec 20
```

## 8. Real-Device Acceptance Checks

Use the user's iPhone screenshot feedback as the source of truth for the EPUB background issue.

Acceptance checks:

1. Open an EPUB in dark mode.
2. Confirm whether the white EPUB paper remains; this bug is currently recorded but not fixed.
3. If fixing later, confirm the dark mode keeps the same layout model as light mode: ambient outside + EPUB paper inside.
4. Confirm light mode stays visually unchanged from the original baseline.
5. Confirm text contrast is readable.
6. Switch light/dark/system appearance and confirm the background remains correct.
7. Tap reading area to show the reader menu and confirm controls still work.
8. Swipe/page-turn and scroll where supported; these should not accidentally toggle the menu.
9. Select text and confirm the AI action path still works.

If the issue persists, inspect runtime iframe computed styles instead of guessing:

- Outer `.epubReaderViewport`
- epub.js `.epub-container`
- `.epub-view`
- `iframe`
- iframe `documentElement`
- iframe `body`
- first visible publisher wrappers and paragraphs

## 9. Deferred Roadmap

`ROADMAP.md` records a future in-app web browser that lets the user browse websites and import downloaded EPUB/TXT files directly into the bookshelf.

Status:

- Deferred.
- Requires a thin iOS native shell using `WKWebView` and `WKDownload`.
- Not a pure PWA feature.
- Do not start it until the user explicitly resumes the roadmap item and a Mac/Xcode/signing/device-testing workflow is available.

## 10. Next Conversation Prompt

Use this exact opener in the new conversation:

```text
继续开发 C:\aaa\ai-reader-pwa，先完整阅读 HANDOFF.md。

当前在根目录 main 分支继续，不要 reset、clean 或覆盖未提交修改。先执行 git status -sb 和 git log -5 --oneline --decorate，然后阅读当前 diff。

重点记录 EPUB 深色模式背景 bug：用户确认浅色模式是参考基准，浅色结构是 ambient 外背景 + 白色 EPUB 纸面 + 黑字。不要再把 EPUB 透明化来融合 ambient；之前透明 iframe / 透明 EPUB 文档 / 大范围清 publisher 白底的方向已经导致浅色变样，已按用户要求回退。若以后继续修，只做深色/系统深色路径，目标是 ambient 外背景 + 深色 EPUB 纸面 + 浅字，并先在 iPhone 上检查 iframe 内外 computed style。

最新已跑过 npm.cmd run test、npm.cmd exec -- eslint app lib、npm.cmd run build、git diff --check；提交前需要再跑这些验证。
```
