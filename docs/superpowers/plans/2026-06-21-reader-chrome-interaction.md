# Reader Chrome Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make TXT and EPUB reader control toggling deterministic and interruptible.

**Architecture:** Add a small pure reader-chrome reducer shared by all event
sources. Route TXT pointer events and EPUB iframe touch events through the same
tap/scroll semantics, with single tap reserved for controls and horizontal
swipe reserved for page turning.

**Tech Stack:** React, TypeScript, CSS Modules, Vitest, epub.js

---

### Task 1: Reader chrome state reducer

**Files:**
- Create: `lib/readerChromeState.ts`
- Create: `lib/readerChromeState.test.ts`

- [ ] Write failing tests for tap toggling, scroll hiding, selection showing,
  rapid tap reversal, and residual scroll suppression.
- [ ] Run `npm.cmd run test -- lib/readerChromeState.test.ts` and confirm RED.
- [ ] Implement the minimal pure reducer.
- [ ] Re-run the test and confirm GREEN.

### Task 2: Unify TXT and EPUB events

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/EpubReader.tsx`
- Test: `lib/readerChromeIntegration.test.ts`

- [ ] Write a failing source integration test proving a stationary tap no
  longer invokes edge-tap page turning.
- [ ] Route tap, scroll, selection, and explicit hide events through the shared
  reducer.
- [ ] Use `isTapGesture` in the EPUB iframe and ensure scroll intent cannot also
  finish as a tap.
- [ ] Run targeted tests and confirm GREEN.

### Task 3: Verify motion and deploy

**Files:**
- Verify: `app/page.module.css`
- Verify: `lib/motionCss.test.ts`

- [ ] Confirm enter is 220ms, exit is 180ms, movement is at most 8px, and text
  layout is unchanged.
- [ ] Run `npm.cmd run test`, `npm.cmd run lint`, `npm.cmd run build`, and
  `npm.cmd audit --json`.
- [ ] Restart the production server and verify the public tunnel serves the
  same build as localhost.
