# AI Reader Agent Handoff

## 1. Current Checkout

- Repository: `C:\aaa\ai-reader-pwa`
- Active worktree: `C:\aaa\ai-reader-pwa\.worktrees\surface-visual-system`
- GitHub: https://github.com/HYJ1817/AI-reader
- Branch: `codex/surface-visual-system`
- Latest code commit: `ff8cc64` (`fix: improve reader taps and transition pacing`)
- Branch HEAD may include a newer documentation-only handoff commit.

Start every new session with:

```powershell
cd C:\aaa\ai-reader-pwa\.worktrees\surface-visual-system
git status -sb
git log -3 --oneline --decorate
npm.cmd run test
npm.cmd run lint
npm.cmd run build
```

Do not reset, clean, switch to `main`, discard, or overwrite changes you did not create.

## 2. Product and Stack

AI Reader is a local-first EPUB/TXT reader primarily used on one iPhone in Safari or as a home-screen PWA.

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
- Do not claim a mobile interaction is fixed solely because desktop tests pass.

## 4. Recent Completed Work

Recent commits:

- `ff8cc64`: improves reader tap recognition and transition pacing.
- `92b2fdf`: stabilizes reader controls and adds nested-view/sheet motion.
- `b572db3`: seeds visible navigation-surface offsets.

Current behavior:

- Importing a book keeps the user in the library instead of opening it immediately.
- A stationary tap on a non-interactive reading area toggles reader controls.
- Reader tools appear directly as an unframed list. There is no intermediate three-dot button.
- The reader menu contains contents, appearance, reading mode, and AI. Reading goal is not in this menu.
- TXT and EPUB use a shared 18 px movement threshold, removing the previous tap/scroll dead zone.
- Vertical scrolling hides controls. Horizontal swiping turns pages without also toggling controls.
- Text selection reveals controls and preserves the selected-text AI flow.
- Safari tap highlight flashes are disabled in the parent app and EPUB documents.
- Collections and AI provider subviews animate forward and backward.
- Primary navigation and nested views use 36 px travel, 340 ms, and `cubic-bezier(0.32, 0.72, 0, 1)`.
- Bottom sheets use the same easing with a separate 300 ms duration.
- Reader tools retain 8 px travel and staggered entry.

## 5. Important Files

- `app/page.tsx`: application orchestration and reader gesture handling.
- `app/page.module.css`: primary layout and motion styles.
- `app/EpubReader.tsx`: epub.js lifecycle and iframe touch handling.
- `app/ReaderControls.tsx`: reader overlay controls.
- `app/ReadingSession.tsx`: TXT/EPUB reading surface.
- `app/BottomSheet.tsx`: animated and draggable sheets.
- `app/LibrarySurface.tsx`: library and collections subviews.
- `app/AiSettingsSheet.tsx`: AI provider configuration.
- `lib/motionInteractions.ts`: shared tap, scroll, and sheet gesture logic.
- `lib/readerChromeState.ts`: reader-control visibility reducer.
- `lib/readerChromeIntegration.test.ts`
- `lib/motionInteractions.test.ts`
- `lib/motionCss.test.ts`
- `lib/overlayMotionIntegration.test.ts`

`app/page.tsx` and `app/page.module.css` are large and easy to regress. Keep changes narrowly scoped.

## 6. Latest Verification

At commit `ff8cc64`, verification on June 22, 2026 reported:

- 50 test files passed.
- 500 tests passed.
- ESLint passed.
- Production build passed.
- `npm audit --json` reported zero vulnerabilities.
- `git diff --check` passed.
- Browser checks at 390 x 844 confirmed 340 ms navigation, 300 ms sheets, the expected easing, and no console warnings/errors.

Run fresh verification after every code change:

```powershell
npm.cmd run test
npm.cmd run lint
npm.cmd run build
npm.cmd audit --json
git diff --check
```

## 7. Remaining Real-Device Check

The shared 18 px tap threshold has automated coverage and browser verification, but repeated taps still need final confirmation on a real iPhone with an imported TXT and EPUB.

Acceptance sequence:

1. Tap left, center, and right reading areas at least ten times.
2. Controls must alternate visible/hidden without position-dependent failures.
3. Scroll repeatedly, then tap again.
4. Swipe horizontally and verify it does not also toggle controls.
5. Open each reader tool and verify it responds immediately.
6. Select text and verify the AI action remains available.
7. Switch tabs, open/close collections, and open AI configuration to judge motion pacing.

EPUB interactions occur inside iframe documents, so parent-page pointer handlers alone do not cover them. Safari standalone PWA behavior may differ from normal Safari.

## 8. Temporary Phone Testing

Cloudflare quick-tunnel URLs are temporary and may expire. Verify an existing link before sharing it. Do not treat a quick tunnel as permanent deployment.

## 9. Prompt for the Next Conversation

```text
继续开发 C:\aaa\ai-reader-pwa。

先完整阅读 C:\aaa\ai-reader-pwa\.worktrees\surface-visual-system\HANDOFF.md，然后进入 C:\aaa\ai-reader-pwa\.worktrees\surface-visual-system，检查 git 状态、当前分支、最新提交和相关代码。

当前应在 codex/surface-visual-system 分支，git log 中应包含最新代码提交 ff8cc64，HEAD 可能是更新 HANDOFF.md 的文档提交。不要 reset、clean、切回 main 或覆盖现有修改。项目仍是 Next.js PWA，不要未经确认改成原生 iOS。

上一轮已完成阅读点击阈值统一、菜单直接显示、页面和弹层动画调整，并已推送 GitHub。下一步先听取我的新问题；如果仍涉及阅读菜单，请先在真实 iPhone 上复现并区分 TXT/EPUB，再定位根因和修改。

完成修改后运行完整测试、lint、build、npm audit 和 git diff --check，并做 390 x 844 浏览器检查。涉及手机交互时，不要仅凭桌面测试声称已修复。
```
