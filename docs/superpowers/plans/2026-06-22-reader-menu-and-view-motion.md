# Reader Menu and View Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize reader menu taps and apply one compositor-friendly motion protocol to sheets, collections, and AI configuration views.

**Architecture:** Keep existing React state and CSS modules. Separate progress scrolling from explicit user scroll intent, then add reusable CSS entrance classes selected from local previous-view refs. Preserve the existing BottomSheet close lifecycle and make its entrance paint reliable with two animation frames.

**Tech Stack:** React 19, Next.js 16, CSS Modules, Vitest

---

### Task 1: Reader menu reliability

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/ReadingSession.tsx`
- Modify: `app/ReaderControls.tsx`
- Test: `lib/readerChromeIntegration.test.ts`

- [ ] Add failing source-integration assertions that TXT progress scroll does not dispatch chrome hiding, explicit pointer movement still does, wheel intent is forwarded, and the reading-goal control is absent.
- [ ] Run `npm.cmd test -- lib/readerChromeIntegration.test.ts` and confirm the new assertions fail.
- [ ] Remove the reading-goal reader control and its props.
- [ ] Detect vertical drag even when swipe-to-turn is disabled, keep horizontal swipe handling conditional, and stop hiding chrome from the TXT progress `onScroll` callback.
- [ ] Forward TXT wheel input to the existing scroll-intent callback.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Reliable sheet entrance

**Files:**
- Modify: `app/BottomSheet.tsx`
- Modify: `app/page.module.css`
- Test: `lib/motionCss.test.ts`
- Test: `lib/overlayMotionIntegration.test.ts`

- [ ] Add failing assertions for a two-frame sheet entrance and the shared 210 ms transform/opacity protocol.
- [ ] Run the focused tests and confirm failure.
- [ ] Change the entering-to-open phase to a nested `requestAnimationFrame`.
- [ ] Align sheet entrance motion to the navigation easing and limit `will-change` to entering and closing phases.
- [ ] Re-run focused tests.

### Task 3: Collections and AI nested-view motion

**Files:**
- Modify: `app/LibrarySurface.tsx`
- Modify: `app/AiSettingsSheet.tsx`
- Modify: `app/page.module.css`
- Test: `lib/overlayMotionIntegration.test.ts`

- [ ] Add failing assertions for forward/back transition classes in both components and 36 px transform keyframes in CSS.
- [ ] Run the focused test and confirm failure.
- [ ] Track the previous nested view with refs so initial render does not animate.
- [ ] Wrap the incoming collections/library and provider list/configuration content with the appropriate directional class.
- [ ] Add shared forward/back keyframes using only transform and opacity.
- [ ] Re-run focused tests.

### Task 4: Verification

**Files:**
- Verify all modified files.

- [ ] Run `npm.cmd test`.
- [ ] Run `npm.cmd run lint`.
- [ ] Run `npm.cmd run build`.
- [ ] Run `npm.cmd audit --json`.
- [ ] Run `git diff --check`.
- [ ] Verify the production page at 390 x 844 with no console errors and test the interactions using a local TXT fixture.
