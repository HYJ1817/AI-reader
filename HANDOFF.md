# AI Reader Agent Handoff

## 1. Start Here

Repository:

- Local path: `C:\aaa\ai-reader-pwa`
- GitHub: https://github.com/HYJ1817/AI-reader
- Branch: `main`
- Baseline commit before this handoff: `915132c`

Before changing code:

```powershell
cd C:\aaa\ai-reader-pwa
git status -sb
git log -1 --oneline --decorate
npm.cmd run test
npm.cmd run lint
npm.cmd run build
```

Do not reset, clean, discard, or overwrite changes that you did not create. Read the current code before proposing a rewrite.

## 2. Product Goal

AI Reader is a local-first personal EPUB/TXT reader intended primarily for one iPhone user.

The target experience is:

- Quiet, focused, and close to a mature native iOS utility.
- Comfortable enough for daily reading rather than merely feature-complete.
- Familiar interactions, restrained animation, simple lists, and large one-handed controls.
- No dashboard-heavy composition, colorful icon grids, generic AI gradients, oversized cards, or decorative clutter.
- Chinese UI throughout.

The user expects ordinary polished commercial-app behavior: predictable navigation, reversible transitions, stable gestures, clear hierarchy, and no interaction that randomly stops responding.

## 3. Current Technology

This repository is still a web app/PWA:

- Next.js 16 App Router
- React 19
- TypeScript
- IndexedDB through Dexie
- epub.js for EPUB rendering
- Vitest
- ESLint
- Service worker and web app manifest

There is no native SwiftUI/Xcode project in this repository. A native iOS rewrite was discussed, but it has not been started. Do not silently begin a native rewrite. Confirm that decision and migration scope with the user first.

## 4. Implemented Features

### Library

- Import local EPUB and TXT files.
- Store book files, metadata, progress, groups, and reading stats locally.
- List and grid library views exist, although the latest design favors a simple list.
- Search by title, format, or filename.
- Book cover extraction and cached cover URLs.
- Multi-group membership: one book may belong to multiple custom collections.
- Dedicated collections screen with create, rename, delete, and filter behavior.
- Batch selection and book actions.

### Reading

- TXT vertical scrolling.
- EPUB rendering through epub.js with vertical reading support and navigation.
- Progress saving and restoration.
- EPUB table of contents.
- Light, dark, sepia, and system-aware reader appearance.
- Font size, line height, and content-width preferences.
- Horizontal swipe page navigation remains available as an auxiliary gesture.
- Selected-text AI question flow.
- Daily reading goal and local reading-time statistics.

### AI Providers

- Multiple provider instances.
- Provider kinds include custom, OpenAI, Anthropic, and Gemini.
- Protocols include OpenAI-compatible, Anthropic-compatible, and Gemini.
- Custom base URLs are supported for third-party services such as DeepSeek.
- Models are not meant to be permanently hard-coded.
- `/api/models` refreshes the provider model list where the upstream protocol supports it.
- A model can also be added manually.
- `/api/chat` sends the configured provider request.

Privacy invariant:

- Never send the full book to an AI provider.
- AI requests may contain only the book title, format, selected passage, and user question.
- API keys remain in browser-local storage and are not exported in backups.

### PWA

- Manifest and service worker exist.
- The service worker uses an update flow intended to avoid a permanently stale installed app.
- iPhone installation requires a trusted HTTPS address.
- Cloudflare quick tunnels have been used for temporary phone testing, but their URLs are ephemeral and must not be treated as deployment.

## 5. Important Files

### Main UI and orchestration

- `app/page.tsx`: main application state and the library/reading/settings screens.
- `app/page.module.css`: most application styling and motion.
- `app/globals.css`: global tokens, themes, and base styles.

`app/page.tsx` is already large. Keep changes scoped. Add a small helper or component when it clearly isolates behavior, but do not turn a focused fix into an architecture rewrite.

### Reader

- `app/EpubReader.tsx`: epub.js lifecycle, content events, preferences, progress, swipe handling, and selected text.
- `app/ReaderControls.tsx`: visible reader controls.
- `app/ReaderSettingsPanel.tsx`: reading appearance controls.
- `app/TocDrawer.tsx`: EPUB table of contents.
- `lib/readerChromeState.ts`: shared reader-control visibility state.
- `lib/motionInteractions.ts`: tap, scroll, and motion intent helpers.
- `lib/readerSwipe.ts`: horizontal swipe behavior.
- `lib/readerPreferences.ts`: persisted reader appearance.
- `lib/epubReaderPreferences.ts`: applies preferences inside EPUB content.
- `lib/txtReader.ts`: TXT parsing and scroll progress.

### AI

- `app/AiSettingsSheet.tsx`: provider-management UI.
- `app/api/chat/route.ts`: chat proxy route.
- `app/api/models/route.ts`: model-list proxy route.
- `lib/aiProviders.ts`: provider schema, persistence, compatibility, and active-provider logic.
- `lib/aiModelList.ts`: provider model-list request/response handling.
- `lib/aiChat.ts`: provider-specific chat requests.

### Storage and backup

