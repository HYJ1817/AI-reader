# Reader Typography and Unobstructed Canvas Design

**Status:** Approved on 2026-07-14. The user also authorized later roadmap phases to proceed without repeated approval pauses.

**Scope:** Phase 1 of `docs/superpowers/plans/2026-07-14-ui-quality-roadmap.md`.

## Problem

The current TXT reader has two visible defects in the iPhone reading path:

1. `.paragraph` unconditionally applies `text-align: justify`, even though the stored preference defaults `justifyText` to `false`. English and mixed-language paragraphs therefore develop large word-space rivers.
2. The always-available 48px reader menu button is rendered as a fully opaque floating circle with a wide shadow. It visibly covers text near the lower-right corner.

The existing architecture also imposes two constraints:

- The menu wake target must remain continuously available and at least 44px because it is the reliable iPhone fallback after canvas-tap propagation proved inconsistent.
- `parseTxtParagraphs` returns plain strings and does not preserve heading levels or blank-line semantics. Phase 1 must not infer chapter headings from paragraph length or language heuristics.

## Goals

- Make English, Chinese, and mixed-language TXT content comfortable at the existing default reading size.
- Make the saved `justifyText` preference the only authority for TXT justification when custom layout is enabled.
- Preserve an always-available, accessible menu wake target without visually covering readable text.
- Keep EPUB publisher layout, ambient background behavior, resume fallback, settings storage, pagination, and reading progress unchanged.
- Verify the result with contract tests and iPhone-sized screenshots before checking off Phase 1.

## Non-goals

- Automatic language detection or per-paragraph alignment heuristics.
- Automatic TXT chapter or heading recognition.
- New reader preference fields, storage migrations, font downloads, hyphenation dictionaries, or EPUB CSS overrides.
- Changes to the reader action menu's information architecture. Global chrome reduction belongs to Phase 2.
- Reopening the paused EPUB dark-canvas investigation.

## Chosen Approach

Use explicit preference-driven alignment and a state-aware edge affordance.

This approach is preferred over automatic language detection because mixed-language paragraphs are common and heuristic classification would create unstable results. It is preferred over tuned global justification because no spacing adjustment can reliably remove English word rivers at narrow mobile measures.

### TXT alignment and text rhythm

- The CSS fallback for `.paragraph` is `text-align: start`.
- `ReadingSession` computes the TXT alignment explicitly:
  - `justify` only when `customLayoutEnabled && justifyText` is true.
  - `start` in every other case.
- Existing font family, 18px default size, 1.75 line height, content width, letter spacing, word spacing, and paragraph spacing remain unchanged in Phase 1. These values are already user-configurable and the screenshot defect comes from alignment, not insufficient font size or line height.
- Paragraph wrapping continues to use `text-wrap: pretty`. Long unbroken tokens may wrap, but ordinary English words must not be forcibly distributed across the line.
- The renderer continues to emit semantic `<p>` elements. No paragraph is promoted to a heading without preserved source semantics.

### Reader menu wake affordance

`ReaderControls` keeps one semantic `<button>` and one interaction path. The existing `visible` prop supplies styling state; no timers, scroll listeners, or duplicate buttons are introduced.

- The button's interactive box remains 48px by 48px, stays inside the safe area, and remains pointer-active in both chrome states.
- When the action menu is closed, the button becomes a quiet trailing-edge affordance:
  - the 48px hit area remains intact;
  - only a smaller surface and icon are visually emphasized;
  - the visible surface sits against the right edge;
  - the broad floating shadow and opaque circular plate are removed;
  - the underlying text remains legible through the unused portion of the hit area.
- When the action menu is open, the same button receives a clearer expanded-state surface and press feedback so it still reads as the menu anchor.
- `aria-label`, `aria-expanded`, `data-reader-menu-toggle`, and click behavior remain unchanged.
- The TXT scroller receives enough trailing bottom clearance for the final paragraph to scroll fully above the menu affordance and device safe area.
- Reduced-motion behavior remains instant. The state treatment uses existing transition tokens and does not add looping or delayed animation.

## Components and Data Flow

### `app/ReadingSession.tsx`

Derives a stable `start | justify` value from `ReaderPreferences` and applies it to the TXT scroll container. The component does not inspect paragraph contents. It also supplies the approved bottom clearance through the existing reader body styling contract.

### `app/ReaderControls.tsx`

Adds a state class or data attribute derived solely from `visible` to the existing wake button. The button remains the single control that toggles the action menu.

### `app/page.module.css`

Defines the safe TXT fallback alignment and the two visual wake-button states. Pseudo-elements or nested visual styling may reduce the painted surface, but the actual button dimensions must stay 48px by 48px.

### Existing preference and EPUB modules

`lib/readerPreferences.ts`, the stored preference schema, `EpubReader`, and EPUB ambient/resume behavior do not change. Invalid stored values continue to be sanitized by the existing preference loader.

## Error and Edge-case Handling

- Missing or malformed `justifyText` values continue to fall back to `false` through the existing sanitizer.
- Disabling custom layout always returns TXT paragraphs to `start`, even if `justifyText` remains stored as true for later reuse.
- Chinese content remains naturally readable with start alignment; users who prefer full justification can enable it explicitly.
- Mixed-language paragraphs use one predictable alignment selected by the user, not a different result after content edits or reloads.
- Long URLs and unbroken tokens wrap without expanding the viewport.
- Continuous and paged TXT modes use the same alignment authority.
- The menu button remains usable with touch, keyboard, VoiceOver-style accessible-name inspection, reduced motion, and all safe-area sizes already supported by the app.

## Test Strategy

### Contract tests

Create `lib/readerTypography.test.ts` to verify source-level integration contracts:

- `.paragraph` defaults to `text-align: start` and no unconditional `justify` remains.
- `ReadingSession` exposes explicit `start` and preference-driven `justify` branches.
- English, Chinese, and mixed-language fixtures remain plain paragraphs and do not trigger heading or language heuristics.
- Reader bottom clearance accounts for the menu affordance.

Extend `lib/readerChromeIntegration.test.ts` to verify:

- the wake button retains its 48px target;
- both collapsed and expanded visual states are derived from `visible`;
- accessibility attributes and the existing toggle path remain present;
- collapsed styling removes the large floating plate without disabling pointer events.

Keep `lib/epubAmbientIntegration.test.ts` green to prove the implementation did not alter EPUB canvas or resume behavior.

### Visual and functional verification

- Capture iPhone 14 screenshots for English, Chinese, and mixed-language TXT with the menu closed.
- Capture the menu-open state and confirm the same button still toggles the menu.
- Verify both continuous and paged reading modes.
- Compare against the Phase 0 screenshot: English spacing must no longer form visible rivers, and the collapsed menu affordance must not cover opaque text.
- Run the roadmap's full Vitest, ESLint, webpack build, both iPhone Playwright projects, `git diff --check`, deployment, and production smoke gates.

## Completion Criteria

Phase 1 may be checked off only when:

- all contract tests demonstrate the approved alignment and wake-button behavior;
- focused screenshots cover English, Chinese, mixed-language, menu-open, continuous, and paged states;
- the complete repository verification gate passes;
- the new Worker version is live on `https://881817.xyz` and its root plus discovered assets return HTTP 200;
- `HANDOFF.md` records the implementation commit, Worker version, verification evidence, and remaining real-device risk;
- the Phase 1 roadmap checkbox and every child checkbox are marked complete.
