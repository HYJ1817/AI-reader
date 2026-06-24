# AI Reader Agent Handoff

## 1. Current Checkout

- Repository and active checkout: `C:\aaa\ai-reader-pwa`
- GitHub: https://github.com/HYJ1817/AI-reader
- Branch: `main`
- Latest code commit: `0029694` (`fix: preserve epub theme canvas on ios`)
- `main` has been fast-forwarded to the completed `codex/surface-visual-system` work and pushed to `origin/main`.
- The old feature worktree still exists at `C:\aaa\ai-reader-pwa\.worktrees\surface-visual-system`, but new work should start from the root `main` checkout unless the user explicitly asks otherwise.

Start every new session with:

```powershell
cd C:\aaa\ai-reader-pwa
git status -sb
git log -5 --oneline --decorate
npm.cmd run test
npm.cmd run build
npm.cmd exec -- eslint app lib
```

Do not reset, clean, remove the feature worktree, or overwrite changes you did not create.

## 2. Product and Stack

AI Reader is a local-first EPUB/TXT reader primarily used on an iPhone in Safari or as a home-screen PWA.

The intended experience is quiet, focused, Chinese-language, one-handed, and close to a mature iOS utility without copying Apple trademarks or private APIs.

Current stack:

- Next.js 16 App Router
- React 19 and TypeScript
- Dexie/IndexedDB
- epub.js
- Vitest and ESLint
- Service worker and web app manifest

This is still a Next.js PWA. Do not begin a native iOS rewrite without explicit approval.

## 3. Important Constraints

- Preserve existing IndexedDB books, groups, progress, settings, and backups.
- Do not export API keys in backups.
- AI requests may include only the book title, format, selected passage, and user question. Never send the full book.
- Keep custom OpenAI-compatible, Anthropic-compatible, Gemini, DeepSeek, and other third-party endpoints.
- Do not hard-code a short fixed model catalog.
- Keep bottom navigation as `书库 / 阅读 / 设置`.
- Do not reintroduce a bottom AI tab.
- Keep horizontal swipe page turning and vertical scrolling available.
- Respect iPhone safe areas and reduced-motion preferences.
- EPUB content is rendered in an iframe. Parent-page pointer handlers and CSS alone do not cover EPUB behavior.
- Do not claim a mobile interaction is fixed solely because desktop tests pass.

## 4. Latest Completed Work

The `codex/surface-visual-system` branch was merged into `main` and pushed on June 24, 2026.

Important recent commits:

- `0029694`: preserves the selected EPUB theme canvas on iOS.
- `b7558c8`: stabilizes EPUB dark theme switching and repeated menu toggling.
- `90f5912`: overrides publisher EPUB canvas colors inline.
- `cd033e5`: registers valid EPUB ambient theme rules.
- `805254c`: reveals the ambient background through EPUB content.
- `16a9d94`: adds the shared `AmbientBookBackground` component.
- `df5e1ac` and `cd2a5d6`: stabilize EPUB tap/menu interaction lifecycle.

Current behavior:

- `AmbientBookBackground` is shared across the main surfaces and remains visible when entering reading.
- The ambient background is derived from the active book cover, supports fallback covers, crossfades between books, and respects reduced motion.
- EPUB publisher wrappers are cleared so the ambient layer can show through where appropriate.
- EPUB `html` and `body` retain the active reading-theme background instead of becoming transparent white on iOS Safari.
- Changing light/dark/system appearance reapplies both epub.js theme colors and the rendered EPUB canvas.
- A stationary tap on a non-interactive EPUB reading area toggles the floating reader menu.
- Tapping again hides the menu.
- Horizontal page swipes, vertical scrolling, links, selections, and interactive content are excluded from accidental menu toggles.
- Reader tools remain directly available as `目录 / 阅读外观 / 阅读方式 / 问 AI`.
- Surface architecture has been split into focused components such as `LibrarySurface`, `ReadingDashboard`, `ReadingSession`, `SettingsSurface`, `AppNavigation`, and `AppOverlays`.

## 5. Important Files

