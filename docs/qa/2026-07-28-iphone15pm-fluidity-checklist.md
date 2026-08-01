# iPhone 15 Pro Max PWA Interaction Fluidity Checklist

## Candidate identity

- Verification date: 2026-08-01 (Asia/Shanghai)
- Implementation commit: `740226d`
- Branch: `feat/pwa-interaction-fluidity`
- Worktree: `C:\aaa\ai-reader-pwa\.worktrees\pwa-interaction-fluidity`
- Base: local `main` at `d0d2f99`; candidate is 38 commits ahead and 0 behind.
- Runtime tested automatically: Playwright Chromium mobile profiles for iPhone 14 and iPhone 15 Pro Max.
- Physical device, iOS version, Safari version, installed-PWA BUILD_ID, and standalone-display confirmation: **not available / not verified**.
- Publication status: local commits only. No push, preview deployment, production deployment, tag, or release was performed.

## Automated acceptance summary

| Area | Status | Evidence |
| --- | --- | --- |
| Unit/integration correctness | Pass | `npm.cmd test -- --run`: 122 files, 1176 tests passed. |
| Static quality | Pass | `npm.cmd run lint` exited 0. |
| Production compilation | Pass | `npm.cmd run build` compiled, type-checked, and generated all routes. |
| UI design audit | Pass | Impeccable detector returned `[]`. |
| Repository hygiene | Pass | `git diff --check` exited 0 before the implementation commit. |
| iPhone 14 browser matrix | Pass on the immediately preceding candidate | 92/92, one worker, zero retries, `--trace=off`; the later root-layer optimization only changes inactive root transition scheduling and has focused coverage. |
| iPhone 15 Pro Max browser matrix | Partial on final candidate | Full runs reached 91/92 because the rapid-root p95 gate intermittently sampled 33.3-33.4ms. After the root-layer fix, the rapid-root case passed at p95 16.7ms, but one small press-feedback miss remains below. |
| Root navigation focused gate | Pass | 2/2. Latest `root-tab-performance.json`: p95 16.8ms, max 16.8ms, long task 0, layout shift 0. |
| Long contents under 4x CPU | Pass | Final design passed 10/10 repeated iPhone 14 runs; first-click p95 no more than 16.8ms, max no more than 33.4ms, long task 0. |
| Reading-goal hydration/compact/reduced-motion | Pass | The two formerly unstable cases passed 10/10 repeated iPhone 15 Pro Max runs; all six journeys passed in both later full matrices. |
| Physical iPhone 15 Pro Max home-screen PWA | Pending | Required before project completion; Chromium emulation is not physical Safari/WebKit or ProMotion evidence. |

## Implemented motion and interaction contract

- Root tabs: 160ms content entry and 220ms indicator retargeting. Only the active full-screen root surface animates; inactive roots settle immediately to avoid three concurrent full-screen layers during rapid taps.
- Push navigation: 280ms entry / 200ms exit, interruptible and history-owned, with one edge gesture popping one route.
- Reader presentation: 280ms entry / 210ms exit with shared-cover geometry, safe fallback geometry, lifecycle settlement, and a 100ms reduced-motion crossfade.
- Sheets: 280ms entry / 220ms exit. Nested pages remain within one persistent sheet, preserving backdrop, height snapshot, keyboard ownership, focus return, and interruption cleanup.
- Popovers and inline state: 180ms/120ms popover entry/exit and 160ms/120ms state entry/exit. Reduced motion uses 100ms without spatial scale/translation.
- Contents tabs: panel state and horizontal scrolling are split across adjacent frames; viewport width is cached; hidden full-panel Motion animation was removed. The selected segment uses a 120ms background/color fade rather than creating and retiring a moving full-width layer.
- Press feedback: direct controls own their transform so Motion parent transforms cannot suppress the pressed state.
- Workspace: persistent sheet routing, frame-batched streaming, guarded generations, stable composer/header geometry, scroll ownership, and preserved user position.

## Retained small issue — record only