- `lib/db.ts`: Dexie schema and local data operations.
- `lib/backup.ts`: local backup import/export.
- `lib/importBook.ts`: book import.
- `lib/browserStorage.ts`: browser storage capability helpers.

### PWA

- `app/ServiceWorkerRegistration.tsx`
- `public/sw.js`
- `public/manifest.webmanifest`

## 6. Latest Reader Interaction Work

The most recent focused change addresses reader controls that sometimes could not be opened.

Root causes found:

- Edge tap zones consumed left/right taps as page turns, so only the center reliably toggled controls.
- Small finger movement could be classified as both scrolling and tapping.
- TXT and EPUB used different gesture thresholds.
- Several direct visibility state updates could compete.

Current intended behavior:

- A stationary tap on any non-interactive part of the reading body toggles controls.
- Left, center, and right taps follow the same rule.
- Vertical scrolling hides controls and must not also finish as a tap.
- Horizontal swiping turns pages and must not also toggle controls.
- Text selection reveals controls.
- Buttons, links, fields, and open panels must not toggle the surrounding reader controls.
- Reader text must not reflow when controls appear.
- Control travel should remain within 8 px, with restrained enter/exit timing.

Relevant regression tests:

- `lib/readerChromeState.test.ts`
- `lib/readerChromeIntegration.test.ts`
- `lib/motionCss.test.ts`
- `lib/motionInteractions.test.ts`

This logic passed automated checks, but the user has not yet confirmed that repeated iPhone taps are fully stable. Treat real-device validation as unfinished.

Suggested manual acceptance:

1. Import and open one TXT and one EPUB.
2. Tap the left, center, and right body areas at least ten times.
3. Controls must alternate visible/hidden without position-dependent failures.
4. Scroll repeatedly, then tap the body again.
5. Swipe horizontally and verify it does not also toggle controls.
6. Select text and verify the AI action remains available.
7. Close and reopen the book and verify progress restoration.

## 7. Known Risks and Unfinished Work

- Reader-control reliability still needs user confirmation on a real iPhone.
- Animation and visual polish are still below the user's desired commercial-app standard. Improve one workflow at a time and verify it visually.
- `app/page.tsx` and `app/page.module.css` are large and easy to regress.
- EPUB events occur inside iframe documents; normal parent-page pointer handlers do not cover them.
- Browser/PWA behavior can differ from Safari standalone mode.
- Temporary Cloudflare Tunnel URLs expire.
- The current `README.md` contains mojibake/Chinese encoding damage and stale test counts. Fix it separately; do not trust it as the current source of truth.
- There is no permanent hosted deployment yet.

## 8. Non-Negotiable Constraints

- Do not delete or migrate existing IndexedDB data without an explicit compatibility plan.
- Keep old books and old backups compatible.
- Do not export API keys in backups.
- Do not transmit full book content to AI.
- Do not hard-code a short fixed model catalog.
- Do not remove third-party compatible endpoints.
- Do not replace Chinese UI with English.
- Do not reintroduce a bottom AI tab; AI belongs in reading context and settings.
- Keep bottom primary navigation as `书库 / 阅读 / 设置`.
- Keep iPhone safe areas and standalone-PWA behavior in mind.
- Do not imitate Apple trademarks or private APIs.
- Do not claim a mobile interaction is fixed solely because desktop tests pass.

## 9. Development and Verification

Install and run:

```powershell
npm.cmd install
npm.cmd run dev
```

Production preview:

```powershell
npm.cmd run build
npm.cmd run start -- --hostname 127.0.0.1 --port 3030
```

Required regression checks:

```powershell
npm.cmd run test
npm.cmd run lint
npm.cmd run build
npm.cmd audit --json
git diff --check
```

At baseline commit `915132c`, the last complete verification reported:

- 40 test files passed.
- 440 tests passed.
- ESLint passed.
- Production build passed.
- `npm audit` reported zero vulnerabilities.

Run these commands again after every new change. Do not repeat these numbers as current evidence without a fresh run.

## 10. Preferred Agent Workflow

The user prefers:

1. Agree on one concrete visible outcome.
2. Delegate large implementation work to OpenCode when useful.
3. Keep each delegated task narrowly scoped.
4. Independently inspect the diff.
5. Run tests, lint, build, and visual/browser checks.
6. Give the user a phone-test link and one clear acceptance script.
7. Do not use test counts as a substitute for describing the visible result.

OpenCode entrypoint previously used:

```powershell
C:\OpenCode\opencode-local.cmd run "task instructions"
```

Codex remains responsible for technical direction, reviewing OpenCode output, protecting existing behavior, and final verification.

## 11. Prompt for the Next Conversation

Use this as the first message in a fresh conversation:

```text
继续开发 C:\aaa\ai-reader-pwa。

先完整阅读 C:\aaa\ai-reader-pwa\HANDOFF.md，然后检查 git 状态、最新提交和相关代码。不要 reset、clean 或覆盖现有修改。这个项目当前仍是 Next.js PWA，不要未经确认改成原生 iOS。

本轮需求是：
[在这里写一个具体需求，并附截图或复现步骤]

先复现和定位根因，再做一个范围明确的修改。完成后运行相关测试、lint、build，并说明我应该如何在 iPhone 上验收。
```