- `app/page.tsx`: application orchestration and shared state.
- `app/AmbientBookBackground.tsx`: cover-led ambient visual layer.
- `app/EpubReader.tsx`: epub.js lifecycle, theme canvas, iframe interactions.
- `app/ReaderControls.tsx`: floating reader controls.
- `app/ReadingSession.tsx`: TXT/EPUB reading surface.
- `app/ReadingDashboard.tsx`: reading home surface.
- `app/LibrarySurface.tsx`: library and collections.
- `app/SettingsSurface.tsx`: settings surface.
- `app/AppNavigation.tsx`: primary navigation.
- `app/AppOverlays.tsx`: sheets and overlays.
- `app/useReaderPresentation.ts`: reader presentation state.
- `app/page.module.css`: layout, ambient visuals, reader surfaces, and motion.
- `lib/ambientBookBackground.ts`: ambient palette and transition helpers.
- `lib/epubAmbientCanvas.ts`: EPUB canvas and wrapper styling.
- `lib/epubTapInteractions.ts`: iframe tap/gesture classification.
- `lib/epubReaderPreferences.ts`: EPUB preference/theme behavior.

High-value tests:

- `lib/ambientBookBackground.test.ts`
- `lib/epubAmbientCanvas.test.ts`
- `lib/epubAmbientIntegration.test.ts`
- `lib/epubTapInteractions.test.ts`
- `lib/epubReaderPreferences.test.ts`
- `lib/readerChromeIntegration.test.ts`
- `lib/surfaceArchitecture.test.ts`

## 6. Latest Verification

At `0029694`, verification on June 24, 2026 reported:

- Feature worktree: 54 test files and 544 tests passed.
- Merged `main`: 108 test files and 1088 tests passed because Vitest also discovered the retained worktree tests.
- Production `next build` passed.
- Source ESLint passed with `npm.cmd exec -- eslint app lib`.
- Local `main`, `origin/main`, and GitHub `refs/heads/main` all resolved to `0029694299f55248760b35bb218121aee8cec680`.
- The root worktree was clean and synchronized with `origin/main`.

Important lint note:

`npm.cmd run lint` from the repository root currently scans generated files under `.worktrees\surface-visual-system\.next` and produces thousands of false errors. This is not a source-code failure. Until the ESLint ignores are hardened or the old worktree is removed with explicit approval, use:

```powershell
npm.cmd exec -- eslint app lib
```

After code changes, run:

```powershell
npm.cmd run test
npm.cmd exec -- eslint app lib
npm.cmd run build
npm.cmd audit --json
git diff --check
```

## 7. Remaining Real-Device Checks

The latest EPUB fixes have automated coverage and a production build, but the exact iPhone Safari behavior should still be checked with an imported EPUB.

Acceptance sequence:

1. Open an EPUB and switch between light, dark, and system appearance.
2. Confirm the page background and text remain readable after every switch.
3. Tap a blank/non-interactive reading area repeatedly and confirm the menu alternates visible/hidden.
4. Swipe horizontally and confirm page turning does not also toggle the menu.
5. Scroll vertically where supported and confirm scrolling does not toggle the menu.
6. Select text and confirm selection and the AI action remain available.
7. Change books and confirm the ambient background crossfades to the new cover.
8. Enter and leave the reading surface and confirm the ambient background persists without a white flash.

Safari normal tabs, the in-app browser, and an installed home-screen PWA can composite EPUB iframes differently. Record which environment is being tested.

## 8. Temporary Phone Testing

Cloudflare quick-tunnel URLs are temporary and may expire when the local process stops. Verify an existing link before sharing it and do not treat it as permanent deployment.

## 9. Deferred Roadmap

- `ROADMAP.md` records a future in-app web browser that lets the user browse
  arbitrary websites and import downloaded EPUB/TXT files directly into the
  existing bookshelf.
- This work is intentionally deferred. A reliable implementation requires a
  thin iOS native shell using `WKWebView` and `WKDownload`; it is not a pure
  PWA feature.
- Do not start the native shell until the user explicitly resumes this roadmap
  item and a Mac/Xcode/signing/device-testing workflow is available.
- Preserve the current Next.js reader and local data model. This is a hybrid
  wrapper plan, not approval for a native rewrite.

## 10. Prompt for the Next Conversation

```text
继续开发 C:\aaa\ai-reader-pwa，先完整阅读 HANDOFF.md。

从根目录 main 分支继续，先检查 git 状态、最新提交和现有工作树。当前 main 和 origin/main 应指向 0029694。不要 reset、clean、删除旧功能工作树或覆盖现有修改。

上一轮已经完成 AmbientBookBackground、阅读界面视觉架构调整、EPUB 菜单重复点击切换，以及 iOS Safari 下 EPUB 深色主题画布修复，并已合并推送到 GitHub main。

先听取我的新问题。若仍涉及 EPUB 显示或点击交互，先区分普通 Safari、Codex 内置浏览器和主屏幕 PWA，再复现和定位。修改后运行测试、源代码 ESLint、生产构建、npm audit 和 git diff --check；涉及手机行为时，不要只凭桌面测试声称修复。
```
