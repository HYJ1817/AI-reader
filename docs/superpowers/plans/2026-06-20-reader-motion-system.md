# Reader Motion System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current scattered reader animations with a restrained, interruptible motion system and reduce gesture/scroll instability.

**Architecture:** Add small pure helpers for gesture and sheet-dismiss decisions, a shared draggable `BottomSheet`, and requestAnimationFrame/debounce scheduling around reader progress. Keep the existing page state and storage APIs, but preserve an open reader component across tab switches.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS Modules, Pointer Events, Web Animations/CSS transitions, Vitest.

---

### Task 1: Add Tested Motion Decisions

**Files:**
- Create: `lib/motionInteractions.ts`
- Create: `lib/motionInteractions.test.ts`

- [ ] Write failing tests for tap qualification, drag clamping, and sheet dismissal by distance or velocity.
- [ ] Run `npm run test -- lib/motionInteractions.test.ts` and confirm failures are caused by missing helpers.
- [ ] Implement `isTapGesture`, `clampSheetDrag`, and `shouldDismissSheet`.
- [ ] Re-run the focused tests and confirm they pass.

### Task 2: Build A Shared Interruptible Bottom Sheet

**Files:**
- Create: `app/BottomSheet.tsx`
- Modify: `app/page.module.css`
- Modify: `app/ReaderSettingsPanel.tsx`
- Modify: `app/TocDrawer.tsx`
- Modify: `app/ReadingGoalSheet.tsx`
- Modify: `app/AiSettingsSheet.tsx`
- Modify: `app/page.tsx`

- [ ] Implement overlay enter/exit phases and delayed parent `onClose`.
- [ ] Implement pointer capture on the grabber with direct drag translation.
- [ ] Use `shouldDismissSheet` for release decisions.
- [ ] Migrate reader settings, TOC, goal, provider, Ask AI, and inline library sheets to the shared frame.
- [ ] Verify backdrop click, close buttons, Escape, and drag dismissal all follow the same exit path.

### Task 3: Stabilize Reader Taps And Scrolling

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/EpubReader.tsx`
- Modify: `app/ReaderControls.tsx`
- Modify: `lib/readerTapZones.test.ts` or add focused interaction tests as needed

- [ ] Remove the duplicate outer Touch Events gesture path and keep one Pointer Events path.
- [ ] Reject pointer taps after movement, selection, controls, or a handled swipe.
- [ ] Hide chrome on scroll start, not on progress updates.
- [ ] Coalesce TXT and EPUB progress updates with requestAnimationFrame.
- [ ] Debounce TXT IndexedDB progress writes until scrolling settles.
- [ ] Close the reader action menu whenever chrome becomes hidden.

### Task 4: Preserve Reader Session Across Tabs

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/page.module.css`
- Modify: `lib/navigationVisibility.test.ts` only if navigation behavior changes

- [ ] Keep the reader subtree mounted whenever `openBook` exists.
- [ ] Add active/inactive reader session classes using opacity, small translation, visibility, and pointer-events.
- [ ] Keep Library and Settings usable while the inactive reader remains mounted.
- [ ] Confirm returning to Reading reuses the existing EPUB rendition and TXT scroll container.

### Task 5: Replace Cheap And Expensive Motion

**Files:**
- Modify: `app/page.module.css`
- Modify: `app/ReaderControls.tsx`

- [ ] Consolidate durations and curves into motion tokens.
- [ ] Change reader chrome to opacity plus 8px translation with separate enter/exit timings.
- [ ] Remove blur animation, large scale changes, page-turn flash, and redundant padding transition.
- [ ] Reduce simultaneous glass layers in the reader action panel.
- [ ] Change progress indicators from animated width to `transform: scaleX(...)`.
- [ ] Add reduced-motion overrides for both system preference and app preference.

### Task 6: Preserve Reading Anchor During Preference Changes

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/EpubReader.tsx`
- Modify: `app/page.module.css`

- [ ] Capture TXT progress before applying typography preferences and restore it on the next animation frame.
- [ ] Keep EPUB at the current locator while applying themes.
- [ ] Crossfade only background and text colors for theme changes.
- [ ] Avoid animating font size, line height, width, or padding.

### Task 7: Long-List Rendering And Verification

**Files:**
- Modify: `app/page.module.css`
- No behavioral changes to storage, backup, AI payload, or parsing.

- [ ] Add `content-visibility: auto` and intrinsic size hints to library and TOC rows.
- [ ] Run `npm run test`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run `npm audit --json`.
- [ ] Start the production server and inspect iPhone-size Library, Reader, Reader Settings, TOC, and AI Provider flows.
- [ ] Verify no console errors, no blank frames, and no interaction lock during repeated taps and sheet drags.