- iPhone 15 Pro Max Chromium, final interaction-suite run: the list-mode `book-row` press probe measured **88.0ms** once against an 80ms target.
- Scope: intermittent visual feedback latency only; the click still opened the reader correctly. The other press families passed, and prior five-repeat sampling of the same repaired row passed 5/5.
- Evidence basename: `press-feedback-latencies.json` and failure screenshot `test-results/native-navigation/interaction-fluidity-press-35a06--daily-interaction-families-iphone-15-pro-max/test-failed-1.png` (Playwright output is ephemeral and was later overwritten by focused runs).
- Disposition: intentionally not changed further per user direction on 2026-08-01. Recheck on the physical iPhone before release.

## Automated evidence filenames

The suite generates these exact basenames without committing binary evidence:

- Transition captures: `root-start.png`, `root-mid.png`, `root-complete.png`, `push-start.png`, `push-mid.png`, `push-complete.png`, `reader-start.png`, `reader-mid.png`, `reader-complete.png`, `sheet-start.png`, `sheet-mid.png`, `sheet-complete.png`.
- Metrics: `root-tab-performance.json`, `push-transition-performance.json`, `book-sheet-performance.json`, `root-retarget-baseline.json`, `ten-root-intents.json`, `reader-popover-inline-state.json`, `provider-pending-inline-state.json`, `press-feedback-latencies.json`, `workspace-tab-inline-state.json`, `workspace-streaming-inline-state.json`, `workspace-open-metrics.json`, and `workspace-open-performance.json`.
- Latest retained local artifact: `test-results/native-navigation/native-navigation-root-tab-6c198-frame-and-long-task-budgets-iphone-15-pro-max/root-tab-performance.json` plus `root-tab-performance-json-4c3bf925c6c24d340812be4ecd105d7d2508650a.json`.
- Earlier full-run failure artifacts and screenshots were preserved in command output but overwritten by later Playwright runs; screenshots are intentionally not committed.

## Physical iPhone 15 Pro Max acceptance — all pending

Record the actual device model, iOS version, Safari version, hosted BUILD_ID, battery/thermal state, network condition, and whether the app was launched from a home-screen icon. Then test every item below at normal speed and frame-by-frame where a recording is available.

- [ ] Cold launch and warm resume in standalone mode; no white frame, stale shell, or replayed entry animation.
- [ ] Root Library/Reading/Settings changes, including ten rapid alternating taps; one visible root, last intent wins, no double text or 30fps burst.
- [ ] Push pages via button, browser/history behavior, and left-edge back; cancellation and reversal settle once.
- [ ] Reader shared-cover open/close, offscreen/missing origin fallback, close while TXT/EPUB is preparing, and background/foreground interruption.
- [ ] Outer sheet open/drag/outside-tap/Escape plus nested pages, rapid reversal, keyboard open/close, safe-area bottom, and originating-control focus return.
- [ ] Reader settings and Workspace popovers at 200% text; no clipping, horizontal overflow, scale motion under reduced motion, or lost focus.
- [ ] Contents sheet with a long EPUB: segment taps, native horizontal swipe, vertical scroll, rapid direction change, and the 88ms book-row press follow-up.
- [ ] Workspace long history, prepend anchoring, streaming while the user is scrolled away, composer responsiveness, stop/error/retry, and offline readable state.
- [ ] Light, dark, sepia, system-dark, and custom-background materials for root, reader, sheets, and provider configuration.
- [ ] Rotation, background/resume, offline reload, weak network, low-power mode, warm device, and sustained use; record observed cadence without claiming guaranteed 120Hz.
- [ ] VoiceOver reading order/labels, focus trap and return, 44px targets, keyboard navigation, reduced motion, and 200% text.
- [ ] Capture named screenshots/video/JSON and give every item an explicit pass/fail result.

## Diagnostic history (not release passes)

- Runs with retained tracing produced isolated 33ms frame samples; strict motion acceptance uses `--trace=off` to measure the app rather than trace recording overhead.
- Earlier strict runs exposed and drove fixes for TOC offscreen geometry, a full-panel tab animation, reading-goal hydration, reader fallback sampling, and Motion overriding list-row press transforms.
- One 62ms reader-popover long task appeared in a long iPhone 14 matrix, then reproduced 0/10 in focused testing and passed the later 92/92 matrix with long task 0. It remains diagnostic history, not a claimed physical-device result.

## Release decision

This is a local automated candidate, not a production release. Do not mark the project fully complete until the physical checklist is run. Pushing or deploying a hosted candidate requires separate user authorization.
