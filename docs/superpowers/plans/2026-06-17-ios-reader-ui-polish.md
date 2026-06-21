# iOS Reader UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the existing AI Reader PWA UI toward a minimal iPhone Books-style interface without changing app behavior.

**Architecture:** This is a scoped visual pass over the existing React page and CSS module. Reuse current state, handlers, data models, and components. Keep changes mostly in `app/page.module.css`, with only minimal JSX class changes in `app/page.tsx` if a style hook is missing.

**Tech Stack:** Next.js App Router, React, TypeScript, CSS Modules, existing local IndexedDB/Dexie helpers.

---

### Task 1: Protect Current Behavior

**Files:**
- Read only: `app/page.tsx`
- Read only: `app/page.module.css`
- Read only: `app/ReaderControls.tsx`
- Read only: `app/AiSettingsSheet.tsx`

- [ ] **Step 1: Inspect current dirty tree**

Run:

```powershell
git status --short
git diff -- app/page.tsx app/page.module.css app/ReaderControls.tsx app/AiSettingsSheet.tsx
```

Expected: current UI/AI-provider work is present. Do not run `git reset`, `git checkout`, `git restore`, or any command that reverts files.

- [ ] **Step 2: Identify existing selectors**

Find these selectors in `app/page.module.css` before editing:

```text
.libraryPage
.collectionsScreen
.collectionsTopBar
.collectionsTitle
.collectionRow or equivalent collection list row classes
.tabBar
.tabButton or equivalent tab item classes
.readerTopBar
.readerBottomProgress
```

Expected: use existing selectors where possible instead of introducing a second UI system.

### Task 2: Simplify Library And Collections Lists

**Files:**
- Modify: `app/page.module.css`
- Modify only if required for class hooks: `app/page.tsx`

- [ ] **Step 1: Remove card-like treatment from the library collection entry**

Change the library "藏书" entry styling so it uses:

```css
background: transparent;
border-left: 0;
border-right: 0;
border-radius: 0;
box-shadow: none;
border-top: 0.5px solid var(--ios-separator);
border-bottom: 0.5px solid var(--ios-separator);
```

Expected: the row is visually a native list row, not a rounded standalone card.

- [ ] **Step 2: Remove colored boxes from collection icons**

For collection rows, replace colored icon box styling with direct line-icon styling:

```css
background: transparent;
border: 0;
border-radius: 0;
box-shadow: none;
color: var(--ios-text);
width: 34px;
height: 34px;
```

Use `var(--ios-secondary)` for reorder/custom group icons where appropriate.

Expected: icons look like the user's reference screenshots: simple black/gray line icons on white, or white/gray on dark.

- [ ] **Step 3: Keep only necessary separators**

Ensure list rows use hairline separators and no nested cards:

```css
border-bottom: 0.5px solid var(--ios-separator);
```

Expected: sections read like iOS grouped/plain lists, not card grids.

### Task 3: Rebuild Bottom Navigation As A Floating Glass Capsule

**Files:**
- Modify: `app/page.module.css`
- Modify only if required for icon markup: `app/page.tsx`

- [ ] **Step 1: Restyle tab container**

Update `.tabBar` or equivalent to a floating capsule:

```css
position: fixed;
left: 12px;
right: 12px;
bottom: calc(var(--safe-bottom) + 12px);
height: 82px;
padding: 8px;
border-radius: 999px;
background: color-mix(in srgb, var(--ios-bg-elevated) 72%, transparent);
backdrop-filter: blur(30px) saturate(180%);
-webkit-backdrop-filter: blur(30px) saturate(180%);
border: 0.5px solid color-mix(in srgb, var(--ios-separator) 58%, transparent);
box-shadow: 0 14px 34px rgba(0, 0, 0, 0.18), inset 0 1px 0 var(--glass-highlight);
```

Expected: the bottom nav resembles a floating iOS glass capsule and does not look like a normal web tab bar.

- [ ] **Step 2: Restyle active tab**

Use a soft internal rounded highlight:

```css
border-radius: 999px;
background: color-mix(in srgb, var(--ios-bg) 42%, transparent);
```

Expected: the active tab has a visible but restrained highlight like the user's reference.

- [ ] **Step 3: Enlarge tab icons and simplify labels**

Keep labels as `书库`, `阅读`, `设置`. Icons should be visually heavier and around 28-34px. Do not add new tabs.

Expected: bottom nav has three large icon+label targets, stable on iPhone width.

### Task 4: Preserve Reader Chrome

**Files:**
- Modify only if necessary: `app/ReaderControls.tsx`
- Modify: `app/page.module.css`

- [ ] **Step 1: Keep reader controls minimal**

Do not reintroduce bottom page-turn buttons. Keep vertical reading and a thin bottom progress indicator.

Expected: reader remains scroll-first.

- [ ] **Step 2: Keep target ring in top bar**

Reader top-right goal ring remains available and tappable.

Expected: goal feature is still accessible from reader, not only settings.

### Task 5: Verify

**Files:**
- No direct edits.

- [ ] **Step 1: Run tests**

Run:

```powershell
npm run lint
npm run test
npm run build
npm audit --json
```

Expected:

- Lint passes.
- Tests pass.
- Build passes.
- Audit reports 0 vulnerabilities.

- [ ] **Step 2: Manual browser check**

Open the app in production preview and verify:

- Library page is simple and list-first.
- "藏书" row is not a rounded card.
- Collections page icons are line icons without colored boxes.
- Bottom navigation is a floating glass capsule.
- Import, open book, reading, AI provider settings, and grouping still respond to clicks.
