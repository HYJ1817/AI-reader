# Accessibility and Interaction Hardening Design

## Goal

Make the stabilized Phase 1-4 daily reading path operable and understandable
with keyboard focus, non-color state cues, reduced motion, and enlarged text,
without turning the interface into a visibly heavier accessibility mode.

## Evidence from the current UI

- Root navigation explicitly removes its `:focus-visible` outline.
- Library list rows attach click behavior to a non-focusable `li`.
- Library grid/list controls have labels but no grouped pressed-state semantics.
- Ask AI exposes a clickable paragraph, an unnamed icon-only submit button, and
  unannounced loading/error changes.
- Several frequent icon and compact action buttons expose hit boxes below
  44px, including Library More, view mode, Ask AI clear, settings actions, and
  provider refresh.
- Daily-path typography is mostly fixed in pixels, so there is no deliberate
  200% text-size behavior or responsive metadata fallback.

## Design decisions

### 1. One application focus language

Add a global keyboard-only focus ring using the current tint and a surface
halo. Pointer interaction remains visually unchanged. Remove the root-tab
exception that suppresses the ring; preserve the specialized switch and goal
focus styles where they already convey focus clearly.

### 2. Native controls over simulated controls

- Library list items become a non-interactive row containing a real primary
  book button and a separate real More button.
- Library view mode becomes a named group with one `aria-pressed` button.
- Ask AI's configuration affordance and submit action are real named buttons.
- Do not introduce clickable `div`, `span`, or paragraph replacements.

This keeps Enter/Space behavior, focus order, and assistive technology output
native while preserving handlers and Motion boundaries.

### 3. State must survive loss of color

Continue using visible checkmarks, progress copy, labels, and `aria-current` or
`aria-pressed`; do not rely on tint alone. Loading and success use polite live
status. Errors use alert semantics. Disabled controls remain native `disabled`
elements and retain readable labels.

### 4. 44px interaction geometry without oversized decoration

Increase the actual interactive box of frequent compact controls to at least
44px while keeping their glyphs, fills, and internal visual marks small. Use
negative margins or the existing overlay position where needed so the shelf
grid and compact headers do not become visually bulky.

### 5. Scalable daily-path typography

Define named `rem` typography tokens in `globals.css` and adopt them on root
titles, section headings, Library metadata, Reading low-data copy, Settings
rows, root tabs, and common form text. At 200% root text size:

- page headers and metadata may wrap rather than clip;
- Library rows keep title, source, recent-reading, and progress readable;
- controls remain reachable and no root surface gains horizontal overflow;
- the bottom navigation remains identifiable and tappable.

Cover micro-type is part of cover artwork and is excluded from UI text scaling.
Reader-content font size remains governed by reader preferences.

### 6. Motion, themes, and scope

The existing reduced-motion policy remains authoritative. Focus, semantics, hit
geometry, and reflow must work in light, dark, sepia, and custom-background
surfaces without changing theme persistence or resuming the unresolved EPUB
ambient-canvas investigation.

## Behavior preserved

- IndexedDB data, backups, providers, groups, progress, and settings.
- Library import, search, grid/list state, selection, More, collections,
  pagination, shared-cover transition, and focus restoration.
- Reading dashboard actions, reader gestures, navigation history, sheets, and
  software-keyboard avoidance.
- Existing reduced-motion preference and system media-query behavior.

## Acceptance criteria

- Keyboard focus is visibly distinguishable on every tested daily-path control.
- Keyboard users can open a Library list book and operate its separate More
  action without nested interactive controls.
- View mode and navigation states expose non-color semantics.
- Ask AI loading, errors, configuration, and submit controls have correct native
  semantics and names.
- Audited frequent controls measure at least 44px on both mobile baselines.
- A 200% text-size browser run has no horizontal root overflow and retains the
  primary Library, Reading, Settings, and navigation actions.
- Focused tests fail before implementation, then full Vitest, ESLint, webpack,
  two-device Playwright, production smoke, and screenshot review pass.

